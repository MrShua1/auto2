# QA, Repair, And Budget Control

## Review Order

Review generated footage in this order:

1. File is playable and correct duration/aspect.
2. Character/location/prop identity.
3. Start and end handoff states.
4. Primary action readability.
5. Camera and composition.
6. Dialogue, lip state, ambience, and SFX.
7. Style and polish.

Do not spend budget polishing a take with a broken identity or endpoint.

## Failure To Repair Map

| Failure | Likely cause | Smallest repair |
|---|---|---|
| Face or costume morphs | Too many actions/references; chain decay | Re-anchor from canonical character/wardrobe ref; simplify action |
| Slideshow or frozen subject | Prompt overweights still description | Replace adjectives with one body action, one camera path, environment reaction |
| Random camera | Multiple movements or vague motion | Keep one dominant move with start/path/end |
| Action repeats | Prior beat not marked complete | Update reserved beats; start after observed endpoint |
| Endpoint undershoots | Too much action for duration | Accept with deviation and continue, or repair tail if boundary requires precision |
| Endpoint overshoots | Unbounded wording | Add a stop condition and explicit final pose/frame |
| Prop changes hands/state | Missing state lock | Add prop owner, hand, orientation, and start/end state |
| Location drifts | Extension chain too deep | New scene/open from canonical location reference |
| Dialogue mismatch | Line too long or lip conflict | Shorten line, isolate speaker, or move speech to post |
| Bad cut boundary | No neutral hold or motion match | Trim, or generate an endpoint-valid pickup and use only the needed 1-2s in the EDL |
| Text artifacts | Text requested or absent negative | Remove generated text; add no text/logo/watermark; composite in post |

## Budget Plan

Before generation, record:

- Primary clip count.
- Expected attempts per clip: default 1.5-2.0.
- Pickup reserve: 10-20% of primary clips.
- Maximum attempts per ordinary clip and hero clip.
- Project hard stop in money, credits, or generation count.
- Warning threshold, normally 80-90%.

## Stop Rules

- Do not blind-retry an unchanged prompt.
- After two failures, diagnose and change one high-leverage variable.
- At clip cap, choose among accept-with-deviation, redesign, editorial workaround, or explicit user approval for more budget.
- At project hard stop, do not initiate another paid generation.
- Record the failure and repair so later clips do not repeat it.
