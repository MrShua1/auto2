# -*- coding: utf-8 -*-
import os
import sys
import re
import zipfile
import argparse
import xml.etree.ElementTree as ET

DOCX_DEFAULT = r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》剧本1-300集.docx"
BASE_DIR_DEFAULT = r"C:\Users\JW TSJ\Desktop\完美分镜"

def extract_docx_episodes(docx_path):
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

def clean_for_match(text):
    return re.sub(r'[，。！？、…—：:～~“”（）\(\)\"\'\s\t\r\n]', '', text)

def verify_episode(ep_num, ep_dir, docx_text):
    errors = []
    source_path = os.path.join(ep_dir, "script-source.txt")
    if not os.path.exists(source_path):
        return [f"第{ep_num:03d}集 缺失 script-source.txt"]
    
    with open(source_path, "r", encoding="utf-8") as f:
        source_text = f.read().strip()
        
    # Level 1: Source vs Docx
    clean_docx = clean_for_match(docx_text)
    clean_source = clean_for_match(source_text)
    if clean_docx != clean_source:
        errors.append(f"Level 1 失败: script-source.txt 与 docx 原著文本不一致 (原著 {len(docx_text)} 字 vs source {len(source_text)} 字)")
        
    # Find all SEGs
    segs = sorted([d for d in os.listdir(ep_dir) if os.path.isdir(os.path.join(ep_dir, d)) and d.upper().startswith("SEG")])
    if not segs:
        errors.append("未找到任何 SEG 分段目录")
        return errors
        
    combined_verbatim = ""
    for seg in segs:
        seg_dir = os.path.join(ep_dir, seg)
        v_path = os.path.join(seg_dir, "script-verbatim.txt")
        p_path = os.path.join(seg_dir, "prompt.txt")
        
        if not os.path.exists(v_path):
            errors.append(f"{seg} 缺失 script-verbatim.txt")
            continue
            
        with open(v_path, "r", encoding="utf-8") as f:
            v_text = f.read().strip()
        combined_verbatim += "\n" + v_text
        
        # Level 2: Verbatim lines must exist in source
        v_lines = [l.strip() for l in v_text.splitlines() if l.strip()]
        for vl in v_lines:
            if re.match(r'^\d+-\d+', vl) or vl.startswith('人物：') or vl.startswith('人物:'):
                continue
            clean_vl = clean_for_match(vl)
            if len(clean_vl) >= 4 and clean_vl not in clean_source:
                errors.append(f"{seg} Level 2 失败: script-verbatim.txt 包含脑补伪造剧本行: '{vl[:35]}...'")
                break
                
        # Level 3: Prompt dialogue quotes must exist in verbatim text
        if os.path.exists(p_path):
            with open(p_path, "r", encoding="utf-8") as f:
                p_text = f.read().strip()
            prompt_quotes = re.findall(r'[“"]([^”"\n]+)[”"]', p_text)
            clean_v = clean_for_match(v_text)
            for q in prompt_quotes:
                clean_q = clean_for_match(q)
                if len(clean_q) >= 4 and clean_q not in clean_v:
                    errors.append(f"{seg} Level 3 失败: prompt.txt 包含未经原著授权的脑补假台词: '“{q}”'")
                    
    # Check total coverage
    clean_combined_v = clean_for_match(combined_verbatim)
    missing_source_lines = 0
    for sl in [l.strip() for l in source_text.splitlines() if l.strip()]:
        if re.match(r'^第\d+集', sl):
            continue
        clean_sl = clean_for_match(sl)
        if len(clean_sl) >= 4 and clean_sl not in clean_combined_v:
            missing_source_lines += 1
    if missing_source_lines > 0:
        errors.append(f"Level 2 覆盖率失败: 所有 SEG 合计遗漏了原著 {missing_source_lines} 行内容")
        
    return errors

def main():
    parser = argparse.ArgumentParser(description="Multi-tier Docx Parity and Anti-Hallucination Gate")
    parser.add_argument("--docx", default=DOCX_DEFAULT, help="Docx path")
    parser.add_argument("--output-root", default=BASE_DIR_DEFAULT, help="Output root directory")
    parser.add_argument("--batch", default="1-20", help="Batch range e.g. 1-20 or 15")
    args = parser.parse_args()
    
    batch_str = args.batch.strip()
    if "-" in batch_str:
        start_ep, end_ep = map(int, batch_str.split("-"))
    else:
        start_ep = int(batch_str)
        end_ep = start_ep
        
    docx_episodes = extract_docx_episodes(args.docx)
    print(f"=== Docx 权威底本加载完成，共 {len(docx_episodes)} 集 ===")
    print(f"审查范围: 第 {start_ep} 集 ~ 第 {end_ep} 集")
    print(f"审查目录: {args.output_root}\n")
    
    total_episodes = end_ep - start_ep + 1
    passed_count = 0
    failed_count = 0
    
    for ep_num in range(start_ep, end_ep + 1):
        ep_dir = os.path.join(args.output_root, f"第{ep_num:03d}集")
        if not os.path.exists(ep_dir):
            print(f"[-] 第{ep_num:03d}集: 目录不存在 ({ep_dir})")
            failed_count += 1
            continue
            
        docx_text = docx_episodes.get(ep_num, "")
        if not docx_text:
            print(f"[-] 第{ep_num:03d}集: 原著 docx 中缺失该集！")
            failed_count += 1
            continue
            
        errors = verify_episode(ep_num, ep_dir, docx_text)
        if not errors:
            print(f"[+] 第{ep_num:03d}集: 100% PASS (零脑补、零假台词、覆盖率完整)")
            passed_count += 1
        else:
            print(f"[x] 第{ep_num:03d}集: FAILED (拦截到 {len(errors)} 项硬伤):")
            for err in errors:
                print(f"    - {err}")
            failed_count += 1
            
    print("\n" + "="*60)
    print(f"审计汇总: 共 {total_episodes} 集，通过 {passed_count} 集，拦截失败 {failed_count} 集")
    print("="*60)
    if failed_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
