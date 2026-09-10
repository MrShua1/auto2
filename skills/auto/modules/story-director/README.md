# AI Short Film Director

A unified Agent Skill for 1-10 minute AI-generated narrative shorts. It is Chinese-first, model-agnostic at the planning layer, and includes a Seedance/即梦 prompt adapter.

## Contents

- `SKILL.md`: router, hard rules, gates, and output contract.
- `references/`: story, assets, shot design, constraints, runtime continuity, prompt compilation, repair/budget, and post-production.
- `templates/`: reusable production artifacts.
- `examples/`: a compact dry-run example showing the intended state flow.
- `THIRD_PARTY_NOTICES.md`: source and license record.

## Use

Point an Agent Skills-compatible host at the parent `skills` directory, or copy this folder into a host's standard skills path. The folder name and frontmatter name are both `ai-short-film-director`.

This directory is a portable package only. It does not contain API keys, paid generators, model binaries, or third-party repositories.

## Recommended Invocation

```text
Use ai-short-film-director to turn this idea into a five-minute Chinese AI short for Seedance. Complete G0-G3, create the project-state seed, and compile only Clip 01.
```

After rendering Clip 01:

```text
Review this take against CLIP001, record the observed end state, then compile the next unresolved clip or prescribe a minimal repair.
```
