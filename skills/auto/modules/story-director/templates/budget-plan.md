# Budget Plan

- Unit: generation_attempts | credits | currency
- Authorization status: proposed | approved
- Authorized by:
- Authorized at:
- Primary clips:
- Primary attempt multiplier:
- Pickup reserve clips:
- Pickup attempt multiplier:
- Estimated attempts: `ceil(primary clips x primary multiplier) + ceil(pickup clips x pickup multiplier)`
- Maximum ordinary clip attempts:
- Maximum hero clip attempts:
- Warning fraction:
- Project hard stop:
- Current spent:
- Total submitted attempts:
- Next job estimate:
- Estimate currency/credit unit:
- Estimate source and date:
- Provider cost assumptions and date:

## Authorization Rules

- Do not submit a paid job while authorization status is not `approved`, or while unit/hard stop is unset.
- For attempt units, increment project spend by one. For credit/currency units, preflight the dated next-job estimate and reconcile the actual charge. Always increment clip and project attempt counters when a job is submitted.
- At the warning threshold, compare remaining unresolved clips with remaining budget.
- At the hard stop, choose editorial repair, redesign, or explicit additional-budget approval.
