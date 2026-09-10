# Source Notes

## Original File

- Path at conversion: `C:\Users\95443\Desktop\skills\gpt_10秒分镜九宫格提示词.md`
- SHA-256: `ab46095785e3fb84a03195af0c53816bb44b26028ba10d17c703d206e53774c7`
- Size: 7,463 bytes
- Original date claims: local test dated 2026-07-23
- Backup: `source-backup/gpt_10秒分镜九宫格提示词.md`

The original file remains in place and is not modified by this package.

## What Was Learned

- The original note represented one 9-12 second scene with exactly nine visual beats.
- Production use showed that fixed-nine allocation often creates duplicate states and unnecessary identity drift.
- Version 2.0 therefore selects the minimum sufficient 1-9 panels from visible state changes; nine and 3x3 remain supported special cases.
- The deliverable combines shot metadata, per-frame still prompts, continuity anchors, an optional adaptive contact sheet, and negatives.
- Character, clothing, props, scene, palette, and lighting must remain coherent across all panels.

## Operational Improvements

- Durations must sum exactly rather than approximately.
- Each panel must advance the micro-story rather than merely vary camera angles.
- Per-panel prompts describe frozen stills; camera movement is retained only as future shot intent.
- Clean and labeled board modes are separated because image-generated text is unreliable.
- The full board is explicitly review material, not a clean I2V first frame.
- Historical model sizes, proxy behavior, endpoints, credentials, and local scripts are not treated as portable/current truths.
- Current API/model support must be checked before any execution.
- Panel count is now justified by start/action/reaction/end states rather than duration or a fixed grid.
- Independent 16:9 frames are generated first; combined boards should be assembled from approved frames.
- Adaptive layouts support 1, 2, 3, 4, 6, 8, or 9 equal cells. Five- and seven-panel boards use deterministic post assembly or remain individual frames.
- Version 2.3 makes duration capability-driven: 4-15 seconds remains the portable default, while a verified Seedance 2.5 endpoint may accept clips up to 30 seconds.
- Extended duration never forces extra panels. More than nine indispensable states require either multiple sequential boards for one continuous action chain or multiple video clips for independent action chains.

## Provenance Mentioned By The Original Note

The note says its structure was informed by:

- `chaoka-wooji/cinematic-storyboard-skill`
- `wassermanproductions/storyboard-reference-studio`

This package does not copy or bundle either repository. Their current source, license, and API compatibility were not required to preserve and operationalize the user's own note.
