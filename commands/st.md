---
description: Generate or edit images through the fast direct image route.
---

Run this exact current-turn image request through the fast image adapter:

`$ARGUMENTS`

Attached images are references. Do not inspect files, rewrite the prompt, call a
skill, invoke PowerShell, retry, or make a second tool call. The adapter performs
one bounded concurrent batch and returns the generated images as assistant-side previews.
The plugin stores full originals locally and renders local loopback previews with
original-image links in this same assistant result. It never writes image parts to
the user's request message. Delivery does not create a second model turn or retry
the image provider.
