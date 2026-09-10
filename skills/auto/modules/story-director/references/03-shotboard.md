# Timed Shotboard And Clip Contracts

## Separate Three Levels

1. **Scene:** dramatic unit and re-anchor boundary.
2. **Clip:** one generation job, normally 4-15 seconds.
3. **Edit beat:** an internal action or cut point; it does not imply a separate API call.

## Clip Design

Every clip requires:

- One narrative job.
- Planned start state.
- One dominant visible action.
- Planned end state.
- Character/location/prop IDs.
- Duration and endpoint mode.
- Camera intent and composition.
- Dialogue/ambience/SFX intent.
- Transition and handoff requirement.
- Chain eligibility and re-anchor rule.

## State-Delta Grammar

Write each clip as:

```text
START: facts visible at frame one
DELTA: the smallest meaningful action or reveal
END: facts that must be visible at the cut
```

Do not restate the whole scene in every clip. The delta should change at least one of: information, position, possession, relationship, emotion, danger, or available choice.

## Camera Grammar

Select one dominant camera behavior. Camera movement must support the narrative job.

- Static or locked: attention to performance or revelation.
- Slow push/pull: controlled pressure or emotional distance.
- Pan/tilt: reveal a spatial relationship.
- Track/follow: pursuit or transition.
- Handheld drift: instability, used sparingly.

Specify framing, angle, subject placement, and movement path. Avoid stacking orbit + crane + dolly + zoom in one short clip.

## Start And End Frames

Design a clean start frame for every clip. Design an explicit end frame when:

- The endpoint carries a reveal.
- A match cut or first/last-frame mode is required.
- The next clip depends on precise pose, gaze, object state, or framing.

If a clip will be reviewed before the next prompt is compiled, its generated last frame may define the next observed start without becoming a permanent identity reference.

## Audio Intent

Distinguish:

- Generated dialogue: short, speaker-labeled, physically compatible with lip state.
- Diegetic ambience/SFX: useful for action timing and bridges.
- Score: plan emotionally here, but produce/mix in post by default.
- Subtitles and on-screen text: post-production unless the task explicitly requires generated text.

## Duration Audit

The shotboard must include exact start/end timecodes and a duration column. Check:

- Every duration fits the target endpoint.
- Scene totals equal clip totals.
- Film total equals the brief.
- Dialogue fits natural speaking time.
- No clip contains more visible action than its duration can communicate.
