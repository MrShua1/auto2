# Reference Plan

- Project ID:
- Selected generation mode: t2v | first_frame | first_last_frame | multimodal_reference | unknown
- Text canon status: draft | locked
- Continuity risk if T2V without media refs: low | medium | high

| Asset ID | Type | Required role | Purpose | Creation/acquisition prompt or source | Candidate path | Approved canonical path | Approval status | Approved by/date |
|---|---|---|---|---|---|---|---|---|
| REF001 | image | first_frame | identity/location/endpoint |  |  |  | planned |  |

## Gate

- T2V: pass media-reference gate with an empty role map only when text canon is locked and T2V is explicitly selected.
- First-frame: approve exactly one start image.
- First/last-frame: approve exactly one start and one end image.
- Multimodal reference: approve at least one image or video and obey all endpoint caps.
- Candidate or unreviewed outputs never count as approved canonical references.
