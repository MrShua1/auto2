#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
声学物理容量与语速刚性门禁熔断工具 (Strict Dialogue Capacity & Acoustic CI Gate)
版本: v2.0.1
职责:
  对生成的 prompt.txt 与分镜结构执行声学与物理刚性拦截，
  凡出现“9秒塞145字”、“语速>4.2字/秒”、“单镜头>35字”、“SEG对白>55字”等假动作，
  一律实行【直接报错熔断 (Hard Fail)】，坚决杜绝虚标秒数掩盖内容超载！
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

MAX_SPEECH_RATE_ALLOWED = 4.2   # 单镜头语速绝对熔断阈值: 4.2 字/秒
MAX_SHOT_DIALOGUE_CAP = 35      # 单镜头台词字数上限: 35 字
MAX_SEG_DIALOGUE_CAP = 55       # 单 SEG 台词字数上限: 55 字

def extract_shots_from_prompt(prompt_content):
    """
    提取 prompt.txt 中的所有镜头及其声明时长、动作与台词
    """
    shot_blocks = re.split(r"(?=【镜头\d+】)", prompt_content)
    parsed_shots = []
    
    for block in shot_blocks:
        block = block.strip()
        if not block or not block.startswith("【镜头"):
            continue
            
        m_head = re.search(r"【镜头(\d+)】[（\(]([\d.]+)\s*秒?[）\)]", block)
        if not m_head:
            continue
            
        shot_num = int(m_head.group(1))
        duration = float(m_head.group(2))
        
        # 提取台词部分
        dialogue_text = ""
        m_dialogue = re.search(r"台词：(.*?)(?=\n\s*(?:视效|环境音|转场|【|$))", block, re.DOTALL)
        if m_dialogue:
            dialogue_raw = m_dialogue.group(1).strip()
            # 过滤冒号前说话人和引号外的动作说明
            lines = [l.strip() for l in dialogue_raw.splitlines() if l.strip()]
            spoken_texts = []
            for l in lines:
                # 提取双引号内的内容，若无双引号则提取冒号后内容
                quotes = re.findall(r"[“\"「](.*?)[”\"」]", l)
                if quotes:
                    spoken_texts.extend(quotes)
                elif "：" in l or ":" in l:
                    after_colon = re.split(r"[:：]", l, 1)[-1].strip()
                    spoken_texts.append(after_colon)
                else:
                    spoken_texts.append(l)
            dialogue_text = "".join(spoken_texts)
            # 过滤括号内辅助词
            dialogue_text = re.sub(r"[（\(].*?[）\)]", "", dialogue_text).strip()
            
        # 提取动作部分
        action_text = ""
        m_action = re.search(r"动作/表演：(.*?)(?=\n\s*(?:位置承接|台词|视效|【|$))", block, re.DOTALL)
        if m_action:
            action_text = m_action.group(1).strip()
            
        parsed_shots.append({
            "shot_num": shot_num,
            "duration": duration,
            "dialogue_text": dialogue_text,
            "dialogue_char_count": len(dialogue_text),
            "speech_rate": len(dialogue_text) / duration if duration > 0 else 0,
            "action_text": action_text
        })
        
    return parsed_shots

def validate_segment_capacity(ep_name, seg_name, prompt_path, acoustic_profile=None):
    """
    单 SEG 声学物理容量熔断质检
    """
    if not os.path.exists(prompt_path):
        return []
        
    with open(prompt_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    shots = extract_shots_from_prompt(content)
    issues = []
    
    total_seg_dialogue = sum(s["dialogue_char_count"] for s in shots)
    total_seg_duration = sum(s["duration"] for s in shots)
    
    # 1. 门禁一：单 SEG 总台词容量超载拦截
    if total_seg_dialogue > MAX_SEG_DIALOGUE_CAP:
        issues.append({
            "type": "SEG_CAPACITY_OVERLOAD",
            "severity": "CRITICAL",
            "ep": ep_name,
            "seg": seg_name,
            "shot": None,
            "msg": f"单 SEG 对白总量超标：总字数达 {total_seg_dialogue} 字（上限 {MAX_SEG_DIALOGUE_CAP} 字）！需向后顺延或分裂为独立 SEG！"
        })
        
    # 2. 门禁二：逐镜头声学语速与单镜字数绝对熔断拦截
    for s in shots:
        shot_num = s["shot_num"]
        dur = s["duration"]
        chars = s["dialogue_char_count"]
        rate = s["speech_rate"]
        
        # 语速超载熔断 (超过 4.2 字/秒)
        if rate > MAX_SPEECH_RATE_ALLOWED and chars > 15:
            issues.append({
                "type": "SPEECH_RATE_OVERLOAD",
                "severity": "CRITICAL",
                "ep": ep_name,
                "seg": seg_name,
                "shot": shot_num,
                "msg": (
                    f"【严重熔断】镜头{shot_num} 语速爆炸：台词 {chars} 字 / 时长仅 {dur} 秒 "
                    f"-> 语速高达 {rate:.2f} 字/秒（标准上限 4.2 字/秒）！"
                    f"AI 必然发生吞字吞音或 4 倍速鬼畜！必须原样拆分为 2~3 个镜头！"
                )
            })
            
        # 单镜头绝对台词超标拦截 (单镜头超过 35 字且时间 <= 10 秒)
        if chars > MAX_SHOT_DIALOGUE_CAP and dur <= 10.0:
            issues.append({
                "type": "SHOT_DIALOGUE_OVERFLOW",
                "severity": "CRITICAL",
                "ep": ep_name,
                "seg": seg_name,
                "shot": shot_num,
                "msg": (
                    f"【严重熔断】镜头{shot_num} 单镜头对白过密：单镜塞入 {chars} 字（上限 {MAX_SHOT_DIALOGUE_CAP} 字）！"
                    f"严禁多角往复长对话强塞进单个镜头！"
                )
            })
            
        # 动作超载拦截 (4 个以上关键动作塞进不足 8 秒镜头)
        action_parts = re.split(r"[；;，,。.]", s["action_text"])
        key_actions = [a for a in action_parts if any(k in a for k in ['质问', '算账', '拍大腿', '背起', '离去', '目送', '拔腿', '狂奔', '喊', '倒地', '推搡'])]
        if len(key_actions) >= 4 and dur < 8.0:
            issues.append({
                "type": "ACTION_DENSITY_OVERLOAD",
                "severity": "WARNING",
                "ep": ep_name,
                "seg": seg_name,
                "shot": shot_num,
                "msg": f"镜头{shot_num} 动作密度过载：在 {dur} 秒内塞入 {len(key_actions)} 个连续关键动作，模型极易抽搐丢动作！"
            })
            
    return issues

def validate_episode_segs(ep_dir):
    """
    对整集分集结构与所有 SEG 进行统一声学容量拦截
    """
    ep_name = os.path.basename(ep_dir)
    prof_path = os.path.join(ep_dir, "acoustic-profile.json")
    acoustic_prof = None
    if os.path.exists(prof_path):
        with open(prof_path, "r", encoding="utf-8") as pf:
            acoustic_prof = json.load(pf)
            
    segs = sorted([d for d in os.listdir(ep_dir) if d.startswith("SEG") and os.path.isdir(os.path.join(ep_dir, d))])
    
    all_issues = []
    
    # 门禁三：整集 SEG 数量是否低于声学物理硬底限
    if acoustic_prof:
        min_segs = acoustic_prof["acoustic_seg_allocation"]["min_segs_required"]
        target_segs = acoustic_prof["acoustic_seg_allocation"]["target_dynamic_segs"]
        if len(segs) < min_segs:
            all_issues.append({
                "type": "SEG_COUNT_INSUFFICIENT",
                "severity": "CRITICAL",
                "ep": ep_name,
                "seg": None,
                "shot": None,
                "msg": (
                    f"【整集结构性违规】整集分段严重不足：本集剧本声学总长需至少 {min_segs} 个 SEG（推荐 {target_segs} 个），"
                    f"但实际仅划分了 {len(segs)} 个 SEG！必然导致剧本结尾发生恶性削足适履与台词超载！"
                )
            })
            
    for seg in segs:
        seg_dir = os.path.join(ep_dir, seg)
        prompt_f = os.path.join(seg_dir, "prompt.txt")
        issues = validate_segment_capacity(ep_name, seg, prompt_f, acoustic_prof)
        all_issues.extend(issues)
        
    return all_issues

def main():
    parser = argparse.ArgumentParser(description="Strict Dialogue Capacity & Acoustic CI Gate")
    parser.add_argument("target", nargs="?", default=r"C:\Users\JW TSJ\Desktop\水眼金睛-Auto-第005-020集全新交付", help="Target episode directory or base directory")
    parser.add_argument("--ep", type=int, help="Single episode number to validate")
    args = parser.parse_args()
    
    target_path = args.target
    if args.ep is not None:
        target_dirs = [os.path.join(target_path, f"第{args.ep:03d}集")]
    elif re.match(r"^第\d+集", os.path.basename(target_path)):
        target_dirs = [target_path]
    else:
        target_dirs = sorted([os.path.join(target_path, d) for d in os.listdir(target_path) if re.match(r"^第\d+集", d) and os.path.isdir(os.path.join(target_path, d))])
        
    print(f"======================================================================")
    print(f"  声学物理容量与语速刚性门禁质检启动 (Strict Acoustic CI Gate)")
    print(f"  检测范围: {len(target_dirs)} 个分集 | 熔断语速上限: {MAX_SPEECH_RATE_ALLOWED} 字/秒")
    print(f"======================================================================")
    
    total_critical = 0
    total_warning = 0
    
    for ep_dir in target_dirs:
        ep_name = os.path.basename(ep_dir)
        issues = validate_episode_segs(ep_dir)
        criticals = [i for i in issues if i["severity"] == "CRITICAL"]
        warnings = [i for i in issues if i["severity"] == "WARNING"]
        
        total_critical += len(criticals)
        total_warning += len(warnings)
        
        if not issues:
            print(f"  [PASS] {ep_name}: 声学容量 100% 达标 (0 语速超载，0 镜头超标)")
        else:
            status_tag = "[HARD FAIL]" if criticals else "[WARN]"
            print(f"  {status_tag} {ep_name}: 发现 {len(criticals)} 处严重超载熔断, {len(warnings)} 处警告")
            for iss in issues:
                seg_label = f"[{iss['seg']}]" if iss['seg'] else "[整集]"
                print(f"    * {iss['type']} {seg_label}: {iss['msg']}")
                
    print(f"\n======================================================================")
    print(f"  门禁汇总: 严重熔断拦截 {total_critical} 处 | 告警提示 {total_warning} 处")
    print(f"======================================================================")
    
    if total_critical > 0:
        print(f"[!] 门禁状态: FAIL (已触发刚性代码熔断，严禁流转至下游渲染画布！)")
        sys.exit(1)
    else:
        print(f"[+] 门禁状态: PASS (全量分镜声学与动作物理时间全部合规)")
        sys.exit(0)

if __name__ == "__main__":
    main()
