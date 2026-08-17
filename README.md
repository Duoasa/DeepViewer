<p align="center">
  <img src="Resources/DeepViewer-Icon.png" width="160" alt="DeepViewer app icon">
</p>

<h1 align="center">DeepViewer</h1>

<p align="center">
  A visual, controllable, and customizable desktop workspace for DeepSeek Harness.
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/Duoasa/DeepViewer?display_name=tag&include_prereleases"></a>
  <a href="https://github.com/Duoasa/DeepViewer/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Duoasa/DeepViewer/actions/workflows/ci.yml/badge.svg"></a>
  <img alt="macOS Apple Silicon and Intel" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-111111?logo=apple">
  <img alt="Electron 43" src="https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.2-build.2"><strong>Download DeepViewer 0.1.2 (Build 2)</strong></a>
  ·
  <a href="#whats-new-in-012-build-2">What’s new</a>
  ·
  <a href="#privacy-by-design">Privacy</a>
  ·
  <a href="#build-and-test">Build from source</a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
</p>

DeepViewer is an independent, open-source desktop agent workspace built on
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It bundles
the pinned local runtime into a normal macOS application and provides a desktop
shell designed for a visual, controllable agent experience.

<p align="center">
  <img src="Resources/DeepViewer-0.1.2-Dark.jpg" width="100%" alt="DeepViewer 0.1.2 in dark mode">
</p>

> [!NOTE]
> DeepViewer is a community project. It is not affiliated with or endorsed by
> DeepSeek.

> [!IMPORTANT]
> `v0.1.2-build.2` is the latest macOS UI preview (app version `0.1.2`, build
> `2`). It has passed the maintainer's visual and package acceptance, but it is
> still an early preview rather than a stable release.

## Why DeepViewer

| | |
| --- | --- |
| **Desktop first** | Launch the agent as a normal macOS application without manually running Node, npm, pnpm, or a Web UI command. |
| **Self-contained runtime** | Ships the pinned Harness runtime and compatible execution environment inside the application. |
| **Native Mac packages** | Provides separate arm64 and x64 packages for Apple Silicon and Intel Macs. |
| **Integrated macOS shell** | Uses native traffic lights inside the application, a full-width drag region, and a Codex-style collapsible sidebar. |
| **Local by default** | Runs Harness on a random `127.0.0.1` port and does not expose the service to the LAN. |
| **Controlled lifecycle** | Starts, health-checks, monitors, retries, and stops Harness together with the desktop application. |
| **Clean public artifacts** | Rebuilds each public package from allowlisted inputs and blocks releases containing developer paths, settings, or credential values. |
| **Spec driven** | Keeps product intent, architecture, implementation tasks, and verification evidence in a committed SDD system. |

## Quick start

1. Download the package that matches your Mac from the
   [0.1.2 Build 2 release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.1.2-build.2).
2. Open the DMG and copy `DeepViewer.app` to Applications.
3. Open DeepViewer. It starts the bundled Harness automatically and loads the
   local workspace when the runtime is ready.

| Mac | Download | SHA-256 |
| --- | --- | --- |
| Apple Silicon (`arm64`) | [DeepViewer-0.1.2-macos-arm64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.2-build.2/DeepViewer-0.1.2-macos-arm64.dmg) | `e7385a3de4b912fadf6154b0ffe682173efa293e4171234ff20566a8c6e30eea` |
| Intel (`x64`) | [DeepViewer-0.1.2-macos-x64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.2-build.2/DeepViewer-0.1.2-macos-x64.dmg) | `02f2dca62d68431db60f355837709d9bc02b0de9522f6254cd6d9e2eb514cc08` |

The release also includes a
[`SHA256SUMS.txt`](https://github.com/Duoasa/DeepViewer/releases/download/v0.1.2-build.2/SHA256SUMS.txt)
manifest for command-line verification.

## What's new in 0.1.2 (Build 2)

<p align="center">
  <img src="Resources/DeepViewer-0.1.2-Dark.jpg" width="49%" alt="DeepViewer 0.1.2 in dark mode">
  <img src="Resources/DeepViewer-0.1.2-Light.jpg" width="49%" alt="DeepViewer 0.1.2 in light mode">
</p>

- Opens `http` and `https` links in the system browser while continuing to deny
  unexpected navigation inside the privileged desktop window.
- Adds a native context menu for local artifact paths, including `finder中显示`
  / `Show in Finder`, which reveals the containing folder and selects the file.
- Advances the macOS bundle build number to `2` and fixes release Runtime script
  invocation for the pinned pnpm 11 toolchain.
- Restructured the macOS window as two visual columns—sidebar and Chat—with
  structural safe areas inside each column instead of a separate full-width bar.
- Moved model usage statistics into the centered Chat safe area and fixed the
  composer to the same 32px bottom baseline in new, thinking, streaming, and
  completed states.
- Added a full-Chat-canvas welcome surface with a 48px half-opacity animated
  DeepViewer mark and the localized “What shall we build?” headline.
- Refined the inline sidebar wordmark, native focused-window material, solid
  unfocused state, light/dark fade continuity, fixed sidebar toggle, and native
  control readability.
- Added tracked upstream UI overrides with deterministic sync/build checks, plus
  isolated development, local ARM preview, and explicit release workflow tiers.
- Rebuilt separate arm64 and x64 DMGs from allowlisted inputs. Both packages are
  Developer ID signed, Apple-notarized, stapled, privacy-audited, and published
  with reproducible SHA-256 checksums.

See the [`0.1.2 Build 2` release record](docs/sdd/releases/v0.1.2.md) for the complete
asset and verification evidence.

## What's new in 0.1.1

<p align="center">
  <img src="Resources/DeepViewer-Conversation.png" width="100%" alt="DeepViewer conversation workspace">
</p>

- Integrated the native macOS traffic lights into the app surface and removed
  the separate system title bar.
- Added a Codex-style sidebar control beside the traffic lights. Collapsing now
  hides the entire sidebar, and the control moves left when native fullscreen
  hides the traffic lights.
- Reserved a full-width top safe area so window controls, page actions, and the
  draggable region do not overlap.
- Unified the application name and Dock identity as `DeepViewer`, using the
  maintainer-provided macOS 26 icon.
- Added a centered DeepViewer startup surface with a blinking cursor line and a
  separate plugin-loading surface with a stable logo and `Loading Plugins...`
  text shimmer.
- Added release privacy gates: every public architecture is rebuilt from a clean
  runtime and allowlist staging directory, then audited before its DMG is created.
- Generated fresh, architecture-specific arm64 and x64 DMGs for 0.1.1. Both
  packages are Developer ID signed and passed Apple notarization.

## Current limitations

- The x64 build passes architecture, package, and Rosetta-based validation on
  Apple Silicon; physical Intel Mac acceptance remains pending.
- DeepViewer currently customizes the desktop shell around the upstream Harness
  workspace. More navigation, onboarding, and differentiated agent features are
  planned.
- Windows packaging, automatic updates, crash reporting, and a stable support
  policy are not included in this preview.
- The complete bundled runtime keeps each DMG large; runtime size optimization is
  deferred until the product path is stable.

## Privacy by design

- Harness listens only on a randomly assigned loopback address.
- The desktop window rejects unexpected navigation and new windows.
- Harness telemetry is disabled by the desktop launch configuration.
- The Renderer receives only an allowlisted desktop bridge; it does not receive
  general shell or filesystem access.
- Logs redact common authorization headers, API-key assignments, and secret-like
  values.
- Public packages are created from a clean allowlist staging directory. The build
  removes package-manager workspace metadata and blocks developer home paths,
  personal settings files, and current environment credential values.
- DeepViewer does not add the developer's or maintainer's local sessions,
  workspace, logs, settings, or API credentials to release assets.

## Requirements

For the prebuilt application:

- A Mac with Apple Silicon or an Intel processor.
- No global Node.js, npm, pnpm, or DeepSeek Harness installation is required.
- macOS 10.15 or later is recommended for the standard notarized Developer ID
  installation path.

For development:

- Node.js 24 or later.
- pnpm 11.19.0.
- The pinned DeepSeek Harness checkout described below.

## Build and test

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install

git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh

pnpm typecheck
pnpm test
pnpm desktop:build
```

GitHub Actions runs the frozen-lockfile install, typecheck, test suite, and
production build for every pull request and push to `main`. The workflow has
read-only repository access and never invokes preview packaging, release
packaging, signing, notarization, or uploads.

Use the lightest explicit iteration tier that matches the task:

```sh
pnpm desktop:dev          # build, watch, and restart an isolated development app
pnpm desktop:dev:restart  # request one rebuild/restart from the active dev runner
pnpm desktop:preview      # create an unsigned local arm64 DeepViewer Dev.app
pnpm desktop:release      # rebuild, sign, and notarize both architectures; no upload
```

The development and preview tiers use the isolated `DeepViewer Dev` data
directory. Unless a maintainer explicitly requests documentation sync, a local
preview, or a formal release, normal iteration changes code and runs relevant
checks only. GitHub release uploads remain a separate, explicitly authorized
operation.

Generated applications, runtimes, and DMGs are written below `out/` and
`.runtime/`. They are build outputs and are intentionally excluded from Git.

## Spec-Driven Development

DeepViewer's [SDD documentation system](docs/sdd/README.md) is the source of
truth for product baselines, architecture decisions, specifications, tasks,
verification, release privacy rules, and public artifact evidence.

## License and upstream

DeepViewer's original code is released under the [MIT License](LICENSE).
DeepSeek Harness and all third-party components retain their respective
copyright notices and licenses. The current desktop baseline is pinned to
DeepSeek Harness commit
`47f943859bef60e4160492346772ded9b24f765a` (`0.1.0-rc.5`).

## Feedback

Bug reports, Intel compatibility results, and focused feature proposals are
welcome in [GitHub Issues](https://github.com/Duoasa/DeepViewer/issues). Never
include API keys, credentials, private workspace content, or unredacted logs in
an issue.
