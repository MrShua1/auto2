#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Universal Asset Resolver (resolve-assets.py)
自动遍历项目全量资产库（桌面 4 大目录），为指定集或批次精确匹配角色、场景、道具与音频，
并自动生成/验证【素材映射.txt】与【资产/】目录。
"""

import os
import sys
import argparse
import shutil
import re

SEARCH_DIRS = [
    r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto分集制作-最新纯净版",
    r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-Auto全量制作-最新资产版",
    r"C:\Users\JW TSJ\Desktop\0910《有了水眼金睛，捕鱼寻宝当首富》-全量资产图",
    r"C:\Users\JW TSJ\Desktop\水眼金睛-Auto-Batch20全新纯净",
    r"C:\Users\JW TSJ\Desktop\音频参考",
    r"C:\Users\JW TSJ\Desktop\最新水眼",
    r"C:\Users\JW TSJ\Desktop\完美分镜"
]

CANONICAL_CHAR_MAP = {
    "黄子名": "CHAR_001_HUANG_ZIMING_VILLAGE_v1.png",
    "黄子名_金瞳": "CHAR_001_HUANG_ZIMING_VILLAGE_GOLD_v1.png",
    "黄子名_西装": "CHAR_001_HUANG_ZIMING_SUIT_v1.png",
    "田广民": "CHAR_020_田广民_v1.png",
    "王叔": "CHAR_073_王叔_v1.png",
    "村民甲": "CHAR_029_村民甲_v1.png",
    "村民乙": "CHAR_035_村民乙_v1.png",
    "林飞": "CHAR_002_LIN_FEI_v1.png",
    "池风云": "CHAR_003_CHI_FENGYUN_v1.png",
    "林静": "CHAR_004_LIN_JING_v1.png",
    "李二狗": "CHAR_005_LI_ERGOU_v1.png",
    "阿强": "CHAR_006_A_QIANG_v1.png",
    "瘦猴": "CHAR_007_SHOU_HOU_v1.png"
}

CANONICAL_SCENE_MAP = {
    "海上": "SCENE_006_海上船艇_v1.png",
    "海上船艇": "SCENE_006_海上船艇_v1.png",
    "盘龙村海口": "SCENE_010_盘龙村海口_v1.png",
    "海鲜大排档": "SCENE_015_海鲜大排档_v1.png",
    "老旧码头": "SCENE_001_老旧码头_v1.png",
    "破旧院落": "SCENE_002_破旧院落_v1.png",
    "黄子名家外废墟": "SCENE_003_黄子名家外废墟_v1.png",
    "海边滩涂": "SCENE_004_海边滩涂_v1.png"
}

CANONICAL_PROP_MAP = {
    "小型船艇": "PROP_021_FENGSHOU_BOAT_v1.png",
    "木质渔船": "PROP_021_FENGSHOU_BOAT_v1.png",
    "小破渔网": "PROP_016_FISHING_ROD_KING_v1.png",
    "捕鱼网": "PROP_016_FISHING_ROD_KING_v1.png",
    "极品幽蓝斑": "PROP_001_YOULANBAN_v1.png",
    "幽蓝斑": "PROP_001_YOULANBAN_v1.png",
    "破旧欠条": "PROP_002_QIANTIAO_v1.png",
    "欠条": "PROP_002_QIANTIAO_v1.png",
    "塑料红水桶": "PROP_003_SHUITONG_v1.png"
}

FILE_CACHE = {}

def init_file_cache():
    global FILE_CACHE
    if FILE_CACHE:
        return
    print("[INFO] Indexing asset search directories...")
    for sdir in SEARCH_DIRS:
        if not os.path.exists(sdir):
            continue
        for root, _, files in os.walk(sdir):
            for f in files:
                if f not in FILE_CACHE:
                    FILE_CACHE[f] = os.path.join(root, f)
    print(f"[INFO] Asset index ready: {len(FILE_CACHE)} files indexed.")

def find_file(filename):
    init_file_cache()
    return FILE_CACHE.get(filename)


def resolve_episode_assets(ep_dir):
    segs = [d for d in os.listdir(ep_dir) if d.startswith("SEG") and os.path.isdir(os.path.join(ep_dir, d))]
    print(f"[INFO] Resolving assets for {os.path.basename(ep_dir)} ({len(segs)} SEGs)...")
    
    for seg in segs:
        seg_dir = os.path.join(ep_dir, seg)
        prompt_file = os.path.join(seg_dir, "prompt.txt")
        if not os.path.exists(prompt_file):
            continue
            
        with open(prompt_file, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Parse Mixed declarations
        mixed_items = []
        char_matches = re.findall(r"把\s*\{\{(Mixed\s*\d+)\}\}\s*中的人物[（(](.*?)[)）]作为主体(\d+)", content)
        for m_tag, char_name, sub_num in char_matches:
            mixed_items.append({"tag": m_tag, "type": "char", "name": char_name.strip(), "subject": f"主体{sub_num}"})
            
        scene_matches = re.findall(r"把\s*\{\{(Mixed\s*\d+)\}\}\s*中的场景[（(](.*?)[)）]作为主体(\d+)", content)
        for m_tag, scene_name, sub_num in scene_matches:
            mixed_items.append({"tag": m_tag, "type": "scene", "name": scene_name.strip(), "subject": f"主体{sub_num}"})
            
        prop_matches = re.findall(r"把\s*\{\{(Mixed\s*\d+)\}\}\s*中的道具[（(](.*?)[)）]作为主体(\d+)", content)
        for m_tag, prop_name, sub_num in prop_matches:
            mixed_items.append({"tag": m_tag, "type": "prop", "name": prop_name.strip(), "subject": f"主体{sub_num}"})

        # Asset directory
        asset_target_dir = os.path.join(seg_dir, "资产")
        os.makedirs(asset_target_dir, exist_ok=True)
        
        mapping_lines = []
        for item in mixed_items:
            fname = None
            if item["type"] == "char":
                fname = CANONICAL_CHAR_MAP.get(item["name"]) or CANONICAL_CHAR_MAP.get(item["name"].split("_")[0])
            elif item["type"] == "scene":
                fname = CANONICAL_SCENE_MAP.get(item["name"])
            elif item["type"] == "prop":
                fname = CANONICAL_PROP_MAP.get(item["name"])
                
            if not fname:
                fname = f"{item['name']}.png"
                
            real_path = find_file(fname)
            if real_path and os.path.exists(real_path):
                target_path = os.path.join(asset_target_dir, os.path.basename(real_path))
                if not os.path.exists(target_path):
                    shutil.copy2(real_path, target_path)
                mapping_lines.append(f"{{{{{item['tag']}}}}} -> {item['subject']} ({item['name']}): {os.path.basename(real_path)}")
            else:
                mapping_lines.append(f"{{{{{item['tag']}}}}} -> {item['subject']} ({item['name']}): [PENDING_SOURCE: {fname}]")

        mapping_file = os.path.join(seg_dir, "素材映射.txt")
        with open(mapping_file, "w", encoding="utf-8") as f:
            f.write("\n".join(mapping_lines) + "\n")
        print(f"  [OK] {seg}: {len(mapping_lines)} assets mapped and synced.")

def main():
    parser = argparse.ArgumentParser(description="Auto Universal Asset Resolver")
    parser.add_argument("--ep", type=int, help="Target episode number (e.g. 3)")
    parser.add_argument("--batch", type=int, default=20, help="Batch end number (default 20)")
    parser.add_argument("--base-dir", default=r"C:\Users\JW TSJ\Desktop\完美分镜", help="Base project directory")
    args = parser.parse_args()
    
    if args.ep:
        ep_str = f"第{args.ep:03d}集"
        ep_dir = os.path.join(args.base_dir, ep_str)
        if os.path.exists(ep_dir):
            resolve_episode_assets(ep_dir)
        else:
            print(f"[ERROR] Episode dir not found: {ep_dir}")
    else:
        for ep in range(1, args.batch + 1):
            ep_str = f"第{ep:03d}集"
            ep_dir = os.path.join(args.base_dir, ep_str)
            if os.path.exists(ep_dir):
                resolve_episode_assets(ep_dir)

if __name__ == "__main__":
    main()
