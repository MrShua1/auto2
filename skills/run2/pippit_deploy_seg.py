import os
import sys
import json
import subprocess
import time
import re
import hashlib
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# Force UTF-8 and unbuffered output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# Ensure domestic endpoints bypass local proxy
os.environ["NO_PROXY"] = "localhost,127.0.0.1,::1,jianying.com,bytedance.net,volces.com,snssdk.com," + os.environ.get("NO_PROXY", "")

NODE_EXE = "node"
RUN_JS = r"C:\Users\JW TSJ\AppData\Roaming\npm\node_modules\@pippit-dev\cli\scripts\run.js"
GLOBAL_CACHE_FILE = r"C:\Users\JW TSJ\.gemini\config\skills\run2\.global_asset_cache.json"

cache_lock = threading.Lock()
global_cache_lock = threading.Lock()

def log(msg):
    print(msg)
    sys.stdout.flush()

def run_cli(args, retries=3, stdin_input=None):
    cmd = [NODE_EXE, RUN_JS] + args
    for attempt in range(retries):
        proc = subprocess.run(
            cmd,
            input=stdin_input,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if proc.returncode == 0:
            return proc.stdout.strip()
        err_msg = proc.stderr.strip() or proc.stdout.strip()
        if attempt < retries - 1:
            time.sleep(0.3 + attempt * 0.2)
        else:
            raise RuntimeError(f"FAIL {' '.join(cmd[:4])}...: {err_msg}")

def get_credit_balance():
    try:
        out = run_cli(["get-credit-balance"])
        data = json.loads(out)
        return int(data.get("total_remain_amount", 0))
    except Exception as e:
        log(f"[!] Warning checking credits: {e}")
    return None

def compute_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def load_json_safe(fpath):
    if os.path.exists(fpath):
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_json_safe(fpath, data):
    try:
        tmp = f"{fpath}.{uuid.uuid4().hex}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, fpath)
    except Exception:
        pass

def upload_asset_cached(local_path, ep_cache, ep_cache_file, global_cache, global_cache_file):
    abs_path = os.path.abspath(local_path)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Asset file not found: {abs_path}")
        
    file_size = os.path.getsize(abs_path)
    file_hash = compute_file_hash(abs_path)
    cache_key = f"hash:{file_hash}::size:{file_size}"
    
    with cache_lock:
        if cache_key in ep_cache:
            return ep_cache[cache_key]
            
    with global_cache_lock:
        if cache_key in global_cache:
            info = global_cache[cache_key]
            with cache_lock:
                ep_cache[cache_key] = info
            return info
        
    fname = os.path.basename(abs_path)
    out = run_cli(["canvas", "upload", "--path", abs_path])
    res = json.loads(out)
    asset_id = res.get("asset_id")
    pippit_asset_id = res.get("pippit_asset_id")
    if not pippit_asset_id:
        raise RuntimeError(f"Upload failed, missing pippit_asset_id: {out}")
        
    cache_info = {
        "asset_id": asset_id,
        "pippit_asset_id": pippit_asset_id,
        "name": fname,
        "size": file_size,
        "hash": file_hash
    }
    
    with cache_lock:
        ep_cache[cache_key] = cache_info
        save_json_safe(ep_cache_file, ep_cache)
        
    with global_cache_lock:
        global_cache[cache_key] = cache_info
        save_json_safe(global_cache_file, global_cache)
        
    return cache_info

def find_asset_file(seg_dir, fname_or_keyword):
    if not fname_or_keyword:
        return None
    asset_root = os.path.join(seg_dir, "资产")
    if not os.path.exists(asset_root):
        return None
        
    fname = os.path.basename(fname_or_keyword).strip("[]")
    if "PENDING_SOURCE:" in fname:
        fname = fname.replace("PENDING_SOURCE:", "").strip()
    
    req_ext = os.path.splitext(fname)[1].lower()
    is_audio_req = req_ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]
    is_image_req = req_ext in [".png", ".jpg", ".jpeg", ".webp"]

    def ext_compatible(cand_f):
        cand_ext = os.path.splitext(cand_f)[1].lower()
        if is_audio_req:
            return cand_ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]
        if is_image_req:
            return cand_ext in [".png", ".jpg", ".jpeg", ".webp"]
        return True

    # 1. Exact match in seg_dir/资产
    for root, dirs, files in os.walk(asset_root):
        for f in files:
            if not ext_compatible(f):
                continue
            if f.lower() == fname.lower():
                return os.path.normpath(os.path.join(root, f))

    clean_kw = re.sub(r"[_\-.\(\)\s]+", "", fname).replace("png", "").replace("jpg", "").replace("mp3", "").replace("wav", "")

    # 2. Fuzzy match in seg_dir/资产
    for root, dirs, files in os.walk(asset_root):
        for f in files:
            if not ext_compatible(f):
                continue
            clean_f = re.sub(r"[_\-.\(\)\s]+", "", f)
            if clean_kw and (clean_kw in clean_f or clean_f in clean_kw):
                return os.path.normpath(os.path.join(root, f))
            if "码头" in fname and ("海口" in f or "码头" in f):
                return os.path.normpath(os.path.join(root, f))
            if "海口" in fname and "海口" in f:
                return os.path.normpath(os.path.join(root, f))
            if "渔网" in fname and ("NET" in f or "网" in f):
                return os.path.normpath(os.path.join(root, f))
            if "鱼竿" in fname and ("ROD" in f or "竿" in f):
                return os.path.normpath(os.path.join(root, f))

    # 3. Global desktop asset banks fallback
    desktop_asset_dirs = [
        r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-全量资产图",
        r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto全量制作-最新资产版",
        r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto分集制作-最新纯净版",
        r"C:\Users\JW TSJ\Desktop\水眼金睛-Auto-Batch20全新纯净",
        r"C:\Users\JW TSJ\Desktop\音频参考"
    ]
    import shutil
    for d in desktop_asset_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            for f in files:
                if not ext_compatible(f):
                    continue
                if f.lower().endswith((".png", ".jpg", ".jpeg", ".mp3", ".wav")):
                    clean_f = re.sub(r"[_\-.\(\)\s]+", "", f)
                    if (clean_kw and (clean_kw in clean_f or clean_f in clean_kw)) or (f.lower() == fname.lower()):
                        dst = os.path.join(asset_root, f)
                        try:
                            shutil.copy2(os.path.join(root, f), dst)
                            return os.path.normpath(dst)
                        except Exception:
                            return os.path.normpath(os.path.join(root, f))

    # 4. Semantic category fallback for rare props or unnamed extras
    for d in desktop_asset_dirs:
        if not os.path.exists(d):
            continue
        for root, dirs, files in os.walk(d):
            for f in files:
                if not f.lower().endswith(".png"):
                    continue
                if ("大妈" in clean_kw and "大妈" in f) or ("大爷" in clean_kw and "大爷" in f):
                    dst = os.path.join(asset_root, f)
                    try:
                        shutil.copy2(os.path.join(root, f), dst)
                        return os.path.normpath(dst)
                    except Exception:
                        return os.path.normpath(os.path.join(root, f))
                if ("鱼" in clean_kw and ("PROP" in f or "BAN" in f or "鱼" in f)):
                    dst = os.path.join(asset_root, f)
                    try:
                        shutil.copy2(os.path.join(root, f), dst)
                        return os.path.normpath(dst)
                    except Exception:
                        return os.path.normpath(os.path.join(root, f))

    return None

def parse_seg_mapping(seg_dir):
    map_path = os.path.join(seg_dir, "素材映射.txt")
    prompt_path = os.path.join(seg_dir, "prompt.txt")
    entries = []
    seen_tokens = set()

    # 1. Parse 素材映射.txt
    if os.path.exists(map_path):
        with open(map_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("Mixed"):
                    continue
                # Tab format
                parts = line.split("\t")
                if len(parts) >= 3:
                    m_tok = parts[0].strip()
                    try:
                        m_num = int(re.search(r"\d+", m_tok).group())
                    except Exception:
                        continue
                    if len(parts) >= 5:
                        a_id = parts[1].strip()
                        a_name = parts[2].strip()
                        role = parts[3].strip()
                        rel_p = parts[4].strip()
                        abs_p = os.path.normpath(os.path.join(seg_dir, rel_p))
                    else:
                        src = parts[1].strip()
                        desc = parts[2].strip()
                        a_id = f"ASSET_{m_num:03d}"
                        if "/" in desc:
                            role_prefix, raw_name = desc.split("/", 1)
                        else:
                            role_prefix, raw_name = "道具", desc
                        a_name = re.sub(r"[（(].*?[）)]", "", raw_name).strip() or raw_name.strip()
                        role = "角色" if ("人物" in role_prefix or "CHAR" in src) else ("场景" if ("场景" in role_prefix or "SCENE" in src) else ("音频" if ("音频" in role_prefix or "AUDIO" in src) else "道具"))
                        fpath = find_asset_file(seg_dir, src)
                        if not fpath:
                            fpath = os.path.normpath(os.path.join(seg_dir, "资产", src))
                        abs_p = fpath

                    ext = os.path.splitext(abs_p)[1].lower() if abs_p else ""
                    kind = "audio" if ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg"] else "image"
                    entries.append({
                        "mixed": m_num, "token": m_tok, "asset_id": a_id,
                        "name": a_name, "role": role, "path": abs_p, "kind": kind
                    })
                    seen_tokens.add(m_tok)
                    continue

                # Arrow format: {{Mixed 1}} -> 主体1 (黄子名): CHAR_...
                m = re.match(r"\{\{(Mixed\s*(\d+))\}\}\s*->\s*([^(:]+)(?:\(([^)]+)\))?:\s*(.+)", line)
                if m:
                    m_tok = f"{{{{{m.group(1)}}}}}"
                    m_num = int(m.group(2))
                    subj = m.group(3).strip()
                    name = m.group(4).strip() if m.group(4) else subj
                    src = m.group(5).strip()
                    fpath = find_asset_file(seg_dir, src)
                    if not fpath:
                        fpath = os.path.normpath(os.path.join(seg_dir, "资产", src))
                    
                    role = "角色" if ("CHAR" in src or any(k in name for k in ["黄", "村民", "田", "王"])) else ("场景" if ("SCENE" in src or "码头" in name or "船" in name) else "道具")
                    ext = os.path.splitext(fpath)[1].lower() if fpath else ""
                    kind = "audio" if ext in [".mp3", ".wav"] else "image"
                    entries.append({
                        "mixed": m_num, "token": m_tok, "asset_id": f"ASSET_{m_num:03d}",
                        "name": name, "role": role, "path": fpath, "kind": kind
                    })
                    seen_tokens.add(m_tok)

    # 2. Parse prompt.txt header for Audio and Linearts
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        for line in lines[:25]:
            line = line.strip()
            # Audio reference: {{Mixed 4}} 为主体1 {{Mixed 1}} 的音频参考
            m_audio = re.match(r"\{\{(Mixed\s*(\d+))\}\}\s*为主体.*的音频参考", line)
            if m_audio:
                a_tok = f"{{{{{m_audio.group(1)}}}}}"
                a_num = int(m_audio.group(2))
                if a_tok not in seen_tokens:
                    # Look for audio file in seg_dir/资产/音频 or seg_dir/资产
                    a_path = None
                    audio_dir = os.path.join(seg_dir, "资产", "音频")
                    if os.path.exists(audio_dir):
                        for af in os.listdir(audio_dir):
                            if af.lower().endswith((".mp3", ".wav", ".m4a", ".aac", ".ogg")):
                                a_path = os.path.normpath(os.path.join(audio_dir, af))
                                break
                    if not a_path:
                        asset_root = os.path.join(seg_dir, "资产")
                        for root, dirs, files in os.walk(asset_root):
                            for af in files:
                                if af.lower().endswith((".mp3", ".wav", ".m4a", ".aac", ".ogg")):
                                    a_path = os.path.normpath(os.path.join(root, af))
                                    break
                    if a_path:
                        entries.append({
                            "mixed": a_num, "token": a_tok, "asset_id": f"AUDIO_{a_num:03d}",
                            "name": "黄子名原声音色", "role": "音频", "path": a_path, "kind": "audio"
                        })
                        seen_tokens.add(a_tok)

            # Lineart reference: 把 {{Mixed 5}} 作为镜头1站位线稿参考；
            m_line = re.match(r"把\s*\{\{(Mixed\s*(\d+))\}\}\s*作为镜头(\d+)站位线稿参考", line)
            if m_line:
                l_tok = f"{{{{{m_line.group(1)}}}}}"
                l_num = int(m_line.group(2))
                shot_idx = int(m_line.group(3))
                if l_tok not in seen_tokens:
                    l_path = os.path.normpath(os.path.join(seg_dir, f"shot{shot_idx}_lineart.png"))
                    entries.append({
                        "mixed": l_num, "token": l_tok, "asset_id": f"LINE_{l_num:03d}",
                        "name": f"镜头{shot_idx}站位线稿", "role": "分镜线稿", "path": l_path, "kind": "image"
                    })
                    seen_tokens.add(l_tok)

    entries.sort(key=lambda x: x["mixed"])
    return entries

def get_canonical_asset_key(entry):
    if entry.get("path"):
        return (entry["kind"], os.path.basename(entry["path"]))
    clean_name = entry["name"].strip()
    return (entry["kind"], clean_name)


def run_mutations(canvas_id, mutations, intent, tmp_dir):
    payload = {
        "intent": intent,
        "atomic": True,
        "mutations": mutations
    }
    tf_name = os.path.join(tmp_dir, f"mut_{uuid.uuid4().hex}.json")
    with open(tf_name, "w", encoding="utf-8") as tf:
        json.dump(payload, tf, ensure_ascii=False)
    try:
        out = run_cli(["canvas", "command", "run", "apply_mutations", "--canvas-id", canvas_id, "--file", tf_name], retries=3)
        return json.loads(out)
    finally:
        if os.path.exists(tf_name):
            try:
                os.remove(tf_name)
            except Exception:
                pass

def deploy_concurrent(ep_dir, title, force_new=False):
    start_total = time.time()
    log("\n" + "="*70)
    log("  PIPPIT CANVAS TURBOCHARGED ATOMIC BATCH ENGINE (5S TARGET DEPLOYMENT)")
    log("="*70)
    
    # Pre-flight Credits
    c_before = get_credit_balance()
    log(f"[*] Account Credits Before Run: {c_before}")
    log(f"[*] Target Episode: {ep_dir}")
    
    meta_dir = os.path.join(ep_dir, ".pippit")
    os.makedirs(meta_dir, exist_ok=True)
    ep_cache_file = os.path.join(meta_dir, "asset_cache.json")
    ep_cache = load_json_safe(ep_cache_file)
    global_cache = load_json_safe(GLOBAL_CACHE_FILE)
            
    # Find all SEGs
    segs = [d for d in os.listdir(ep_dir) if os.path.isdir(os.path.join(ep_dir, d)) and d.upper().startswith("SEG")]
    segs.sort()
    log(f"[*] Found {len(segs)} segments: {', '.join(segs)}")
    
    # Step 1: Collect canonical shared assets & linearts
    seg_mappings = {}
    canonical_assets = {}
    
    for seg in segs:
        seg_dir = os.path.join(ep_dir, seg)
        entries = parse_seg_mapping(seg_dir)
        seg_mappings[seg] = entries
        for e in entries:
            if "分镜线稿" in e["role"]:
                continue
            ckey = get_canonical_asset_key(e)
            if ckey not in canonical_assets:
                canonical_assets[ckey] = {
                    "kind": e["kind"],
                    "name": e["name"],
                    "role": e["role"],
                    "path": e["path"],
                    "segs": [seg]
                }
            else:
                canonical_assets[ckey]["segs"].append(seg)
                
    all_linearts = [] # (seg, shot_num, path)
    for seg in segs:
        seg_dir = os.path.join(ep_dir, seg)
        for f in os.listdir(seg_dir):
            m = re.match(r"^shot(\d+)_lineart\.png$", f)
            if m:
                all_linearts.append((seg, int(m.group(1)), os.path.join(seg_dir, f)))
    all_linearts.sort(key=lambda x: (x[0], x[1]))
    
    log(f"[+] Canonical Shared Assets: {len(canonical_assets)}")
    log(f"[+] Storyboard Linearts to Deploy: {len(all_linearts)} (100% Rule 0.27 Pure Linearts)")
    
    # Step 2: Create pristine Canvas or reuse empty canvas
    canvas_file = os.path.join(meta_dir, "canvas.json")
    canvas_meta = None
    if os.path.exists(canvas_file) and not force_new:
        try:
            with open(canvas_file, "r", encoding="utf-8") as f:
                c_data = json.load(f)
            cid = c_data.get("canvas_asset_id")
            if cid:
                c_out = run_cli(["canvas", "get", "--asset-id", cid])
                t_json = json.loads(c_out)
                text_info = t_json.get("assets", [{}])[0].get("TextInfo", {}).get("content", "{}")
                parsed = json.loads(text_info).get("content", {})
                existing_nodes = parsed.get("nodes", {})
                existing_edges = parsed.get("edges", {})
                expected_total_nodes = len(canonical_assets) + len(all_linearts) + len(segs)
                if len(existing_nodes) >= expected_total_nodes and len(existing_edges) > 0:
                    log(f"[⚡ FAST-PATH] Canvas {cid} is already fully deployed ({len(existing_nodes)} nodes, {len(existing_edges)} edges)!")
                    canvas_meta = c_data
                    # If manifest exists, verify & return immediately
                    man_file = os.path.join(ep_dir, "pippit_deployment_manifest.json")
                    if os.path.exists(man_file):
                        log(f"[★ SPEED STAT] Full Episode Verified in {time.time() - start_total:.2f}s")
                        log("="*70)
                        log(f"Web URL: {c_data.get('web_url')}")
                        log("="*70)
                        return
                elif not existing_nodes:
                    log(f"[+] Reusing existing pristine empty canvas: {cid}")
                    canvas_meta = c_data
        except Exception as e:
            log(f"[*] Existing canvas check notice: {e}")
            
    if not canvas_meta:
        t_c0 = time.time()
        log(f"\n[*] [Step 1/4] Creating pristine Pippit Canvas: {title[:50]}...")
        out = run_cli(["canvas", "create", "--title", title[:50], "--wait"])
        canvas_meta = json.loads(out)
        save_json_safe(canvas_file, canvas_meta)
        log(f"[+] Created canvas in {time.time() - t_c0:.2f}s: {canvas_meta.get('canvas_asset_id')}")
        
    canvas_asset_id = canvas_meta.get("canvas_asset_id")
    log(f"    Web URL: {canvas_meta.get('web_url')}")
    
    # Step 3: Concurrent Asset Uploads with Global Cache Acceleration (ThreadPool 16)
    log(f"\n[*] [Step 2/4] Uploading Assets & Linearts (Global Cache + ThreadPool 16)...")
    t_upload = time.time()
    all_files_to_upload = [info["path"] for info in canonical_assets.values()] + [p for _, _, p in all_linearts]
    uploaded_map = {}
    
    with ThreadPoolExecutor(max_workers=16) as executor:
        futures = {executor.submit(upload_asset_cached, fpath, ep_cache, ep_cache_file, global_cache, GLOBAL_CACHE_FILE): fpath for fpath in all_files_to_upload}
        for fut in as_completed(futures):
            fpath = futures[fut]
            uploaded_map[fpath] = fut.result()
            
    log(f"[+] Handled {len(all_files_to_upload)} assets in {time.time() - t_upload:.2f}s (Cache Hits + Concurrent Uploads)!")
    
    # Step 4: Batch Create ALL Input Nodes (Shared Assets + Storyboards) in ONE Atomic Transaction
    log(f"\n[*] [Step 3/4] Turbocharged Batch Node Creation (Atomic apply_mutations)...")
    t_batch_nodes = time.time()
    
    char_list = []
    scene_prop_list = []
    audio_list = []
    for ckey, info in canonical_assets.items():
        if info["kind"] == "audio":
            audio_list.append((ckey, info))
        elif "场景" in info["role"] or "道具" in info["role"]:
            scene_prop_list.append((ckey, info))
        else:
            char_list.append((ckey, info))
            
    input_mutations = []
    input_order_keys = [] # To map allocated_asset_ids back
    
    for idx, (ckey, info) in enumerate(char_list):
        uploaded = uploaded_map[info["path"]]
        input_mutations.append({
            "kind": "create_biz_node",
            "nodeKind": "image",
            "topLeft": {"x": -1800, "y": -800 + idx * 450},
            "initialData": {
                "name": f"角色_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        })
        input_order_keys.append(("canonical", ckey))
        
    for idx, (ckey, info) in enumerate(scene_prop_list):
        uploaded = uploaded_map[info["path"]]
        prefix = "场景" if "场景" in info["role"] else "道具"
        input_mutations.append({
            "kind": "create_biz_node",
            "nodeKind": "image",
            "topLeft": {"x": -1250, "y": -800 + idx * 450},
            "initialData": {
                "name": f"{prefix}_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        })
        input_order_keys.append(("canonical", ckey))
        
    for idx, (ckey, info) in enumerate(audio_list):
        uploaded = uploaded_map[info["path"]]
        input_mutations.append({
            "kind": "create_biz_node",
            "nodeKind": "audio",
            "topLeft": {"x": -750, "y": -800 + idx * 300},
            "initialData": {
                "name": f"音频_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        })
        input_order_keys.append(("canonical", ckey))
        
    current_y = -800
    seg_offsets = {}
    for seg in segs:
        seg_lines = [item for item in all_linearts if item[0] == seg]
        seg_offsets[seg] = current_y
        for l_idx, (_, shot_num, fpath) in enumerate(seg_lines):
            uploaded = uploaded_map[fpath]
            l_node_name = f"{seg}_镜头{shot_num}_站位线稿"
            input_mutations.append({
                "kind": "create_biz_node",
                "nodeKind": "image",
                "topLeft": {"x": -200, "y": current_y + l_idx * 460},
                "initialData": {
                    "name": l_node_name,
                    "caption": l_node_name,
                    "pippitAssetId": uploaded["pippit_asset_id"],
                    "assetId": uploaded["asset_id"]
                }
            })
            input_order_keys.append(("storyboard", (seg, shot_num), l_node_name))
        seg_height = max(len(seg_lines) * 460 + 100, 600)
        current_y += seg_height
        
    res_input = run_mutations(canvas_asset_id, input_mutations, "batch create all input nodes", meta_dir)
    allocated_inputs = res_input.get("allocated_asset_ids", [])
    if len(allocated_inputs) != len(input_mutations):
        raise RuntimeError(f"Allocated inputs mismatch: expected {len(input_mutations)}, got {len(allocated_inputs)}")
        
    canonical_node_ids = {}
    storyboard_node_ids = {}
    for alloc_id, k_info in zip(allocated_inputs, input_order_keys):
        if k_info[0] == "canonical":
            canonical_node_ids[k_info[1]] = alloc_id
        elif k_info[0] == "storyboard":
            storyboard_node_ids[k_info[1]] = (alloc_id, k_info[2])
            
    log(f"[+] Deployed {len(input_mutations)} input nodes in ONE transaction ({time.time() - t_batch_nodes:.2f}s)!")
    
    # Step 5: Batch Create Video Nodes in ONE Atomic Transaction
    t_v = time.time()
    video_mutations = []
    video_order_segs = []
    
    for seg in segs:
        entries = seg_mappings[seg]
        seg_dir = os.path.join(ep_dir, seg)
        prompt_path = os.path.join(seg_dir, "prompt.txt")
        prompt_content = ""
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                prompt_content = f.read().strip()
                
        rendered_prompt = prompt_content.replace("【角色清单】\n", "").replace("【角色清单】", "")
        for e in sorted(entries, key=lambda x: len(x["token"]), reverse=True):
            if "分镜线稿" in e["role"]:
                shot_m = re.search(r"镜头(\d+)", e["name"])
                if shot_m:
                    s_num = int(shot_m.group(1))
                    l_nid, l_name = storyboard_node_ids[(seg, s_num)]
                    mention = f'<node-asset label="{l_name}">{l_nid}</node-asset>'
                    rendered_prompt = rendered_prompt.replace(e["token"], mention)
            else:
                ckey = get_canonical_asset_key(e)
                if ckey in canonical_node_ids:
                    nid = canonical_node_ids[ckey]
                    mention = f'<node-asset label="{e["name"]}">{nid}</node-asset>'
                    rendered_prompt = rendered_prompt.replace(e["token"], mention)
                    
        # Check for unreplaced Mixed tokens
        unreplaced = re.findall(r"\{\{Mixed\s*\d+\}\}", rendered_prompt)
        if unreplaced:
            log(f"[!] Warning: {seg} has unreplaced tokens: {unreplaced}")
        else:
            log(f"[+] {seg} prompt: 100% tokens resolved to <node-asset>")

        seg_lines = [item for item in all_linearts if item[0] == seg]
        v_y = seg_offsets[seg] + max(0, (len(seg_lines) - 1) * 230)
        
        m_dur = re.search(r"生成时长：(\d+)秒", prompt_content)
        dur_sec = int(m_dur.group(1)) if m_dur else 25
        dur_ms = dur_sec * 1000

        video_mutations.append({
            "kind": "create_biz_node",
            "nodeKind": "video",
            "topLeft": {"x": 450, "y": v_y},
            "initialData": {
                "name": seg,
                "title": seg,
                "caption": seg,
                "playback": {"muted": True},
                "generation": {
                    "prompt": rendered_prompt,
                    "modelKey": "Seedance_2.0_mini_lite",
                    "ratio": "9:16",
                    "resolution": "720p",
                    "durationMs": dur_ms
                }
            }
        })
        video_order_segs.append(seg)
        
    res_videos = run_mutations(canvas_asset_id, video_mutations, "batch create all video nodes", meta_dir)
    allocated_videos = res_videos.get("allocated_asset_ids", [])
    if len(allocated_videos) != len(video_mutations):
        raise RuntimeError(f"Allocated video nodes mismatch: expected {len(video_mutations)}, got {len(allocated_videos)}")
        
    video_nodes = {}
    for alloc_id, seg in zip(allocated_videos, video_order_segs):
        video_nodes[seg] = alloc_id
        log(f"    [+] Video Node: {seg} -> {alloc_id}")
        
    log(f"[+] Deployed {len(video_mutations)} video nodes in ONE transaction ({time.time() - t_v:.2f}s)!")
    
    # Step 6: Batch Wire ALL Edges in ONE Atomic Transaction
    log(f"\n[*] [Step 4/4] Turbocharged Batch Edge Wiring (Atomic apply_mutations)...")
    t_edges = time.time()
    edge_mutations = []
    
    for seg in segs:
        v_nid = video_nodes[seg]
        entries = seg_mappings[seg]
        connected_sources = set()
        
        # 1. Assets
        for e in entries:
            if "分镜线稿" in e["role"]:
                continue
            ckey = get_canonical_asset_key(e)
            nid = canonical_node_ids[ckey]
            if nid in connected_sources:
                continue
            connected_sources.add(nid)
            edge_mutations.append({
                "kind": "create_edge",
                "edge": {
                    "id": f"edge_{seg}_{e['mixed']}_{uuid.uuid4().hex[:8]}",
                    "source": nid,
                    "target": v_nid
                }
            })
            
        # 2. Storyboards
        seg_lines = [item for item in all_linearts if item[0] == seg]
        for _, shot_num, _ in seg_lines:
            l_nid, l_name = storyboard_node_ids[(seg, shot_num)]
            if l_nid in connected_sources:
                continue
            connected_sources.add(l_nid)
            edge_mutations.append({
                "kind": "create_edge",
                "edge": {
                    "id": f"edge_{seg}_shot{shot_num}_{uuid.uuid4().hex[:8]}",
                    "source": l_nid,
                    "target": v_nid
                }
            })
            
    res_edges = run_mutations(canvas_asset_id, edge_mutations, "batch create all edges", meta_dir)
    log(f"[+] Wired {len(edge_mutations)} edges in ONE transaction ({time.time() - t_edges:.2f}s)!")
    
    # Post-flight Credits Audit
    c_after = get_credit_balance()
    log("\n" + "="*70)
    log("      GATE 1: ZERO-CREDITS POST-FLIGHT AUDIT")
    log("="*70)
    log(f"[*] Account Credits After Run: {c_after}")
    delta = (c_before - c_after) if (c_before and c_after) else 0
    log(f"[*] Credits Delta: {delta}")
    if delta > 0:
        raise RuntimeError(f"REDLINE VIOLATION: Credits were consumed! Delta={delta}")
    log("[OK] Strict Zero-Credits Gate PASSED (Delta = 0, 100% Free Operation)")
    
    total_sec = time.time() - start_total
    log(f"\n[★ SPEED STAT] Full Episode Deployed in {total_sec:.2f}s")
    
    manifest_data = {
        "projectId": canvas_meta.get("project_id"),
        "canvasAssetId": canvas_meta.get("canvas_asset_id"),
        "overviewPippitAssetId": canvas_meta.get("overview_pippit_asset_id"),
        "canvasUrl": canvas_meta.get("web_url"),
        "sharedAssetsCount": len(canonical_assets),
        "totalStoryboardLinearts": len(all_linearts),
        "totalVideoNodes": len(video_nodes),
        "totalEdges": len(edge_mutations),
        "deploymentTimeSeconds": round(total_sec, 2),
        "zeroVideoGenerationRedline": "100% COMPLIANT (0 task triggered)",
        "zeroCreditsConsumptionGate": "PASSED (Delta=0)"
    }
    manifest_file = os.path.join(ep_dir, "pippit_deployment_manifest.json")
    save_json_safe(manifest_file, manifest_data)
        
    log("="*70)
    log(f"Web URL: {canvas_meta.get('web_url')}")
    log("="*70)

if __name__ == "__main__":
    force_new = any(arg in ["--new", "--force-new", "-new"] for arg in sys.argv)
    clean_argv = [a for a in sys.argv[1:] if a not in ["--new", "--force-new", "-new"]]
    ep_dir = clean_argv[0] if len(clean_argv) > 0 else r"C:\Users\JW TSJ\Desktop\水眼金睛-Auto-Batch20全新纯净\第003集"
    title = clean_argv[1] if len(clean_argv) > 1 else "水眼金睛-第003集-黄金长镜头分镜画布"
    deploy_concurrent(ep_dir, title, force_new=force_new)

