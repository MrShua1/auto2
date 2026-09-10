# Image Execution Module

Internal Auto snapshot of the image execution contract. It documents route,
references, direct execution, concurrency and output behavior.

When the finalized asset registry contains generation-required rows, read
`SOURCE-SKILL.md` locally for provider details and execute only through the installed
`direct_image_run` tool. With zero generation-required rows, skip this module and tool
availability check. Do not invoke the original external Skill.
Auto's current `references/internal-image-execution.md` and hard gates override
older retry or continuation language in this source snapshot.

For new character and wardrobe assets, also read
`../../references/character-asset-standard.md` before composing image prompts.
Its mandatory left-one/right-two layout overrides older single-view/no-grid defaults.
