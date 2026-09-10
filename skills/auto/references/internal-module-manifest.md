# Auto Internal Module Manifest

This manifest makes the Auto directory portable across compatible agents and
models. The agent must not resolve production behavior from any Skill outside
this directory.

## Load Order

Auto D releases additionally load `references/auto-d-portability-and-materials.md`
first. All eight module directories (including cinematic-director, story-director,
storyboard-director and keyframe-storyboard) and their complete local resources are
release dependencies, not optional files to omit from a portable archive. The bundled
direct-image runtime must be installed before a missing tool can be treated as ready.

1. `SKILL.md`: trigger, modes, authority, hard gates and output contract.
2. `references/workflow.md`: ordered production stages and resume behavior.
3. `references/internal-production-rules.md`: story, canon, blocking, coverage,
    camera, asset prompts and review boundary.
4. `modules/*/MODULE.md`: stage-specific full rule snapshots and local resources.
5. `references/internal-image-execution.md`: image route, jobs, direct execution,
   concurrency, failure repair and mechanical validation.
6. `modules/tsc/MODULE.md`: exclusive backend-neutral reference-aware video-prompt compilation.
7. `references/quality-gates.md`: transition checks and complete delivery gate.
8. `references/libtv-runbook.md`: direct CLI preflight, node execution and download.
9. `templates/`: package layout, state, clip contract and asset workbook schemas.
   Every new project also instantiates `templates/production-profile.json`.
   Auto 2.3 projects additionally instantiate `project-inventory.json`,
   `script-preview.md` and `asset-requirements.json`.
10. `scripts/validate-video-prompts.cjs`: Auto-owned mechanical validation for the
    complete TSC prompt set before packaging or LibTV execution.
11. `scripts/validate-prevideo-delivery.cjs`: final `/分集` delivery gate and atomic
    completion-state update.
12. `scripts/build-episode-segment-package.ps1` and
    `scripts/build-asset-workbook.ps1`: fixed package/workbook builders with approval
     and path-safety checks.
13. `scripts/scan-project-root.cjs` and
    `scripts/build-image-requirements-workbook.ps1`: recursive intake inventory and
    version-level image-requirement workbook.
14. `scripts/audit-segment-progress.cjs`: unique segment-count, duration-total and
    separate per-artifact progress audit.

## Integrated Modules

| Module | Entry | Purpose |
|---|---|---|
| Cinematic prompt | `modules/cinematic-prompt/MODULE.md` | Still-image LOOK, camera, light and anti-slop language |
| Image execution | `modules/image-execution/MODULE.md` | Route, direct calls, references, concurrency and outputs |
| LibTV CLI | `modules/libtv-cli/MODULE.md` | Optional LibTV adapter command, node, model and schema documentation |
| TSC | `modules/tsc/MODULE.md` | Exclusive video-prompt compilation from script, segment assets and sound references |

## Capability Coverage

| Capability | Internal owner |
|---|---|
| Episode boundary and story spine | `internal-production-rules.md` |
| Project genre, medium, audience, LOOK and prompt policy | `productionProfile` plus `internal-production-rules.md` |
| PROJECT_ROOT inventory and script preview | `workflow.md` plus `scan-project-root.cjs` |
| Unique segment count and artifact progress | `audit-segment-progress.cjs` |
| Version-level asset universe and image requirement workbook | `asset-requirements.json` plus `build-image-requirements-workbook.ps1` |
| Beat and clip decomposition | `internal-production-rules.md` |
| Blocking, axis, eye lines and coverage | `internal-production-rules.md` |
| Identity, wardrobe, location, prop and LOOK continuity | `internal-production-rules.md` |
| Default three-candidate generated asset policy | `internal-production-rules.md` plus `internal-image-execution.md` |
| Canonical asset candidate count and still contracts | `internal-production-rules.md` |
| Paid image task execution | `internal-image-execution.md` plus `direct_image_run` tool |
| Failed-image three-candidate repair | `internal-image-execution.md` |
| Reference-aware video-prompt compilation | `modules/tsc/MODULE.md` |
| Complete prompt-set mechanical validation | `scripts/validate-video-prompts.cjs` |
| Final pre-video delivery validation | `scripts/validate-prevideo-delivery.cjs` |
| Fixed package and approval workbook | `scripts/build-episode-segment-package.ps1` and `scripts/build-asset-workbook.ps1` |
| Image and prompt delivery before video | `quality-gates.md` |
| Optional LibTV schema checks, upload, run and download | `libtv-runbook.md` plus `libtv` executable |
| Resume and auditable state | `workflow.md` and templates |

## Allowed External Interfaces

- `direct_image_run`: tool call only when image generation is required; never load an image-generation Skill.
- `libtv`: executable only when LibTV is selected; never load a LibTV Skill.
- Local filesystem and ordinary shell utilities for package creation, validation
  and reporting.

## Prompt Compilation Boundary

TSC compilation is a semantic Agent operation governed entirely by
`modules/tsc/MODULE.md`; it is not delegated to an external Skill. The Agent reads
each complete handoff and writes the corresponding `prompt.txt`, then runs Auto's
own `scripts/validate-video-prompts.cjs`. Project-local helper scripts may prepare
project data, but they are never a required Auto dependency or an authority for
prompt rules. A workflow that cannot compile and validate from this Auto directory
plus the supplied project artifacts is `BLOCKED`, not silently outsourced.

## Forbidden Dependencies

- No external Skill loading, delegation or fallback.
- No reading files outside this Auto directory for production rules. Renamed
  `modules/*/SOURCE-SKILL.md` snapshots and their local resources are allowed.
- No silent provider or model substitution.
- No reliance on conversational memory for a rule that should be in this folder.

If an allowed tool is unavailable, record the exact blocker in `auto-state.json`
and `release-report.md`. Do not leave the Auto directory to find replacement rules.
