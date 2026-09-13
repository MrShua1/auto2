#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数学声学前置测算引擎 (Deterministic Acoustic & Physical Pre-computation Engine)
版本: v2.0.1
职责:
  在大模型动笔前，基于物理声学语速（3.5~3.8字/秒）与动作链物理耗时，
  正向测算剧本的真实物理时长，并计算出确定性 SEG 目标数量 N，
  彻底终结“通常3~4个SEG”的主观心理暗示与机械一刀切恶习！
"""

import os
import sys
import re
import json
import argparse

# Force UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

# 核心物理声学与动作常量
STANDARD_SPEECH_RATE = 3.6      # 标准自然对白语速: 3.6 字/秒
MAX_SAFE_SPEECH_RATE = 4.0      # 戏剧强爆点安全语速上限: 4.0 字/秒
TARGET_SEG_DURATION = 23.0      # 单 SEG 目标黄金交付时长: 23 秒
MIN_SEG_DURATION = 15.0         # 单 SEG 允许最短物理时长: 15 秒
MAX_SEG_DURATION = 28.0         # 单 SEG 允许最长物理时长: 28 秒

# 动作分级物理耗时权重
A_ACTION_DURATION = 3.0         # A级改变结果/强物理冲突动作: 3.0 秒 (捞鱼, 奔跑, 掌掴, 拍大腿, 掏钱)
B_ACTION_DURATION = 1.5         # B级连接/位移动作: 1.5 秒 (起身, 走近, 开门, 坐下, 递接)
C_ACTION_DURATION = 0.0         # C级微表情/神态动作: 0.0 秒 (附着于台词中并行发生)

A_ACTION_KEYWORDS = [
    '捞', '潜水', '还钱', '跃入', '拍大腿', '狂奔', '拔腿', '跑', '背着', '打开', '塞', 
    '抓', '扑', '摔', '砸', '推搡', '夺', '截拳', '掌掴', '扇', '踢', '拉拽', '冲出'
]
B_ACTION_KEYWORDS = [
    '起身', '站起', '走近', '迈步', '开门', '关门', '坐下', '递', '接', '端', '拿', 
    '抬手', '招手', '摆手', '转头', '跨步', '掏出', '掏'
]

def analyze_script_lines(lines):
    """
    深度解析剧本行，提取纯对白与动作行
    """
    dialogue_records = []
    action_records = []
    scene_records = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
            
        # 场景行检测 (如: 9-1 日 外 场景切换...)
        if re.match(r"^\d+-\d+", line) or (("日" in line or "夜" in line) and ("内" in line or "外" in line)):
            scene_records.append(line)
            continue
            
        # 动作行检测 (以 △ 开头)
        if line.startswith("△") or line.startswith("▲"):
            clean_action = line.lstrip("△▲").strip()
            # 判断动作等级
            if any(k in clean_action for k in A_ACTION_KEYWORDS):
                tier = "A"
                duration = A_ACTION_DURATION
            elif any(k in clean_action for k in B_ACTION_KEYWORDS):
                tier = "B"
                duration = B_ACTION_DURATION
            else:
                tier = "C"
                duration = C_ACTION_DURATION
            action_records.append({
                "raw": line,
                "tier": tier,
                "duration": duration
            })
            continue
            
        # 对白行检测 (人物：对白 或 人物:(神态)对白)
        m_speaker = re.match(r"^([^\s：:（\(]+)\s*[：:]\s*(.*)$", line)
        if m_speaker:
            speaker = m_speaker.group(1).strip()
            # 过滤场景和人物说明
            if speaker in ["人物", "场景", "时间", "地点", "道具"]:
                continue
            raw_speech = m_speaker.group(2).strip()
            # 剥离神态指示语，如 (摇头), （开朗掀开鱼篓）
            pure_speech = re.sub(r"[（\(].*?[）\)]", "", raw_speech).strip()
            pure_speech = re.sub(r"[“”\"'「」]", "", pure_speech).strip()
            
            is_os = "OS" in raw_speech.upper() or "内心" in raw_speech
            dialogue_records.append({
                "speaker": speaker,
                "raw": line,
                "pure_speech": pure_speech,
                "char_count": len(pure_speech),
                "is_os": is_os
            })

    return dialogue_records, action_records, scene_records

def compute_acoustic_profile(script_content, ep_num=None):
    """
    正向物理计算单集声学容量与最佳 SEG 数量
    """
    lines = [l.strip() for l in script_content.splitlines() if l.strip()]
    if lines and re.match(r"^第\d+集", lines[0]):
        if ep_num is None:
            m = re.search(r"\d+", lines[0])
            ep_num = int(m.group()) if m else 0
        content_lines = lines[1:]
    else:
        content_lines = lines
        
    dialogues, actions, scenes = analyze_script_lines(content_lines)
    
    # 1. 声学时间计算
    total_dialogue_chars = sum(d["char_count"] for d in dialogues)
    acoustic_duration = total_dialogue_chars / STANDARD_SPEECH_RATE
    
    # 2. 动作物理时间计算
    action_duration = sum(a["duration"] for a in actions)
    
    # 3. 场景转换时间 (每个场景切分点预留 1.5s 空间建立)
    scene_transitions = max(0, len(scenes) - 1) * 1.5
    
    # 4. 总物理时长
    total_physical_duration = acoustic_duration + action_duration + scene_transitions
    
    # 5. 动态计算 SEG 目标数量
    # 严格遵循单 SEG 15~28 秒硬指标
    min_segs_required = max(2, int(total_physical_duration / MAX_SEG_DURATION + 0.99)) # 向上取整
    max_segs_allowed = max(2, int(total_physical_duration / MIN_SEG_DURATION))       # 向下取整
    
    # 推荐黄金 SEG 数量 (以 22~24 秒为基准)
    target_segs = round(total_physical_duration / TARGET_SEG_DURATION)
    target_segs = max(min_segs_required, min(max_segs_allowed, target_segs))
    
    avg_seg_duration = total_physical_duration / target_segs
    avg_dialogue_per_seg = total_dialogue_chars / target_segs
    
    profile = {
        "episode": f"第{ep_num:03d}集" if ep_num is not None else "未知集数",
        "script_total_lines": len(content_lines),
        "scene_count": len(scenes),
        "dialogue_lines_count": len(dialogues),
        "total_dialogue_chars": total_dialogue_chars,
        "acoustic_duration_seconds": round(acoustic_duration, 1),
        "action_lines_count": len(actions),
        "action_duration_seconds": round(action_duration, 1),
        "scene_transition_seconds": round(scene_transitions, 1),
        "total_physical_duration_seconds": round(total_physical_duration, 1),
        "acoustic_seg_allocation": {
            "min_segs_required": min_segs_required,
            "max_segs_allowed": max_segs_allowed,
            "target_dynamic_segs": target_segs,
            "expected_avg_seg_duration": round(avg_seg_duration, 1),
            "expected_avg_dialogue_per_seg": round(avg_dialogue_per_seg, 1)
        },
        "gates": {
            "max_safe_speech_rate": MAX_SAFE_SPEECH_RATE,
            "max_dialogue_per_seg_cap": 50,
            "max_dialogue_per_shot_cap": 25,
            "min_shot_duration_for_dialogue": "round(chars / 3.8, 1)"
        }
    }
    
    return profile

def generate_dispatch_contract(profile):
    """
    生成注入给大模型 Worker 的刚性派发契约文本
    """
    alloc = profile["acoustic_seg_allocation"]
    contract = (
        f"【本集声学物理容量刚性门禁契约 · 预计算引擎锁定】\n"
        f"- 本集纯对白总字数：{profile['total_dialogue_chars']} 字，关键物理动作：{profile['action_lines_count']} 处\n"
        f"- 正向物理声学测算总时长：{profile['total_physical_duration_seconds']} 秒（纯对白需 {profile['acoustic_duration_seconds']}s，动作需 {profile['action_duration_seconds']}s）\n"
        f"- 【严格锁死分段数量】：本集必须拆分为 【{alloc['target_dynamic_segs']} 个独立 SEG】（严禁自设配额！严禁机械固定4段！允许区间: {alloc['min_segs_required']}~{alloc['max_segs_allowed']} 段）\n"
        f"- 单 SEG 预期平均时长：{alloc['expected_avg_seg_duration']} 秒（单 SEG 严格保持 15~28 秒）\n"
        f"- 单 SEG 预期台词容量：约 {alloc['expected_avg_dialogue_per_seg']} 字（单 SEG 对白上限严禁超过 50 字）\n"
        f"- 单镜头对白与语速红线：单镜头建议 8~18 字（强爆点 4~10 字）；单镜头语速绝对严禁超过 4.0 字/秒！超过必须原样拆分镜头！"
    )
    return contract

def process_file_or_dir(target_path, output_json=None):
    if os.path.isfile(target_path):
        with open(target_path, "r", encoding="utf-8") as f:
            content = f.read()
        prof = compute_acoustic_profile(content)
        contract = generate_dispatch_contract(prof)
        print(f"======================================================================")
        print(f"  {prof['episode']} 声学物理测算结果")
        print(f"======================================================================")
        print(json.dumps(prof, ensure_ascii=False, indent=2))
        print(f"\n{contract}\n")
        if output_json:
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(prof, f, ensure_ascii=False, indent=2)
        return prof
        
    elif os.path.isdir(target_path):
        ep_dirs = sorted([d for d in os.listdir(target_path) if re.match(r"^第\d+集", d) and os.path.isdir(os.path.join(target_path, d))])
        print(f"======================================================================")
        print(f"  扫描到 {len(ep_dirs)} 个分集目录，开始逐集执行声学物理测算...")
        print(f"======================================================================")
        
        all_profiles = []
        for ep in ep_dirs:
            sf = os.path.join(target_path, ep, "script-source.txt")
            if not os.path.exists(sf):
                continue
            with open(sf, "r", encoding="utf-8") as f:
                content = f.read()
            m = re.search(r"\d+", ep)
            ep_num = int(m.group()) if m else 0
            prof = compute_acoustic_profile(content, ep_num)
            all_profiles.append(prof)
            
            ep_prof_path = os.path.join(target_path, ep, "acoustic-profile.json")
            with open(ep_prof_path, "w", encoding="utf-8") as f:
                json.dump(prof, f, ensure_ascii=False, indent=2)
                
            alloc = prof["acoustic_seg_allocation"]
            print(f"[{ep}] 对白: {prof['total_dialogue_chars']:>3}字 | 物理总长: {prof['total_physical_duration_seconds']:>5.1f}s -> 动态分配: 【{alloc['target_dynamic_segs']} SEG】(区间: {alloc['min_segs_required']}~{alloc['max_segs_allowed']})")
            
        print(f"======================================================================")
        print(f"  测算完成！全量分集 acoustic-profile.json 已固化写入各集根目录。")
        print(f"======================================================================")
        return all_profiles

def main():
    parser = argparse.ArgumentParser(description="Deterministic Acoustic & Physical Pre-computation Engine")
    parser.add_argument("target", nargs="?", default=r"C:\Users\JW TSJ\Desktop\水眼金睛-Auto-第005-020集全新交付", help="Target script file or episode root directory")
    parser.add_argument("--ep", type=int, help="Single episode number to inspect")
    parser.add_argument("--output", help="Output path for profile JSON")
    args = parser.parse_args()
    
    if args.ep is not None:
        ep_dir = os.path.join(args.target, f"第{args.ep:03d}集")
        sf = os.path.join(ep_dir, "script-source.txt")
        if os.path.exists(sf):
            process_file_or_dir(sf, args.output)
        else:
            print(f"Error: {sf} does not exist!")
            sys.exit(1)
    else:
        process_file_or_dir(args.target, args.output)

if __name__ == "__main__":
    main()
