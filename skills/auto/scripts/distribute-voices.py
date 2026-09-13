#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Voice Reference Slicer & Distributor (distribute-voices.py)
将角色标准配音音频（如 CHAR_001_HUANG_ZIMING_VOICE.mp3）绑定为 {{Mixed 4}} 音频参考，
确保出镜对话角色的声画一致性。
"""

import os
import sys
import argparse
import shutil

CANONICAL_VOICE_MAP = {
    "黄子名": "CHAR_001_HUANG_ZIMING_VOICE.mp3",
    "田广民": "CHAR_020_TIAN_GUANGMIN_VOICE.mp3",
    "王叔": "CHAR_073_WANG_SHU_VOICE.mp3",
    "林飞": "CHAR_002_LIN_FEI_VOICE.mp3"
}

def distribute_voices(base_dir, start_ep=1, end_ep=20):
    for ep in range(start_ep, end_ep + 1):
        ep_dir = os.path.join(base_dir, f"第{ep:03d}集")
        if not os.path.exists(ep_dir):
            continue
        segs = [d for d in os.listdir(ep_dir) if d.startswith("SEG") and os.path.isdir(os.path.join(ep_dir, d))]
        for seg in segs:
            seg_dir = os.path.join(ep_dir, seg)
            prompt_file = os.path.join(seg_dir, "prompt.txt")
            if not os.path.exists(prompt_file):
                continue
            with open(prompt_file, "r", encoding="utf-8") as f:
                content = f.read()
            if "中的音频参考" in content or "的音频参考" in content:
                continue
            # Check if Huang Ziming is in prompt
            if "主体1（黄子名）" in content or "人物（黄子名）作为主体1" in content:
                lines = content.split("\n")
                new_lines = []
                inserted = False
                for line in lines:
                    new_lines.append(line)
                    if "作为主体" in line and not inserted:
                        # Find highest mixed index
                        new_lines.append("{{Mixed 4}} 为主体1 {{Mixed 1}} 的音频参考")
                        inserted = True
                if inserted:
                    with open(prompt_file, "w", encoding="utf-8") as f:
                        f.write("\n".join(new_lines))
                    print(f"[OK] {ep_dir}/{seg}: Injected audio reference.")

def main():
    parser = argparse.ArgumentParser(description="Auto Voice Reference Distributor")
    parser.add_argument("--batch", type=int, default=20)
    parser.add_argument("--base-dir", default=r"C:\Users\JW TSJ\Desktop\完美分镜")
    args = parser.parse_args()
    distribute_voices(args.base_dir, 1, args.batch)

if __name__ == "__main__":
    main()
