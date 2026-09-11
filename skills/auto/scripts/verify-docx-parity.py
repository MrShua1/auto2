#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
原著剧本逐字一致性门禁工具 (Docx Verbatim Parity Gate)
核验交付目录下各集的 script-source.txt 与原始权威 docx 文本是否 100% 逐字一致。
一旦字数缩水率 > 0% 或存在任何行差异，立即阻断报错（exit code 1）。
"""

import argparse
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

def extract_paragraphs_from_docx(docx_path):
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

def verify_parity(docx_path, output_root, start_ep, end_ep):
    print(f"=== [Parity Gate] 开始执行原著逐字一致性门禁审查: 第 {start_ep} 集 ~ 第 {end_ep} 集 ===")
    
    paragraphs = extract_paragraphs_from_docx(docx_path)
    episodes_map = parse_episodes(paragraphs)
    
    failures = []
    successes = []
    
    print(f"{'集数':^8} | {'Docx行数':^8} | {'Docx字数':^8} | {'物理Source字数':^12} | {'逐字一致性':^10} | 审查判定")
    print("-" * 75)
    
    for ep_num in range(start_ep, end_ep + 1):
        if ep_num not in episodes_map:
            failures.append((ep_num, "原著 docx 缺失该集"))
            continue
            
        docx_text = episodes_map[ep_num].strip()
        docx_lines = [l.strip() for l in docx_text.splitlines() if l.strip()]
        docx_char_count = len(docx_text)
        
        ep_folder = f"第{ep_num:03d}集"
        source_path = os.path.join(output_root, ep_folder, "script-source.txt")
        
        if not os.path.exists(source_path):
            failures.append((ep_num, f"缺少 script-source.txt: {source_path}"))
            print(f"第{ep_num:03d}集 | {len(docx_lines):^8} | {docx_char_count:^8} | {'MISSING':^12} | {'FAIL':^10} | 文件缺失")
            continue
            
        with open(source_path, "r", encoding="utf-8") as f:
            source_text = f.read().strip()
            
        source_lines = [l.strip() for l in source_text.splitlines() if l.strip()]
        source_char_count = len(source_text)
        
        # 逐字对比
        is_exact = (docx_text == source_text)
        
        if is_exact:
            verdict = "100% PASS (零误差)"
            print(f"第{ep_num:03d}集 | {len(docx_lines):^8} | {docx_char_count:^8} | {source_char_count:^12} | {'PASS':^10} | {verdict}")
            successes.append(ep_num)
        else:
            # 差异定位
            diff_ratio = (source_char_count - docx_char_count) / max(docx_char_count, 1) * 100
            verdict = f"FAIL (字数差异 {diff_ratio:+.1f}%)"
            print(f"第{ep_num:03d}集 | {len(docx_lines):^8} | {docx_char_count:^8} | {source_char_count:^12} | {'FAIL':^10} | {verdict}")
            
            # 查看首个不匹配行
            first_mismatch = None
            for idx, (dl, sl) in enumerate(zip(docx_lines, source_lines)):
                if dl != sl:
                    first_mismatch = (idx + 1, dl, sl)
                    break
            if first_mismatch:
                failures.append((ep_num, f"第{first_mismatch[0]}行不匹配: docx='{first_mismatch[1][:30]}...' vs source='{first_mismatch[2][:30]}...'"))
            elif len(docx_lines) != len(source_lines):
                failures.append((ep_num, f"行数不符: docx有{len(docx_lines)}行, source有{len(source_lines)}行"))
            else:
                failures.append((ep_num, f"文本内容存在不可见字符差异"))
                
    print("-" * 75)
    print(f"审查结果: 合格 {len(successes)} 集, 不合格 {len(failures)} 集 (总计 {end_ep - start_ep + 1} 集)")
    
    if failures:
        print("\n[门禁阻断原因详情]:")
        for ep_num, reason in failures:
            print(f"  - 第 {ep_num:03d} 集: {reason}")
        print("\n[Gate Verdict]: 门禁不通过！严禁流入下游制作！")
        sys.exit(1)
    else:
        print("\n[Gate Verdict]: 100% 逐字对齐门禁全部通过！可安全流转下游！")
        sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="Docx Verbatim Parity Gate")
    parser.add_argument("--docx", default=r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》剧本1-300集.docx", help="Docx path")
    parser.add_argument("--output-root", default=r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto分集制作-最新纯净版", help="Output root directory")
    parser.add_argument("--batch", default="1-20", help="Batch range")
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
            
    verify_parity(args.docx, args.output_root, start_ep, end_ep)

if __name__ == "__main__":
    main()
