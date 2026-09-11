#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
确定性剧本切片工具 (Deterministic Docx Slicer)
从原始权威 docx 剧本中提取指定批次的剧本切片，直接写入各分集的 script-source.txt。
严禁任何大模型中转、脑补、概括或压缩。
"""

import argparse
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

def extract_paragraphs_from_docx(docx_path):
    if not os.path.exists(docx_path):
        raise FileNotFoundError(f"未找到 docx 剧本底本文件: {docx_path}")
    
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
    return paragraphs

def parse_episodes(paragraphs):
    full_text = "\n".join(paragraphs)
    # 按 第X集 分割
    splits = re.split(r"\n(?=第\d+集)", full_text)
    episodes_map = {}
    for seg in splits:
        seg = seg.strip()
        if not seg:
            continue
        first_line = seg.split("\n", 1)[0].strip()
        m = re.match(r"第(\d+)集", first_line)
        if m:
            ep_num = int(m.group(1))
            episodes_map[ep_num] = seg
    return episodes_map

def sync_batch(docx_path, output_root, start_ep, end_ep):
    print(f"=== [Deterministic Slicer] 开始提取批次: 第 {start_ep} 集 ~ 第 {end_ep} 集 ===")
    print(f"权威底本: {docx_path}")
    print(f"交付目录: {output_root}")
    
    paragraphs = extract_paragraphs_from_docx(docx_path)
    episodes_map = parse_episodes(paragraphs)
    print(f"底本共解析出 {len(episodes_map)} 集有效剧本。")
    
    os.makedirs(output_root, exist_ok=True)
    
    results = []
    for ep_num in range(start_ep, end_ep + 1):
        if ep_num not in episodes_map:
            raise KeyError(f"原著 docx 中未找到 第{ep_num}集 剧本文本！")
        
        ep_text = episodes_map[ep_num]
        ep_folder = f"第{ep_num:03d}集"
        ep_dir = os.path.join(output_root, ep_folder)
        os.makedirs(ep_dir, exist_ok=True)
        
        target_file = os.path.join(ep_dir, "script-source.txt")
        with open(target_file, "w", encoding="utf-8") as f:
            f.write(ep_text + "\n")
        
        char_count = len(ep_text)
        line_count = len(ep_text.splitlines())
        results.append((ep_num, line_count, char_count, target_file))
        print(f"  [OK] 第 {ep_num:03d} 集: {line_count:2d} 行, {char_count:4d} 字 -> {target_file}")
        
    print(f"=== [Deterministic Slicer] 成功完成 {len(results)} 集纯净物理切片写入！ ===")

def main():
    parser = argparse.ArgumentParser(description="Deterministic Docx Slicer")
    parser.add_argument("--docx", default=r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》剧本1-300集.docx", help="Docx path")
    parser.add_argument("--output-root", default=r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto分集制作-最新纯净版", help="Output root directory")
    parser.add_argument("--batch", default="1-20", help="Batch range, e.g. 1-20 or 20 (meaning 1-20)")
    args = parser.parse_args()
    
    batch_str = args.batch.strip()
    if "-" in batch_str:
        start_ep, end_ep = map(int, batch_str.split("-"))
    else:
        num = int(batch_str)
        if num % 20 == 0:
            start_ep = num - 19
            end_ep = num
        else:
            start_ep = 1
            end_ep = num
            
    sync_batch(args.docx, args.output_root, start_ep, end_ep)

if __name__ == "__main__":
    main()
