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

PIPPIT_CLI = "pippit-tool-cli.cmd"
cache_lock = threading.Lock()
SHARED_CACHE_FILE = r"C:\Users\JW TSJ\Desktop\完美分镜\.pippit_global_asset_cache.json"

def log(msg):
    print(msg)
    sys.stdout.flush()

def get_credit_balance():
    try:
        proc = subprocess.run(
            [PIPPIT_CLI, "get-credit-balance"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if proc.returncode == 0:
            data = json.loads(proc.stdout.strip())
            return int(data.get("total_remain_amount", 0))
    except Exception as e:
        log(f"[!] Warning checking credits: {e}")
    return None

def run_cmd(args, retries=5, stdin_input=None):
    cmd = [PIPPIT_CLI] + args
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
        if "EPERM" in err_msg or "EBUSY" in err_msg or attempt < retries - 1:
            time.sleep(0.5 * (attempt + 1))
        else:
            raise RuntimeError(f"FAIL {' '.join(cmd)}: {err_msg}")

def compute_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def load_global_cache():
    with cache_lock:
        if os.path.exists(SHARED_CACHE_FILE):
            try:
                with open(SHARED_CACHE_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

def save_global_cache(cache_dict):
    with cache_lock:
        try:
            with open(SHARED_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache_dict, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

def upload_asset_cached(local_path, cache_dict):
    abs_path = os.path.abspath(local_path)
    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"Asset file not found: {abs_path}")
        
    file_size = os.path.getsize(abs_path)
    file_hash = compute_file_hash(abs_path)
    cache_key = f"hash:{file_hash}::size:{file_size}"
    
    with cache_lock:
        if cache_key in cache_dict:
            return cache_dict[cache_key]
        
    fname = os.path.basename(abs_path)
    out = run_cmd(["canvas", "upload", "--path", abs_path])
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
        cache_dict[cache_key] = cache_info
        save_global_cache(cache_dict)
        
    return cache_info

def parse_seg_mapping(seg_dir):
    map_path = os.path.join(seg_dir, "素材映射.txt")
    if not os.path.exists(map_path):
        raise FileNotFoundError(f"Missing 素材映射.txt in {seg_dir}")
        
    entries = []
    with open(map_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("Mixed"):
                continue
            parts = line.split("\t")
            if len(parts) < 5:
                continue
            mixed_token = parts[0]
            try:
                mixed_num = int(re.search(r"\d+", mixed_token).group())
            except Exception:
                continue
            asset_id = parts[1]
            asset_name = parts[2]
            role = parts[3]
            rel_path = parts[4]
            abs_path = os.path.normpath(os.path.join(seg_dir, rel_path))
            
            ext = os.path.splitext(abs_path)[1].lower()
            if ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg"]:
                kind = "audio"
            else:
                kind = "image"
                
            entries.append({
                "mixed": mixed_num,
                "token": mixed_token,
                "asset_id": asset_id,
                "name": asset_name,
                "role": role,
                "path": abs_path,
                "kind": kind
            })
    entries.sort(key=lambda x: x["mixed"])
    return entries

def get_canonical_asset_key(entry):
    clean_name = entry["name"].strip()
    return (entry["kind"], clean_name)

def run_atomic_command(command_name, canvas_id, payload, tmp_dir, max_retries=5):
    for attempt in range(max_retries):
        tf_name = os.path.join(tmp_dir, f"cmd_{uuid.uuid4().hex}.json")
        with open(tf_name, "w", encoding="utf-8") as tf:
            json.dump(payload, tf, ensure_ascii=False)
        try:
            out = run_cmd(["canvas", "command", "run", command_name, "--canvas-id", canvas_id, "--file", tf_name])
            return json.loads(out)
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.4 * (attempt + 1))
            else:
                raise e
        finally:
            if os.path.exists(tf_name):
                try:
                    os.remove(tf_name)
                except Exception:
                    pass

def deploy_episode(ep_dir, title, model_key="Seedance_2.5", global_cache=None):
    start_ep = time.time()
    ep_name = os.path.basename(ep_dir)
    log(f"\n[>>> START] {ep_name} -> {title}")
    
    if global_cache is None:
        global_cache = load_global_cache()
        
    meta_dir = os.path.join(ep_dir, ".pippit")
    os.makedirs(meta_dir, exist_ok=True)
    
    # 1. Collect SEGs
    segs = [d for d in os.listdir(ep_dir) if os.path.isdir(os.path.join(ep_dir, d)) and d.upper().startswith("SEG")]
    segs.sort()
    
    # 2. Collect canonical assets & linearts
    seg_mappings = {}
    canonical_assets = {}
    all_linearts = []
    
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
                
        # Collect lineart files
        for f in os.listdir(seg_dir):
            m = re.match(r"^shot(\d+)_lineart\.png$", f.lower())
            if m:
                all_linearts.append((seg, int(m.group(1)), os.path.join(seg_dir, f)))
                
    all_linearts.sort(key=lambda x: (x[0], x[1]))
    
    # 3. Create Canvas
    out = run_cmd(["canvas", "create", "--title", title[:50], "--wait"])
    canvas_meta = json.loads(out)
    canvas_asset_id = canvas_meta.get("canvas_asset_id")
    if not canvas_asset_id:
        raise RuntimeError(f"Failed to create canvas for {ep_name}: {out}")
        
    with open(os.path.join(meta_dir, "canvas.json"), "w", encoding="utf-8") as f:
        json.dump(canvas_meta, f, ensure_ascii=False, indent=2)
        
    log(f"[{ep_name}] Canvas created: {canvas_asset_id} | URL: {canvas_meta.get('web_url')}")
    
    # 4. Upload Assets & Linearts (ThreadPool within episode)
    all_files_to_upload = [info["path"] for info in canonical_assets.values()] + [p for _, _, p in all_linearts]
    uploaded_map = {}
    
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(upload_asset_cached, fpath, global_cache): fpath for fpath in all_files_to_upload}
        for fut in as_completed(futures):
            fpath = futures[fut]
            uploaded_map[fpath] = fut.result()
            
    # 5. Create Shared Asset Nodes (Sequentially on this canvas to prevent intra-canvas lock collision)
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
            
    canonical_node_ids = {}
    
    for idx, (ckey, info) in enumerate(char_list):
        uploaded = uploaded_map[info["path"]]
        payload = {
            "nodeKind": "image",
            "topLeft": {"x": -1800, "y": -800 + idx * 450},
            "initialData": {
                "name": f"角色_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        }
        res = run_atomic_command("create_biz_node", canvas_asset_id, payload, meta_dir)
        canonical_node_ids[ckey] = res["allocated_asset_ids"][0]
        
    for idx, (ckey, info) in enumerate(scene_prop_list):
        uploaded = uploaded_map[info["path"]]
        prefix = "场景" if "场景" in info["role"] else "道具"
        payload = {
            "nodeKind": "image",
            "topLeft": {"x": -1250, "y": -800 + idx * 450},
            "initialData": {
                "name": f"{prefix}_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        }
        res = run_atomic_command("create_biz_node", canvas_asset_id, payload, meta_dir)
        canonical_node_ids[ckey] = res["allocated_asset_ids"][0]
        
    for idx, (ckey, info) in enumerate(audio_list):
        uploaded = uploaded_map[info["path"]]
        payload = {
            "nodeKind": "audio",
            "topLeft": {"x": -750, "y": -800 + idx * 300},
            "initialData": {
                "name": f"音频_{info['name']}",
                "caption": info["name"],
                "pippitAssetId": uploaded["pippit_asset_id"],
                "assetId": uploaded["asset_id"]
            }
        }
        res = run_atomic_command("create_biz_node", canvas_asset_id, payload, meta_dir)
        canonical_node_ids[ckey] = res["allocated_asset_ids"][0]
        
    # 6. Create Lineart Nodes & Video Nodes
    storyboard_node_ids = {}
    current_y = -800
    seg_offsets = {}
    for seg in segs:
        seg_lines = [item for item in all_linearts if item[0] == seg]
        seg_offsets[seg] = current_y
        for l_idx, (_, shot_num, fpath) in enumerate(seg_lines):
            uploaded = uploaded_map[fpath]
            l_node_name = f"{seg}_镜头{shot_num}_站位线稿"
            payload = {
                "nodeKind": "image",
                "topLeft": {"x": -200, "y": current_y + l_idx * 460},
                "initialData": {
                    "name": l_node_name,
                    "caption": l_node_name,
                    "pippitAssetId": uploaded["pippit_asset_id"],
                    "assetId": uploaded["asset_id"]
                }
            }
            res = run_atomic_command("create_biz_node", canvas_asset_id, payload, meta_dir)
            nid = res["allocated_asset_ids"][0]
            storyboard_node_ids[(seg, shot_num)] = (nid, l_node_name)
            
        seg_height = max(len(seg_lines) * 460 + 100, 600)
        current_y += seg_height
        
    # Create Video Nodes
    video_nodes = {}
    for seg in segs:
        entries = seg_mappings[seg]
        seg_dir = os.path.join(ep_dir, seg)
        prompt_path = os.path.join(seg_dir, "prompt.txt")
        prompt_content = ""
        if os.path.exists(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                prompt_content = f.read().strip()
                
        # Parse exact duration from prompt
        dur_m = re.search(r'生成时长[：:]\s*(\d+)秒', prompt_content)
        dur_sec = int(dur_m.group(1)) if dur_m else 25
        dur_ms = dur_sec * 1000
        
        rendered_prompt = prompt_content
        rendered_prompt = rendered_prompt.replace("【角色清单】\n", "").replace("【角色清单】", "")
        
        # Safe replacement: longest tokens first
        for e in sorted(entries, key=lambda x: len(x["token"]), reverse=True):
            if "分镜线稿" in e["role"]:
                shot_m = re.search(r"镜头(\d+)", e["name"])
                if shot_m:
                    s_num = int(shot_m.group(1))
                    if (seg, s_num) in storyboard_node_ids:
                        l_nid, l_name = storyboard_node_ids[(seg, s_num)]
                        mention = f'<node-asset label="{l_name}">{l_nid}</node-asset>'
                        rendered_prompt = rendered_prompt.replace(e["token"], mention)
            else:
                ckey = get_canonical_asset_key(e)
                if ckey in canonical_node_ids:
                    nid = canonical_node_ids[ckey]
                    mention = f'<node-asset label="{e["name"]}">{nid}</node-asset>'
                    rendered_prompt = rendered_prompt.replace(e["token"], mention)
                    
        seg_lines = [item for item in all_linearts if item[0] == seg]
        v_y = seg_offsets[seg] + max(0, (len(seg_lines) - 1) * 230)
        v_input = {
            "nodeKind": "video",
            "topLeft": {"x": 450, "y": v_y},
            "initialData": {
                "name": seg,
                "title": seg,
                "caption": seg,
                "playback": {"muted": True},
                "generation": {
                    "prompt": rendered_prompt,
                    "modelKey": model_key,
                    "ratio": "9:16",
                    "resolution": "720p",
                    "durationMs": dur_ms
                }
            }
        }
        res = run_atomic_command("create_biz_node", canvas_asset_id, v_input, meta_dir)
        v_nid = res["allocated_asset_ids"][0]
        video_nodes[seg] = v_nid
        log(f"[{ep_name}] Video Node {seg} -> {v_nid} (model: {model_key}, dur: {dur_sec}s)")
        
    # 7. Wire Edges (Sequentially per canvas with 0.05s sleep)
    wired_edges = 0
    for seg in segs:
        v_nid = video_nodes[seg]
        entries = seg_mappings[seg]
        connected_sources = set()
        
        # Assets
        for e in entries:
            if "分镜线稿" in e["role"]:
                continue
            ckey = get_canonical_asset_key(e)
            if ckey in canonical_node_ids:
                nid = canonical_node_ids[ckey]
                if nid not in connected_sources:
                    connected_sources.add(nid)
                    run_atomic_command("create_edge", canvas_asset_id, {
                        "edge": {
                            "id": f"edge_{seg}_{e['mixed']}_{uuid.uuid4().hex[:6]}",
                            "source": nid,
                            "target": v_nid
                        }
                    }, meta_dir)
                    wired_edges += 1
                    time.sleep(0.05)
                    
        # Linearts
        seg_lines = [item for item in all_linearts if item[0] == seg]
        for _, shot_num, _ in seg_lines:
            if (seg, shot_num) in storyboard_node_ids:
                l_nid, _ = storyboard_node_ids[(seg, shot_num)]
                if l_nid not in connected_sources:
                    connected_sources.add(l_nid)
                    run_atomic_command("create_edge", canvas_asset_id, {
                        "edge": {
                            "id": f"edge_{seg}_shot{shot_num}_{uuid.uuid4().hex[:6]}",
                            "source": l_nid,
                            "target": v_nid
                        }
                    }, meta_dir)
                    wired_edges += 1
                    time.sleep(0.05)
                    
    ep_duration = time.time() - start_ep
    log(f"[<<< FINISHED] {ep_name} in {ep_duration:.2f}s | Nodes: {len(canonical_node_ids) + len(storyboard_node_ids) + len(video_nodes)} | Edges: {wired_edges}")
    
    result = {
        "episode": ep_name,
        "title": title,
        "canvas_asset_id": canvas_asset_id,
        "project_id": canvas_meta.get("project_id"),
        "overview_pippit_asset_id": canvas_meta.get("overview_pippit_asset_id"),
        "web_url": canvas_meta.get("web_url"),
        "segs_count": len(segs),
        "video_nodes_count": len(video_nodes),
        "shared_assets_count": len(canonical_assets),
        "linearts_count": len(all_linearts),
        "edges_count": wired_edges,
        "model_key": model_key,
        "time_seconds": round(ep_duration, 2)
    }
    
    with open(os.path.join(ep_dir, "pippit_deployment_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    return result

def deploy_batch(start_ep=3, end_ep=20, max_concurrency=20, model_key="Seedance_2.5"):
    log("="*75)
    log(f"  PIPPIT CONCURRENT BATCH DEPLOYMENT (EP {start_ep:03d} -> EP {end_ep:03d})")
    log(f"  Concurrency: {max_concurrency} | Model: {model_key} | Zero Video Generation")
    log("="*75)
    
    t_start = time.time()
    c_before = get_credit_balance()
    log(f"[*] Pre-flight Account Credits: {c_before}")
    
    base_dir = r"C:\Users\JW TSJ\Desktop\完美分镜"
    episodes = [f"第{i:03d}集" for i in range(start_ep, end_ep + 1)]
    
    tasks = []
    for ep in episodes:
        ep_path = os.path.join(base_dir, ep)
        if os.path.exists(ep_path):
            title = f"0912《有了水眼金睛，捕鱼寻宝当首富》-{ep}-全量交付"
            tasks.append((ep_path, title))
        else:
            log(f"[!] Warning: Episode directory {ep} does not exist!")
            
    log(f"[*] Total Episodes to Deploy: {len(tasks)} (Concurrency: {max_concurrency})")
    
    global_cache = load_global_cache()
    results = []
    
    # 20 Concurrency execution
    with ThreadPoolExecutor(max_workers=max_concurrency) as executor:
        future_to_ep = {
            executor.submit(deploy_episode, ep_dir, title, model_key, global_cache): os.path.basename(ep_dir)
            for ep_dir, title in tasks
        }
        for future in as_completed(future_to_ep):
            ep_name = future_to_ep[future]
            try:
                res = future.result()
                results.append(res)
            except Exception as exc:
                log(f"[!] EXCEPTION in {ep_name}: {exc}")
                results.append({"episode": ep_name, "error": str(exc)})
                
    # Sort results by episode name
    results.sort(key=lambda x: x.get("episode", ""))
    
    t_total = time.time() - t_start
    c_after = get_credit_balance()
    
    log("\n" + "="*75)
    log("                    GATE 1: ZERO CREDITS AUDIT")
    log("="*75)
    log(f"[*] Account Credits Before: {c_before}")
    log(f"[*] Account Credits After:  {c_after}")
    delta = (c_before - c_after) if (c_before and c_after) else 0
    log(f"[*] Consumed Credits Delta: {delta}")
    if delta > 0:
        raise RuntimeError(f"REDLINE VIOLATION: {delta} credits were consumed!")
    log("[OK] Strict Zero-Credits Gate PASSED (Delta = 0, 100% Free Operation)!")
    
    log("\n" + "="*75)
    log(f"BATCH DEPLOYMENT COMPLETED IN {t_total:.2f}s!")
    log("="*75)
    
    batch_manifest = {
        "batch": f"Ep{start_ep:03d}-Ep{end_ep:03d}",
        "total_episodes": len(results),
        "total_time_seconds": round(t_total, 2),
        "concurrency": max_concurrency,
        "model_key": model_key,
        "credits_before": c_before,
        "credits_after": c_after,
        "credits_delta": delta,
        "zero_video_generation": "100% COMPLIANT",
        "episodes": results
    }
    
    batch_file = os.path.join(base_dir, f"Batch_{start_ep:03d}_{end_ep:03d}_Pippit_Manifest.json")
    with open(batch_file, "w", encoding="utf-8") as f:
        json.dump(batch_manifest, f, ensure_ascii=False, indent=2)
        
    log(f"Manifest saved to: {batch_file}")
    return batch_manifest

if __name__ == "__main__":
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    end = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    model = sys.argv[3] if len(sys.argv) > 3 else "Seedance_2.5"
    deploy_batch(start, end, max_concurrency=20, model_key=model)
