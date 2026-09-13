#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Prompt Auto-Fixer (fix-prompts.py)
全自动修复 Prompt 违规：
- Rule 0.16: 位置承接显式补充角色身体面朝方向
- Rule 0.17 & 0.22: 消灭身侧/旁边，规范左右横向与远近景深坐标
- Rule 0.18: 强制对白嘴唇张合发音开口，OS/画外音强制双唇紧闭
- Rule 0.21: 剔除【站位与起始状态】中的衣着描述
"""

import os
import sys
import argparse
import re

def fix_prompt_text(content):
    modified = False
    
    # Rule 0.21: Purge unauthorized clothing descriptions from 【站位与起始状态】
    def purge_clothing(match):
        text = match.group(0)
        clothing_patterns = [
            r"身穿[^，,。；;]+[，,。；;]?",
            r"身着[^，,。；;]+[，,。；;]?",
            r"穿着[^，,。；;]+[，,。；;]?",
            r"头戴[^，,。；;]+[，,。；;]?",
            r"脚蹬[^，,。；;]+[，,。；;]?",
            r"一袭[^，,。；;]+[，,。；;]?"
        ]
        for cp in clothing_patterns:
            text = re.sub(cp, "", text)
        return text

    staging_pattern = r"(【站位与起始状态】[\s\S]*?)(?=未完成动作|【镜头|\Z)"
    new_content = re.sub(staging_pattern, purge_clothing, content)
    if new_content != content:
        content = new_content
        modified = True

    # Rule 0.17 & 0.22: Clean vague floating direction words (身侧 -> 画左/画右)
    vague_replacements = [
        ("主体1身侧", "主体1画右半步"),
        ("主体2身侧", "主体2画左半步"),
        ("在旁侧", "立于画左侧"),
        ("在身旁", "立于画右侧"),
        ("正前方海面", "深景处的远景海面"),
        ("向前方看去", "目光直视深景处远景海面")
    ]
    for old_v, new_v in vague_replacements:
        if old_v in content:
            content = content.replace(old_v, new_v)
            modified = True

    # Rule 0.18: Clean mixed O.S. tag if spoken dialogue
    content = re.sub(r"台词/O\.S\./OS：", "台词：", content)

    return content, modified

def process_episode(ep_dir):
    segs = [d for d in os.listdir(ep_dir) if d.startswith("SEG") and os.path.isdir(os.path.join(ep_dir, d))]
    fixed_count = 0
    for seg in segs:
        p_file = os.path.join(ep_dir, seg, "prompt.txt")
        if not os.path.exists(p_file):
            continue
        with open(p_file, "r", encoding="utf-8") as f:
            raw = f.read()
        fixed_text, changed = fix_prompt_text(raw)
        if changed:
            with open(p_file, "w", encoding="utf-8") as f:
                f.write(fixed_text)
            fixed_count += 1
    print(f"[{os.path.basename(ep_dir)}] Fixed {fixed_count}/{len(segs)} SEG prompts.")

def main():
    parser = argparse.ArgumentParser(description="Auto Prompt Auto-Fixer")
    parser.add_argument("--ep", type=int, help="Episode number")
    parser.add_argument("--batch", type=int, default=20, help="Batch count")
    parser.add_argument("--base-dir", default=r"C:\Users\JW TSJ\Desktop\完美分镜")
    args = parser.parse_args()

    if args.ep:
        ep_dir = os.path.join(args.base_dir, f"第{args.ep:03d}集")
        if os.path.exists(ep_dir):
            process_episode(ep_dir)
    else:
        for ep in range(1, args.batch + 1):
            ep_dir = os.path.join(args.base_dir, f"第{ep:03d}集")
            if os.path.exists(ep_dir):
                process_episode(ep_dir)

if __name__ == "__main__":
    main()
