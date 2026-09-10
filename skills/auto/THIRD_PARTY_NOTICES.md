# Third-Party Notices

The Auto Skill's original production rules, templates and workflow are licensed
under Auto's MIT license. Integrated source snapshots under `modules/` retain
their original notices and licenses; bundling them locally does not relicense them.

Integrated snapshots include story direction, cinematic direction, cinematic
prompt guidance, image execution guidance, LibTV CLI documentation and the
user-provided TSC prompt compiler. Each module is entered through `MODULE.md`, keeps its
source entry as `SOURCE-SKILL.md`, and is not registered as a standalone Skill.

Full execution can call two external tools through their installed interfaces:

- `direct_image_run`: executes a finalized Auto image batch. Its implementation,
  configured provider and generated media remain subject to their own terms.
- `libtv`: executes account, canvas, model, node, generation and download commands.
  Its executable, remote service and generated media remain subject to their own
  terms.

Live tool schemas and verified command output control technical capabilities.
This notice does not grant rights to any external service, model or generated asset.
