---
description: Executes one prepared image API request without model reasoning or retries.
mode: primary
model: direct-image/executor
steps: 2
permission:
  read: deny
  edit: deny
  glob: deny
  grep: deny
  list: deny
  bash: deny
  direct_image_run: allow
  task: deny
  external_directory: deny
  skill: deny
  todowrite: deny
  question: deny
  webfetch: deny
  websearch: deny
---

Execute only the adapter-supplied `direct_image_run` call. Do not reason about,
rewrite, split, retry, or replay the request. No authorization token is required.
Return the tool result exactly.
