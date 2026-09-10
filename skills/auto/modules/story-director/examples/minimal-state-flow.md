# Minimal State Flow Example

This example demonstrates state handling, not a complete film or a model benchmark.

## Brief

A four-minute Chinese AI short: an elderly station announcer records the final departure message for a railway line that closed years ago. At dusk, a former passenger arrives carrying an unclaimed suitcase. The ending image is the silent departure board switching off after both leave together.

Target: Seedance/即梦 planning, `16:9`, 6 scenes, about 28 primary clips. Compile only `CLIP001`.

## Story Spine

- Normal: The announcer performs a departure ritual for an empty station.
- Disruption: A woman arrives with a suitcase bearing his missing son's name.
- Pursuit: He tries to return it without opening it or discussing the past.
- Escalation: Her questions reveal both used the abandoned line to avoid farewell.
- Reversal: The case contains only recorded station ambience, not a message.
- Choice: He stops the automatic announcement and speaks one unscripted sentence.
- Afterimage: The departure board goes dark while two figures leave frame.

## CLIP001 Contract

```yaml
scene_id: SC001
clip_id: CLIP001
narrative_job: establish the announcer's ritual and the station's absence
duration_s: 10
surface:
  name: unknown
  confidence: low
  model_variant: unknown
  mode: multimodal_reference
  ratio: "16:9"
  resolution: unknown
  generate_audio: unknown
asset_role_map:
  - asset_id: C001_REF_FRONT
    type: image
    role: reference_image
    prompt_tag: "@图片1"
    purpose: identity
  - asset_id: L001_REF_WIDE
    type: image
    role: reference_image
    prompt_tag: "@图片2"
    purpose: location
canonical_locks: [C001, L001, W_C001_01, P001]
start_state:
  C001: seated before an old microphone, right hand above a red switch
  P001: departure board lit with one obsolete train number
timeline_beats:
  - time: 0-3s
    action: locked medium-wide; dust moves through sunset light; C001 inhales
  - time: 3-7s
    action: C001 presses the switch and leans toward the microphone
  - time: 7-10s
    action: his lips stop before speaking; the board hum becomes audible
end_state:
  C001: leaning toward microphone, mouth closed, gaze lowered, right hand resting beside the microphone
  P001: still lit
camera: static with an almost imperceptible slow push
audio: room tone, electrical hum, switch click; no score
```

## Prompt Example

Planning status: exact Seedance/即梦 surface, model variant, resolution, and native-audio behavior remain unverified. The following is a planning prompt, not executable API JSON.

```text
素材与角色：@图片1锁定C001的脸型、灰白短发和深蓝旧制服，@图片2锁定废弃海边小站播音室L001；不得改变服装与桌面红色开关。

起始状态：夕阳从积灰窗户斜照进狭小播音室，C001坐在旧麦克风前，右手悬在红色开关上，背景旧式发车牌显示一趟早已停运的列车。

0-3秒：固定中广景，尘埃缓慢漂浮，老人轻吸一口气。3-7秒：他按下开关，身体缓慢靠近麦克风，镜头只做极轻微前移。7-10秒：他准备开口却停住，嘴保持闭合，视线落下；画面停在这个犹豫状态。

声音：空站室内底噪、电流低鸣、清晰的开关咔哒声；无对白，无配乐。

视觉规则：克制写实，低饱和暖灰色，夕阳与冷色电器光形成轻微对比，细微表演，不夸张煽情。

禁止：身份漂移、制服变化、额外人物、发车牌文字变形、嘴部说话、突然运镜、镜头环绕、字幕、LOGO、水印。
```

## Take Review Example

The selected take ends with the announcer's hand still touching the switch rather than resting near the microphone.

Decision: `accept_with_deviation`, because the planned end state placed his right hand beside the microphone.

Observed end becomes canon:

```json
{
  "C001": {
    "pose": "leaning toward microphone",
    "gaze": "lowered",
    "right_hand": "still touching red switch",
    "mouth": "closed"
  },
  "P001": { "departure_board": "lit" }
}
```

`CLIP002` must start from that hand position. Do not force the planned hand position or regenerate a good take for a harmless deviation.
