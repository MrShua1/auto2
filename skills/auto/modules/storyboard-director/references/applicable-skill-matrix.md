# Applicable Skill Matrix

Complete this matrix before every image-generation phase. `APPLIED` means the
Skill changed a concrete field or gate. `N/A` requires a reason.

| Skill | Default for cinematic storyboard | Evidence to record |
|---|---|---|
| `cinematic-storyboard-director` | APPLIED | Orchestration, contracts and lint version |
| `ai-short-film-director` | APPLIED | Narrative job, coverage type, transition |
| `cinematic-director` | APPLIED | User-shot locks, shot function, action pivot, scale/angle progression, axis and eyeline geometry |
| `gpt-10s-nine-grid-storyboard` | APPLIED | Panel/state necessity, reference manifest, 16:9 layout |
| `cinematic-prompt-engine` | APPLIED for cinematic stills when license permits | LOOK ID, camera/depth/light/color/realism/anti-slop layers |
| `seedance-camera` | APPLIED | Scale, angle, camera height, future movement intent, endpoint |
| `seedance-characters` | APPLIED when people appear | Identity roles, positions, wardrobe, anatomy constraints |
| `seedance-lighting` | APPLIED | Source, direction, temperature, fill, shadows, reflections |
| `seedance-style` | APPLIED | Medium, surface, palette, camera/render behavior, safe style translation |
| `seedance-antislop` | APPLIED | Vague terms removed and observable replacements |
| `seedance-motion` | APPLIED when action/physics appears | Actor/object, threshold, force, consequence, endpoint |
| `seedance-copyright` | APPLIED when named IP/style/likeness/logos appear | Risk category and descriptive replacement/authorization |
| `seedance-vfx` | CONDITIONAL | Physical effect state or `N/A: no VFX` |
| `seedance-audio` | CONDITIONAL | Sound bridge/dialogue intent or `N/A: still generation only` |
| `seedance-prompt` | CONDITIONAL | Used only when a Seedance video prompt is compiled |
| `seedance-pipeline` | CONDITIONAL | Endpoint/workflow integration or `N/A: no pipeline change` |
| filter/troubleshoot/vocabulary/interview Skills | CONDITIONAL | Trigger-specific evidence or explicit `N/A` |

## Rule

Never write “all Skills applied” as a blanket claim. Apply all relevant Skills,
list irrelevant ones as `N/A`, and explain any local-file fallback when the Skill
loader is stale after installation.
