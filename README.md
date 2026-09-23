# DeepViewer

DeepViewer is an independent, open-source macOS workspace built on [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It packages the agent runtime as an Apple Silicon desktop app and adds Work and Chat spaces, file delivery, a sidebar workbench, and desktop controls. It is a community project, not an official DeepSeek product.

**Current release: 0.3.3 (Build 75)** · DeepSeek Harness `0.1.5-rc.2` · macOS Apple Silicon (arm64)

[Download the signed and Apple-notarized DMG](https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3) · [简体中文](README.zh-CN.md) · [Release notes](docs/sdd/releases/v0.3.3.md)

<p align="center"><img src="Resources/screenshots/image-delivery.png" width="1100" alt="DeepViewer conversation delivering a generated image as a file attachment with a working sidebar preview"></p>

## What changed since the previous public release (0.2.5)

| Area | Changes in 0.3.3 |
| --- | --- |
| Work and Chat | Separate workspace-backed Work sessions from workspace-free Chat history. Create projects from the sidebar, search Chat history, and recover session mode and titles after a restart without opening every conversation. |
| Files and previews | Deliver generated images and other files as attachment cards. Materialize external or extensionless outputs inside the session workspace with an appropriate extension so the card and sidebar preview refer to the same file. |
| Sidebar workbench | Integrate the open-source Better Sidebar workbench for files, editor, terminal, Git and browser panels. Desktop adaptations preserve window chrome, session-relative paths, navigation, and authentication checks. |
| Models | Add a first-party reasoning and multimodal capability editor with bounded model scanning. Provider support is checked per model; a successful scan does not guarantee every provider feature works. |
| Progress and appearance | Group related context and operations into expandable summaries, align their text and multimodal status with the conversation font-size setting, add clearer hover states, image-generation shimmer, and a 12 × 12 px Drive activity indicator. Settings layout and system appearance follow the desktop shell. |
| Networking | Use the system proxy/PAC configuration for the bundled runtime, preserve explicit proxy settings, show clearer connection errors, and request scoped permission before accessing private-network addresses. |
| Upgrade continuity | Installed and development editions use separate, fixed data directories. First launch imports older same-edition sessions and attachments with backups; later app and Harness versions reuse the fixed directory. Cold session lists restore Work/Chat classification from persisted events. |

The removed Taskboard integration is **not** included. Some provider, sidebar, and migrated-data flows still need real-account and manual UI acceptance; see the [release record](docs/sdd/releases/v0.3.3.md) for the verification boundary.

### Work, Chat, and process disclosure

Work groups sessions by project. Chat keeps conversations independent of a workspace. Both modes restore their history on startup, and related context, reasoning, searches, and operations appear in expandable summaries.

![A Work project and its conversation history](Resources/screenshots/work-session.png)

![Workspace-free Chat with expanded process disclosure](Resources/screenshots/chat-and-disclosure.png)

### Files and sidebar workbench

The sidebar can inspect workspace files, preview generated HTML, and browse pages alongside the conversation. File paths, panel navigation, and browser access are connected to the active desktop session.

![A web page opened beside a Work conversation](Resources/screenshots/browser-workbench.png)

![A generated HTML page in the sidebar preview](Resources/screenshots/html-preview.png)

### Generated images and attachments

Generated files are delivered as attachment cards with usable names and extensions. The same workspace copy opens in the sidebar preview, including images first produced outside the workspace.

![Generated image attachment and sidebar preview](Resources/screenshots/image-delivery.png)

![Image generation result shown with its process and sidebar preview](Resources/screenshots/image-generation.png)

### Appearance and version identity

Settings follow the desktop appearance, and the About page shows the app build and bundled Harness version.

![About DeepViewer showing version 0.3.3 Build 75 and Harness 0.1.5-rc.2](Resources/screenshots/about-version.png)

## Install and data

1. Download `DeepViewer-0.3.3-macos-arm64.dmg` and check it against `SHA256SUMS.txt` in the [release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.3.3).
2. Open the DMG and copy `DeepViewer.app` to Applications.
3. Open the app and configure a provider or subscription. No global Node.js or Harness installation is needed.

DeepViewer binds its local service to a random loopback port. Installed app data lives in `~/Library/Application Support/DeepViewer`; development app data lives in `~/Library/Application Support/DeepViewer Dev`. Replacing the application does not replace these directories. Legacy data is copied and verified before first-use cutover; migration backups are retained. Keep your own backup before a major upgrade.

The release package is built from a clean allowlist of application code, pinned runtime packages, assets, and licenses. It does **not** contain the maintainer's sessions, workspaces, settings, logs, account credentials, home-directory paths, or development handoff files. The packaged app is audited before signing and publication.

## Open-source foundations and DeepViewer modifications

| Component | Source and license | What DeepViewer changes |
| --- | --- | --- |
| Core agent | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), MIT, pinned to `fb2c4b9e698e30edb738bca4cf0618587db7d203` (`0.1.5-rc.2`) | Desktop integration and a [reproducible source patch](upstream/snapshots/v0.3.3/README.md) for Work/Chat, session recovery, file delivery, progressive disclosure, themes, and network bridging. The agent loop remains upstream-owned. |
| Subscriptions and image tools | [V1ki/dsh-plugin-subscriptions](https://github.com/V1ki/dsh-plugin-subscriptions), MIT, `0.3.1` | DSH 0.1.5 compatibility adapter, scoped RPC/loopback checks, remaining-usage display, and image-generation status styling. |
| Sidebar workbench | [omdsh-dev/DSH-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar), MIT, `0.19.1` | macOS chrome and settings adaptation, native panel routing, session-relative paths, and desktop browser/authentication integration. |
| Model capability editor | [DeepViewer first-party plugin](apps/dsh-plugin-reasoning), MIT, `0.1.0` | Provider/model scanning and manual reasoning and multimodal capability configuration. |

The historical first-party preview plugin is disabled in favor of the Harness preview. [dashi-taskboard](https://github.com/chuspeeism/dashi-taskboard) was evaluated and removed; no Taskboard runtime is bundled. Upstream copyrights and third-party licenses remain with their respective projects.

## Build from source

Requires macOS arm64, Node.js 24+, and pnpm 11.19.0. The committed patch reconstructs the exact Harness source used for this release from the pinned upstream commit; no user data or prebuilt app is needed.

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install --frozen-lockfile
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout fb2c4b9e698e30edb738bca4cf0618587db7d203
git -C upstream/deepseek-harness apply --whitespace=nowarn ../snapshots/v0.3.3/harness.patch
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm --dir upstream/deepseek-harness run build:official
pnpm desktop:build
```

`pnpm desktop:build` increments the local build number for continued development. The [snapshot instructions](upstream/snapshots/v0.3.3/README.md) explain how to reproduce fixed Build 75, including Runtime packaging, Developer ID signing, and Apple notarization. Signing credentials stay in the local Keychain and are never committed.

The [SDD documents](docs/sdd/README.md) record architecture, plugin provenance, requirements, and verification. DeepViewer's original code uses the [MIT License](LICENSE); all upstream licenses remain applicable.

Report issues in [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues). Please omit credentials, private files, and unredacted logs.
