# Third-Party Sources And License Boundaries

This package is a new, deduplicated synthesis. It does not bundle third-party repositories, checked-in example films, API credentials, copyrighted prompt archives, or model binaries.

Access/research date: 2026-07-23 to 2026-07-24.

## Retained Licensed Sources

| Source | Pinned research SHA | License | Ideas retained |
|---|---|---|---|
| [g0dam/video-studio-skills](https://github.com/g0dam/video-studio-skills) | `a99151bc42f8de7a73a6ca3caa2ab10a6a653a46` | MIT | Production gates, story/asset/shotboard separation, cut and audio continuity, release QA |
| [Emily2040/seedance-2.0](https://github.com/Emily2040/seedance-2.0) | `57d01dc66f93ecb03c2475be5f22dc416d9b701d` | MIT | Project state, planned-vs-observed endpoints, next-clip-only compilation, take review, chain caps, re-anchoring |
| [crowscc/seedance-director](https://github.com/crowscc/seedance-director) | `2f0525b3be9b45d5ef2d5d67568b1c6cd562a1c9` | MIT | Chinese Seedance/即梦 production dialogue, timed segments, asset bindings, paste-ready prompt organization |
| [woodfantasy/Seedance2.0-ShotDesign-Skills](https://github.com/woodfantasy/Seedance2.0-ShotDesign-Skills) | `a45e8b8ec1b3494375cd8c49bef9a6f5096f3f44` | MIT-0 | Prompt lint principles, concrete motion/light language, rejection of vague cinematic filler |
| [TateZhouSiu/create-storyboard-skill](https://github.com/TateZhouSiu/create-storyboard-skill) | `4b8662e2fee51b37488c77952bbfa302bfeaf36c` | MIT | Stable asset/shot IDs, handoff/edit matrices, clean-keyframe doctrine |
| [wuwangzhang1216/DirectorSKILL](https://github.com/wuwangzhang1216/DirectorSKILL) | `bce9b5bfe351c26d4d14f9d24313ce476c0c5c6c` | MIT | Compact failure-to-repair categories; full pipeline intentionally not retained |
| [whystrohm/shotkit](https://github.com/whystrohm/shotkit) | `673ee9967efe941d6d8dcfe029694e330a48d198` | Apache-2.0 | Machine-readable shot fields and accept/revise/reject review concepts |
| [a86582751/doubao-seedance-video-skill](https://github.com/a86582751/doubao-seedance-video-skill) | `2b56c31b3e99f193933616c8afdd26a1a2e064fd` | MIT | EDL, pickup, post-cut audio rebuild, and cost-preflight concepts; vendor paths/code not copied |
| [RandomNest/aivideo-production-skills](https://github.com/RandomNest/aivideo-production-skills) | `77b3dc44266bb7a52e675ab50ebf3f5d67db1cdb` | MIT | Budget hard-stop and state-diff concepts; incomplete pack not bundled |

The license files and copyright notices remain in their canonical repositories. This package's original synthesis and templates are distributed under MIT. If substantial third-party code or text is added later, copy the applicable copyright and license notice into this file.

## Explicitly Excluded

- Repositories with no verifiable license, including public-but-unlicensed prompt/production packs identified during research.
- All-rights-reserved prompt archives or internal-only AgentKit samples.
- Traditional screenplay, fiction, coverage, Fountain/FDX, and live-action-only skills.
- Duplicate forks and mirrors.
- Pure API wrappers and hard-coded credentials.
- Stale platform facts treated as universal truth.
- Shot-for-shot recreations or copied dialogue from copyrighted films.

## Platform Facts

`references/04-seedance-constraints.md` is a conservative, dated synthesis. Some API fields were corroborated through high-fidelity provider schemas because official documentation pages were dynamically gated during research. The skill therefore requires endpoint-specific verification before execution and labels uncertainty instead of claiming universal support.

## Optional Bundled Restricted Skill

The surrounding desktop Skill bundle may also contain the separate
`cinematic-prompt-engine` directory from
<https://github.com/Leo414x/AI_Cinematic_Prompt>, copyright (c) 2026 Leo414x.
It is not part of this MIT-licensed synthesis and is not relicensed here. It
retains its own restricted `LICENSE`, author attribution, source repository,
documentation and tests. This director Skill contains only an interoperability
boundary and routes compatible personal/non-commercial still-image LOOK tasks to
that independently licensed Skill.
