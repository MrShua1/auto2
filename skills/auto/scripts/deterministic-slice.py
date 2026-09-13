#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
确定性剧本切片工具 (Deterministic Docx Slicer & Acoustic Dynamic Partitioner)
版本: v2.0.1
从权威 docx 底本直接进行确定性物理切片，集成数学声学前置测算引擎，
根据对白字数与动作物理耗时动态分配最佳 SEG 数量，
写入各分集的 script-source.txt、acoustic-profile.json 与各 SEG 的 script-verbatim.txt。
绝对严禁任何大模型介入转述、改写、脑补或压缩！
"""

import os
import re
import sys
import json
import zipfile
import argparse
import xml.etree.ElementTree as ET

# Force UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

DOCX_DEFAULT = r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》剧本1-300集.docx"
OUTPUT_ROOT_DEFAULT = r"C:\Users\JW TSJ\Desktop\完美分镜"

# 动态加载数学声学前置测算模块
try:
    from acoustic_precompute import compute_acoustic_profile
except ImportError:
    import importlib.util
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    target_script = os.path.join(scripts_dir, "acoustic_precompute.py")
    if not os.path.exists(target_script):
        target_script = os.path.join(scripts_dir, "acoustic-precompute.py")
    if os.path.exists(target_script):
        spec = importlib.util.spec_from_file_location("acoustic_precompute", target_script)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        compute_acoustic_profile = mod.compute_acoustic_profile
    else:
        compute_acoustic_profile = None

def extract_docx_episodes(docx_path):
    if not os.path.exists(docx_path):
        raise FileNotFoundError(f"未找到权威剧本底本: {docx_path}")
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml")
    tree = ET.fromstring(xml_content)
    namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []
    for p in tree.iterfind(".//w:p", namespaces):
        texts = [t.text for t in p.iterfind(".//w:t", namespaces) if t.text]
        if texts:
            line = "".join(texts).strip()
            if line:
                paragraphs.append(line)
    full_text = "\n".join(paragraphs)
    splits = re.split(r"\n(?=第\d+集)", full_text)
    episodes_map = {}
    for seg in splits:
        seg = seg.strip()
        if not seg:
            continue
        first_line = seg.split("\n", 1)[0].strip()
        m = re.match(r"第(\d+)集", first_line)
        if m:
            episodes_map[int(m.group(1))] = seg
    return episodes_map

def partition_episode(lines, num_segs):
    r"""
    通用动态规划（DP）剧本切片算法：
    将 lines 平滑切分为 num_segs 个片段，智能优先吸附于：
    1. 场景切换标头 (^\d+-\d+ 或 日/夜 内/外) -> 最高权重
    2. 动作行 (△ 或 ▲) -> 次高权重
    3. 对白开始行 (说话人：) -> 中等权重
    绝不在对白中途或动作句子中生硬截断，确保 100% 逐字覆盖。
    """
    n = len(lines)
    if num_segs <= 1 or n <= num_segs:
        return [lines]
        
    ideal_len = n / num_segs
    
    def get_boundary_score(i):
        line = lines[i]
        # 最高优先级：场景切分点
        if re.match(r"^\d+-\d+", line) or (("日" in line or "夜" in line) and ("内" in line or "外" in line)):
            return 100.0
        # 高优先级：△ 动作指示
        if line.startswith("△") or line.startswith("▲"):
            return 40.0
        # 中优先级：说话人起头
        if re.match(r"^([^\s：:（\(]+)\s*[：:]", line):
            return 15.0
        return 0.0

    dp = {}
    parent = {}
    
    for i in range(1, n + 1):
        cost = (i - ideal_len) ** 2
        dp[(1, i)] = cost
        
    for k in range(2, num_segs + 1):
        for i in range(k, n + 1):
            best_cost = float("inf")
            best_prev = -1
            min_prev = max(k - 1, int(i - ideal_len * 2.2))
            max_prev = min(i - 1, int(i - ideal_len * 0.4) + 1)
            if min_prev > max_prev:
                min_prev = k - 1
                max_prev = i - 1
            for p in range(min_prev, max_prev + 1):
                if (k - 1, p) not in dp:
                    continue
                seg_len = i - p
                b_score = get_boundary_score(p)
                seg_cost = ((seg_len - ideal_len) ** 2) * 1.5 - b_score * 12.0
                total_cost = dp[(k - 1, p)] + seg_cost
                if total_cost < best_cost:
                    best_cost = total_cost
                    best_prev = p
            if best_prev != -1:
                dp[(k, i)] = best_cost
                parent[(k, i)] = best_prev
                
    curr = n
    cuts = []
    for k in range(num_segs, 1, -1):
        p = parent.get((k, curr))
        if p is None:
            p = max(1, curr - int(ideal_len))
        cuts.append(p)
        curr = p
    cuts.reverse()
    
    chunks = []
    last = 0
    for c in cuts:
        chunks.append(lines[last:c])
        last = c
    chunks.append(lines[last:])
    return chunks

def slice_episode(ep_num, ep_raw, ep_dir, target_segs=None, force_recompute=False):
    os.makedirs(ep_dir, exist_ok=True)
    lines = [l.strip() for l in ep_raw.splitlines() if l.strip()]
    content_lines = lines[1:] if re.match(r"^第\d+集", lines[0]) else lines
    
    # 1. 写入权威 script-source.txt
    source_path = os.path.join(ep_dir, "script-source.txt")
    with open(source_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
        
    # 2. 数学声学前置测算
    prof = None
    if compute_acoustic_profile:
        prof = compute_acoustic_profile(ep_raw, ep_num)
        prof_path = os.path.join(ep_dir, "acoustic-profile.json")
        with open(prof_path, "w", encoding="utf-8") as f:
            json.dump(prof, f, ensure_ascii=False, indent=2)
            
    # 3. 动态决定 SEG 数量
    existing_segs = sorted([d for d in os.listdir(ep_dir) if os.path.isdir(os.path.join(ep_dir, d)) and d.upper().startswith("SEG")])
    
    if target_segs is not None:
        num_segs = target_segs
    elif existing_segs and not force_recompute:
        num_segs = len(existing_segs)
    elif prof is not None:
        num_segs = prof["acoustic_seg_allocation"]["target_dynamic_segs"]
    else:
        num_segs = 4
        
    if num_segs < 2:
        num_segs = 2
        
    chunks = partition_episode(content_lines, num_segs)
    
    # 4. 写入各 SEG 的 script-verbatim.txt
    for idx, chunk in enumerate(chunks):
        seg_name = f"SEG{idx + 1:03d}"
        seg_dir = os.path.join(ep_dir, seg_name)
        os.makedirs(seg_dir, exist_ok=True)
        v_path = os.path.join(seg_dir, "script-verbatim.txt")
        with open(v_path, "w", encoding="utf-8") as f:
            f.write("\n".join(chunk) + "\n")
            
    # 5. 校验 100% 逐字覆盖
    recombined = []
    for c in chunks:
        recombined.extend(c)
    assert recombined == content_lines, f"第{ep_num}集 切片重组不一致！"
    
    info_str = f"对白 {prof['total_dialogue_chars']}字 | 物理时长 {prof['total_physical_duration_seconds']}s" if prof else "无声学配置"
    print(f"  [OK] 第{ep_num:03d}集: {info_str} -> 写入 {num_segs} 个 SEG, 合计 {len(content_lines)} 行原著物理切片 (100% 逐字覆盖)")

def main():
    parser = argparse.ArgumentParser(description="Deterministic Docx Slicer & Acoustic Dynamic Partitioner")
    parser.add_argument("--docx", default=DOCX_DEFAULT, help="Docx path")
    parser.add_argument("--output-root", default=OUTPUT_ROOT_DEFAULT, help="Output root directory")
    parser.add_argument("--batch", default="1-20", help="Batch specification e.g. 1-20 or 15")
    parser.add_argument("--target-segs", type=int, help="Explicit target SEGs count (override acoustic pre-computation)")
    parser.add_argument("--recompute-segs", action="store_true", help="Force recompute SEGs count using acoustic profile even if SEGs already exist")
    args = parser.parse_args()
    
    batch_str = args.batch.strip().lower().replace("batch", "")
    if "-" in batch_str:
        start_ep, end_ep = map(int, batch_str.split("-"))
    else:
        num = int(batch_str)
        if num % 20 == 0:
            start_ep = num - 19
            end_ep = num
        else:
            start_ep = num
            end_ep = num
            
    print(f"=== [Deterministic Docx Slicer & Acoustic Partitioner] 开始执行物理切片 ===")
    print(f"权威底本: {args.docx}")
    print(f"交付目录: {args.output_root}")
    print(f"切片集数: 第 {start_ep} 集 ~ 第 {end_ep} 集\n")
    
    docx_episodes = extract_docx_episodes(args.docx)
    for ep in range(start_ep, end_ep + 1):
        if ep not in docx_episodes:
            print(f"[-] 原著 docx 缺失 第{ep}集！")
            continue
        ep_dir = os.path.join(args.output_root, f"第{ep:03d}集")
        slice_episode(ep, docx_episodes[ep], ep_dir, target_segs=args.target_segs, force_recompute=args.recompute_segs)
        
    print(f"\n=== [SUCCESS] 物理切片与声学测算全部完成，所有剧本行 100% 确定性直接落盘！ ===")

if __name__ == "__main__":
    main()
