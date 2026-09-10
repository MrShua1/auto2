# Auto Package Layout

For an Auto 2.3 `final_prevideo` delivery, all episode configurations use the same
`outputRoot`. The root contains one canonical folder per episode, and each episode
contains its own canonical segment folders:

```text
<outputRoot>/
|-- 第1集/
|   |-- SEG001/
|   `-- SEG002/
|-- 第2集/
|   |-- SEG001/
|   `-- SEG002/
`-- 第X集/
    `-- SEG001/
```

`episodeFolder` must be `第1集`, `第2集`, and so on. A segment folder must equal its
configured segment ID exactly, such as `SEG001`; story titles never appear in final
folder names. Draft and legacy package layouts are unchanged.

Every final episode also contains `资产总表.xlsx` (approved asset images embedded,
not a CSV/path-only substitute). Auto 2.3 additionally requires `生图需求全集.xlsx`
and both workbook result JSON files. These are episode-level files, not SEG-level
files. The final packager requires and copies them; the final validator verifies
their presence and identity with the validated working copies. `content-review.json`
is also episode-level and must be current before final packaging.

`素材映射.txt` rows must match the configured Mixed number, OK status, asset type,
role and segment-relative packaged path exactly. Each mapped asset is physically
copied under the matching category, not replaced by a shortcut or an absolute source
path. Empty categories still exist. A user's desktop-delivery request means an
actual uncompressed folder at the requested desktop location, not just a Skill ZIP.

Every segment folder has exactly this layout:

```text
<segment>/
|-- 资产/
|   |-- 场景/
|   |-- 道具/
|   |-- 人物/
|   `-- 声音参考/
|-- prompt.txt
|-- script-verbatim.txt
|-- storyboard-execution.txt
|-- tsc-handoff.yaml
`-- 素材映射.txt
```

The four asset directories must exist even when empty. No other entry is allowed
at the segment root or directly below `资产/`.

`storyboard-execution.txt` is a textual shot-execution plan compiled into
`prompt.txt`. It never names, maps, uploads or derives an image.

Allowed asset types are `character`, `location`, `prop`, `character_voice`,
`environment_audio` and `sound_effect`. Their destinations must be inside the four
fixed directories. Missing status is recorded only in `素材映射.txt` and episode-level
reports.

For 2.2+ projects, every asset also records a domain-specific `semanticClass`, such as
`character_identity`, `wardrobe_state`, `creature`, `vehicle`, `weapon`, `device`,
`interface`, `graphic`, `location`, `prop`, `character_voice` or `story_critical_sound`.
This semantic class supports any story domain without changing the stable four-folder
transport contract. Map identity-bearing creatures to `character`, environments to
`location`, object-like controls to `prop`, and audio classes to the matching sound
asset type.
