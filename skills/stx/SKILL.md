---
name: stx
description: Use when the user says stx or /stx for Grsai gpt-image-2 image generation or reference-image editing.
---

# STX Image Generation

Use direct_image_run with route="stx". This route uses
https://grsai.dakka.com.cn/v1/api/generate with model gpt-image-2,
replyType=json, aspectRatio, and images (reference data URLs).

- Default: one image, 1K, 16:9, automatic quality, PNG.
- Supports the fast image tool's aspect ratios, up to four references per job,
  and batches with provider concurrency capped at ten.
- Ordinary gpt-image-2 supports 1K only. Reject 2K/4K instead of switching to VIP.
- Non-auto quality is not supported by this adapter. PNG/JPEG/WebP output is
  encoded locally after the provider image is downloaded.
- Credentials: IMAGE_API_STX_KEY, otherwise IMAGE_API_STX_CONFIG or
  %USERPROFILE%\Desktop\gaisc.json. Never print keys or pass them in arguments.
- Preserve direct prompts and attached reference roles. Do not retry paid
  failures, timeouts, or switch routes automatically.
- Originals and previews use the existing fast-image local output service.

## Reliability And Batch Guidance

- Global provider concurrency remains capped at 10. Use bounded batches for long
  asset tables so progress returns regularly; batch size is not a concurrency limit.
- Each stx job receives its own 10-minute generation timeout after acquiring a
  provider slot, followed immediately after provider success by a fresh 2-minute
  download/validation/conversion budget. Timeouts are recorded as generation_timeout
  or download_timeout, not invalid_image. Host cancellation aborts active network
  requests and prevents queued submissions. Native image processing cannot be forcibly
  interrupted by AbortSignal; its result is checked again before acceptance.
- Images are saved as each job finishes, before the rest of the batch completes.
  Per-job `.status.json` files record stage, submission uncertainty, task ID,
  timings and saved path. Interrupted submissions may still be billed; do not
  equate planned jobs, submitted jobs and successful results.
- Cancellation during a save already in progress does not delete completed files.
  Such a result can have phase=saved and cancelled=true; savedPath still identifies
  the archived image. Do not regenerate it. Conversion errors use conversion_failed.
- Only transient GET failures downloading an already-generated image receive up to
  three attempts. No automatic regeneration POST, credential retry, route switch
  or safety-filter bypass is performed. A matching image format is saved without
  unnecessary re-encoding.
- Validate complete image decoding before marking a result saved; a valid file
  header alone is not sufficient. Decode failures are recorded as invalid_image.
- Output names are checked before paid requests for collisions after truncation,
  sanitization and case folding. Use distinct IDs; conflicting names block the
  whole batch. Hard-link publication is atomic and never replaces an existing image.
  Unsupported hard links fall back to exclusive copy, which also refuses replacement
  but is not atomic: a process crash can leave a partial file. Require a completed
  saved status before treating that path as archived. Save errors are recorded;
  unsuccessful saves report generated_not_saved with bounded inline-result fallback.
- For asset-only requests, describe the relevant visible subject and clothing,
  not unrelated screenplay events. Keep genuine safety requirements and source
  facts; never promise that wording changes guarantee provider acceptance.
- These changes do not make provider inference faster or guarantee success.

Examples: `stx a red ceramic cup, 1:1`, `stx 16:9 rainy street`,
`stx parallel 3, a modern museum interior`.

API reference: https://qmy27nhsd9.apifox.cn/452409160e0
