# Host Tool Diagnostics

The old REQUIRES_INSTALL_RESTART_AND_SESSION_CHECK value was hardcoded. It did not
measure restarts, running processes, plugin loading or session tool exposure. Never
use it (or UNKNOWN_NOT_MEASURED) as evidence that a user did not restart correctly.

Four separate facts must be recorded: bundle integrity; installed plugin entry import
and tool export; the actual host's resolved plugin/provider configuration; tool
exposure in the current Agent/API request. Only the last fact proves callable tools
for this session. Files on disk and mocked implementation tests do not prove it.

After one confirmed full host restart, stop repeating restart instructions. Run the
bundled Diagnose.cmd with --project pointing to the actual project. It reads only
safe summaries of the CLI's resolved config, never prints raw config/keys, and probes
the installed wrapper with all network calls prohibited. Diagnose.cmd supports
--target for nondefault config paths and --opencode for an explicit host CLI path.
CLI and Desktop/remote hosts may be different versions, users, processes or config
roots; CLI evidence cannot certify the current Desktop/API session.

Investigate missing import/dependencies, incorrect config root, --pure/plugin-disable
flags, actual plugin discovery, agent tool permissions and model tool-list filtering.
Record evidence and exact errors; do not silently change permissions, provider keys
or global config. A discoverable global plugins/fast-image.ts does not require a
redundant guessed opencode.json registration. Use the host's resolved config to decide.

Installation now probes the actual wrapper, using an explicit .ts import. Passing
the probe is a standalone Bun import check, not proof of compatibility with every
OpenCode host. Missing live tools still block image execution; never bypass with an
ad hoc API. Asset-independent script extraction, segmentation and audit state can
continue and should be persisted even when paid generation is blocked.
