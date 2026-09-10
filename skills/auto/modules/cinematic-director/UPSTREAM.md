# Upstream And Local Patch

- Repository: <https://github.com/wuwangzhang1216/DirectorSKILL>
- Installed Skill: `cinematic-director`
- Pinned commit: `47db7d9b951a9f27f7b4b727a6ca0e01ab56f7c6`
- Upstream version: `2.0.0`
- Retrieved: `2026-07-28`
- License: MIT; see `LICENSE`

## Local Patch

`user-authored-shot-lock/1.0` makes explicit user-supplied shot order,
subject, scale, viewpoint, angle, screen direction and action instant immutable.
The director grammar may fill unspecified production fields or report a physical
conflict, but it may not silently replace the user's coverage.

The behavior is represented by the `user-authored-shot-order-lock` case in
`evals/evals.json`. All other upstream files and behavior remain available.
