#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
确定性剧本切片工具 (Deterministic Docx Slicer)
从权威 docx 底本直接进行确定性物理切片，写入各分集的 script-source.txt 与各 SEG 的 script-verbatim.txt。
绝对严禁任何大模型介入转述、改写、脑补或压缩！
"""

import os
import re
import sys
import zipfile
import argparse
import xml.etree.ElementTree as ET

DOCX_DEFAULT = r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》剧本1-300集.docx"
OUTPUT_ROOT_DEFAULT = r"C:\Users\JW TSJ\Desktop\完美分镜"

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

def find_best_split(lines):
    if len(lines) <= 4:
        return len(lines) // 2
    mid = len(lines) // 2
    best_idx = mid
    min_dist = 999
    for i, l in enumerate(lines):
        if 2 <= i <= len(lines) - 2:
            if l.startswith("△"):
                dist = abs(i - mid)
                if dist < min_dist:
                    min_dist = dist
                    best_idx = i
    return best_idx

def partition_episode(lines, num_segs):
    scene_indices = [i for i, l in enumerate(lines) if re.match(r"^\d+-\d+", l)]
    
    if len(scene_indices) == 2 and num_segs == 4:
        s1_lines = lines[:scene_indices[1]]
        s2_lines = lines[scene_indices[1]:]
        split1 = find_best_split(s1_lines)
        split2 = find_best_split(s2_lines)
        return [
            s1_lines[:split1],
            s1_lines[split1:],
            s2_lines[:split2],
            s2_lines[split2:]
        ]
    elif len(scene_indices) == 1 and num_segs == 4:
        n = len(lines)
        q1 = n // 4
        q2 = n // 2
        q3 = (3 * n) // 4
        def best_near(target, low, high):
            best = target
            m_dist = 999
            for i in range(low, high):
                if lines[i].startswith("△"):
                    d = abs(i - target)
                    if d < m_dist:
                        m_dist = d
                        best = i
            return best
        cut1 = best_near(q1, 2, q2)
        cut2 = best_near(q2, cut1 + 2, q3)
        cut3 = best_near(q3, cut2 + 2, n - 2)
        return [
            lines[:cut1],
            lines[cut1:cut2],
            lines[cut2:cut3],
            lines[cut3:]
        ]
    elif len(scene_indices) == 1 and num_segs == 3:
        n = len(lines)
        t1 = n // 3
        t2 = (2 * n) // 3
        def best_near(target, low, high):
            best = target
            m_dist = 999
            for i in range(low, high):
                if lines[i].startswith("△"):
                    d = abs(i - target)
                    if d < m_dist:
                        m_dist = d
                        best = i
            return best
        cut1 = best_near(t1, 2, t2)
        cut2 = best_near(t2, cut1 + 2, n - 2)
        return [
            lines[:cut1],
            lines[cut1:cut2],
            lines[cut2:]
        ]
    else:
        chunk_size = len(lines) // num_segs
        chunks = []
        start = 0
        for i in range(num_segs - 1):
            end = start + chunk_size
            chunks.append(lines[start:end])
            start = end
        chunks.append(lines[start:])
        return chunks

def slice_episode(ep_num, ep_raw, ep_dir, target_segs=4):
    os.makedirs(ep_dir, exist_ok=True)
    lines = [l.strip() for l in ep_raw.splitlines() if l.strip()]
    content_lines = lines[1:] if re.match(r"^第\d+集", lines[0]) else lines
    
    # 1. Write authentic script-source.txt
    source_path = os.path.join(ep_dir, "script-source.txt")
    with open(source_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
        
    # 2. Check existing SEGs count if any
    existing_segs = sorted([d for d in os.listdir(ep_dir) if os.path.isdir(os.path.join(ep_dir, d)) and d.upper().startswith("SEG")])
    num_segs = len(existing_segs) if existing_segs else target_segs
    if num_segs < 2:
        num_segs = 4
        
    chunks = partition_episode(content_lines, num_segs)
    
    # 3. Write each SEG
    for idx, chunk in enumerate(chunks):
        seg_name = f"SEG{idx + 1:03d}"
        seg_dir = os.path.join(ep_dir, seg_name)
        os.makedirs(seg_dir, exist_ok=True)
        v_path = os.path.join(seg_dir, "script-verbatim.txt")
        with open(v_path, "w", encoding="utf-8") as f:
            f.write("\n".join(chunk) + "\n")
            
    # Verify exact coverage
    recombined = []
    for c in chunks:
        recombined.extend(c)
    assert recombined == content_lines, f"第{ep_num}集 切片重组不一致！"
    print(f"  [OK] 第{ep_num:03d}集: 写入 {num_segs} 个 SEG, 合计 {len(content_lines)} 行原著物理切片 (100% 逐字覆盖)")

def main():
    parser = argparse.ArgumentParser(description="Deterministic Docx Slicer")
    parser.add_argument("--docx", default=DOCX_DEFAULT, help="Docx path")
    parser.add_argument("--output-root", default=OUTPUT_ROOT_DEFAULT, help="Output root directory")
    parser.add_argument("--batch", default="1-20", help="Batch specification e.g. 1-20 or 15")
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
            
    print(f"=== [Deterministic Docx Slicer] 开始执行物理切片 ===")
    print(f"权威底本: {args.docx}")
    print(f"交付目录: {args.output_root}")
    print(f"切片集数: 第 {start_ep} 集 ~ 第 {end_ep} 集\n")
    
    docx_episodes = extract_docx_episodes(args.docx)
    for ep in range(start_ep, end_ep + 1):
        if ep not in docx_episodes:
            print(f"[-] 原著 docx 缺失 第{ep}集！")
            continue
        ep_dir = os.path.join(args.output_root, f"第{ep:03d}集")
        slice_episode(ep, docx_episodes[ep], ep_dir)
        
    print(f"\n=== [SUCCESS] 物理切片全部完成，所有剧本行 100% 确定性直接落盘！ ===")

if __name__ == "__main__":
    main()
