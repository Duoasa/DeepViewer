# Verification
Status: Implementing (AC-005 Pending Manual). Date: 2026-10-20.

| Criterion | Status | Evidence |
| --- | --- | --- |
| AC-001 | Pass | `node apps/deepviewer-desktop/scripts/build-native-desktop.mjs`; `node apps/deepviewer-desktop/scripts/smoke-native-host.mjs`; `node apps/deepviewer-desktop/scripts/smoke-figma.mjs`. Native bridge starts; 17 canvas tools plus setup/status/selection tools and figma-workbench skill; same smoke passes against isolated materialized runtime using DEEPVIEWER_RUNTIME_OVERRIDE. |
| AC-002 | Pass | 33 upstream fixtures cover HTTP MCP, authentication, private companion, workspace/document boundaries, mutation recovery. Native Host smoke covers occupied port recovery and diagnostic flags overriding explicit enable. `pnpm desktop:smoke`: 122 tests including Figma activation/config backup, migration retry and disabled choice preservation. |
| AC-003 | Pass | Root/desktop/adapter 0.7.3; bilingual designer positioning, attributed MIT product image and setup/limits. |
| AC-004 | Pending | Fresh Build 93 runtime: 636 packages, 23,397 ASAR entries / 5,988 resource files privacy audit passed. Signed DMG and public digest verification pending. |
| AC-005 | Pending Manual | Maintainer real Figma pairing and canvas editing/export in DeepViewer. No UI automation or real document mutations were performed. |

Other regression: `pnpm typecheck`; fresh-source contract smoke (167 contracts, idempotent, agent loop unchanged); `smoke:contracts` (76), `smoke:ui-regression` (202), `smoke:plugins` native model scan/apply/restore and four fixture payloads passed.

## Plugin gates on DSH 0.2.1-rc.2

| Check | DVP-0001 subscriptions | DVP-0006 models | DVP-0007 adapter | DVP-0008 Figma |
| --- | --- | --- | --- | --- |
| PC-001 | Pass, pinned 0.3.1 | Pass, source 1.0.2 | Pass, source 0.7.3 | Pass, upstream v0.2.1 commit and file hashes + MIT |
| PC-002 | Pass, native Host | Pass, Host/payload fixture | Pass, native build | Pass, compatible singleton kernel peers; isolated exact MCP SDK 2.0.0 |
| PC-003 | Pass, Host RPC | Pass, Host RPC | Pass, Host composition | Pass, Host-only native row, no invented client/bundle |
| PC-004 | Pass, build/202 regression | Pass, advertised client | Pass, build/202 regression | Pass, Host-only, no UI slot required; paired template and skill fixture |
| PC-005 | Pass, empty account status | Pass, scan/apply/restore fixture | Pass, Work/Chat/Synapse RPC | Pass, native tools/skill, screenshot attachment, workspace export fixture |
| PC-006 | Pass, existing isolated scope | Pass, private store fixture | Pass, authenticated Host | Pass, loopback Host/origin/token, private files, no credentials in payload |
| PC-007 | Pass, pure core escape | Pass, pure core escape | Pass, pure core escape | Pass, occupied port keeps Host alive, disable wins over stale overrides |
| PC-008 | Pending final signed package | Pending final signed package | Pending final signed package | Pending final signed package; relocated production closure smoke passed |
| PC-009 | Pending Manual, real account | Pending Manual, real API | Pending Manual, remaining interactions | Pending Manual, actual Figma pairing/edit/export |

Reproduction: Node 24, install locked root and pinned Harness dependencies, build native desktop, run the commands above. Fixtures own temporary homes and use fake model/Figma services. They do not establish real-editor acceptance. Final package/publication evidence is recorded in ../../releases/v0.7.3.md.
