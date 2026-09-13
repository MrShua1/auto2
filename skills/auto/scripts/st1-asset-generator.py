#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
st1-asset-generator.py - Auto 影视分集工程专属 st1 资产图生成与补齐脚本
严格遵循 Rule 0.33，使用 st1 (gpt-image-2.5-sunburst) 生成符合 Auto 框架规范的资产卡。
"""

import os
import sys
import json
import base64
import argparse
import requests

CREDENTIALS_PATH = r'C:\Users\JW TSJ\.config\opencode\st1.credentials.json'
DEFAULT_MODEL = 'gpt-image-2.5-sunburst'

def get_st1_client():
    if not os.path.exists(CREDENTIALS_PATH):
        raise FileNotFoundError(f"st1 credentials not found at {CREDENTIALS_PATH}")
    with open(CREDENTIALS_PATH, 'r', encoding='utf-8') as f:
        creds = json.load(f)
    base_url = creds.get('base_url', 'https://qwe.g-aisc.com').rstrip('/')
    api_key = creds.get('api_key') or creds.get('token')
    if not api_key:
        raise ValueError("No api_key found in credentials")
    return base_url, api_key

def build_prompt(asset_type, name, description):
    if asset_type == 'prop':
        return (
            f"Cinematic photorealistic prop card, 1:1 square aspect ratio. "
            f"Subject: {description}. "
            f"Visual style: Authentic contemporary Chinese coastal drama prop, realistic tactile texture, "
            f"natural wear and tear, high-end cinema lens close-up, sharp focus, clean neutral background. "
            f"Strictly ZERO human characters, ZERO human hands, ZERO fingers, ZERO holding or grabbing hands. "
            f"The item is resting purely on a solid clean rustic surface. 4K studio quality."
        )
    elif asset_type == 'char':
        return (
            f"Cinematic character reference portrait, authentic contemporary Chinese drama. "
            f"Character: {name}. Description: {description}. "
            f"Facial identity: Authentic Chinese / East Asian facial structure, natural black hair, dark eyes, "
            f"natural Chinese skin tone. Strictly ZERO Western/Caucasian/European facial features, ZERO blonde/light hair. "
            f"Wardrobe: Distinctive realistic contemporary Chinese coastal outfit. Crisp lighting, cinematic character card."
        )
    elif asset_type == 'scene':
        return (
            f"Cinematic environmental landscape establishing shot, 16:9 widescreen ratio. "
            f"Scene: {description}. "
            f"Atmosphere: Authentic Chinese coastal realism, detailed architectural and natural lighting, rich textures. "
            f"Strictly an empty scenic environment, strictly ZERO human characters, ZERO figures."
        )
    else:
        return description

def generate_asset(prompt, size='1024x1024', model=DEFAULT_MODEL):
    base_url, api_key = get_st1_client()
    url = f"{base_url}/v1/images/generations"
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }
    payload = {
        'model': model,
        'prompt': prompt,
        'size': size,
        'response_format': 'b64_json'
    }
    
    res = requests.post(url, headers=headers, json=payload, timeout=90)
    if not res.ok:
        raise RuntimeError(f"st1 API call failed ({res.status_code}): {res.text[:300]}")
    
    data = res.json()
    b64 = data.get('data', [{}])[0].get('b64_json')
    if not b64:
        raise RuntimeError(f"No b64_json in st1 response: {data}")
    return base64.b64decode(b64)

def main():
    parser = argparse.ArgumentParser(description="Generate asset card using st1 engine conforming to Auto framework")
    parser.add_argument('--type', choices=['prop', 'char', 'scene'], required=True, help="Asset type")
    parser.add_argument('--name', required=True, help="Asset name")
    parser.add_argument('--desc', required=True, help="Detailed physical description")
    parser.add_argument('--out', required=True, help="Output image file path")
    parser.add_argument('--size', default='1024x1024', help="Image size (e.g. 1024x1024, 1792x1024)")
    args = parser.parse_args()

    prompt = build_prompt(args.type, args.name, args.desc)
    print(f"[st1-asset-generator] Generating {args.type} '{args.name}'...")
    print(f"  Prompt: {prompt[:120]}...")
    
    img_data = generate_asset(prompt, size=args.size)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'wb') as f:
        f.write(img_data)
    print(f"  Successfully saved to: {args.out} ({len(img_data)} bytes)")

if __name__ == '__main__':
    main()
