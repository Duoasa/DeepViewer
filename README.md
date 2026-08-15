<h1 align="center">DeepViewer</h1>

<p align="center">
  A visual, controllable, and customizable desktop workspace for DeepSeek Harness.
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/Duoasa/DeepViewer?display_name=tag&include_prereleases"></a>
  <img alt="macOS Apple Silicon and Intel" src="https://img.shields.io/badge/macOS-Apple%20Silicon%20%7C%20Intel-111111?logo=apple">
  <img alt="Electron 43" src="https://img.shields.io/badge/Electron-43-47848F?logo=electron&logoColor=white">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
</p>

<p align="center">
  <a href="https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1"><strong>Download DeepViewer v0.0.1</strong></a>
  ·
  <a href="#privacy-by-design">Privacy</a>
  ·
  <a href="#build-and-test">Build from source</a>
  ·
  <a href="#license-and-upstream">Open source</a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.zh-CN.md">简体中文</a>
</p>

DeepViewer is an open-source desktop agent workspace built on
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns
the current npm-and-browser workflow into a self-contained macOS application
that starts and stops its bundled local runtime for the user.

> [!NOTE]
> DeepViewer is an independent community project. It is not affiliated with or
> endorsed by DeepSeek.

> [!IMPORTANT]
> `v0.0.1` is an early, unsigned test release for validating the desktop
> packaging foundation. The DeepViewer UI and feature redesign has not started
> and will follow the product plan supplied by the project owner.

## Why DeepViewer

| | |
| --- | --- |
| **Desktop first** | Launch the agent as a normal macOS application without manually running Node, npm, pnpm, or a Web UI command. |
| **Self-contained runtime** | Ships the pinned Harness runtime and compatible execution environment inside the application. |
| **Apple Silicon and Intel** | Provides separate native packages for current Apple Silicon Macs and older Intel Macs. |
| **Local by default** | Runs Harness on a random `127.0.0.1` port and does not expose the service to the LAN. |
| **Controlled lifecycle** | Starts, health-checks, monitors, retries, and stops Harness together with the desktop application. |
| **Inspectable failures** | Provides a launch status surface, retry path, local logs, and redaction for common credential patterns. |
| **Built for customization** | Preserves Harness sessions, plugins, tools, and Web protocols while creating clear extension points for DeepViewer UI and features. |
| **Spec driven** | Keeps product intent, architecture decisions, implementation tasks, and verification evidence in a committed SDD system. |

## Quick start

1. Download the package that matches your Mac from the
   [v0.0.1 release](https://github.com/Duoasa/DeepViewer/releases/tag/v0.0.1).
2. Open the DMG and copy `DeepViewer.app` to Applications.
3. Open DeepViewer. It starts the bundled Harness automatically and loads the
   local workspace when the runtime is ready.

| Mac | Download | SHA-256 |
| --- | --- | --- |
| Apple Silicon (`arm64`) | [DeepViewer-0.0.1-macos-arm64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.0.1/DeepViewer-0.0.1-macos-arm64.dmg) | `9c76101b7b7b7cb8bf8cfed30b422927851e674f3092650388d58c8164ef0314` |
| Intel (`x64`) | [DeepViewer-0.0.1-macos-x64.dmg](https://github.com/Duoasa/DeepViewer/releases/download/v0.0.1/DeepViewer-0.0.1-macos-x64.dmg) | `6a24dbb6100edd804fd58167fde8c77326ddb65c09bc4497d5ed58212313681c` |

> [!WARNING]
> These test packages are not signed or notarized by Apple. macOS may block the
> first launch. If you trust this repository and downloaded the package from
> the official release above, use Finder's **Open** action or allow the app in
> **System Settings → Privacy & Security**. Signing and notarization are planned
> for a later reliable-release milestone.

## What works in 0.0.1

- A hardened Electron window with Node integration disabled, context isolation
  enabled, sandboxing enabled, and a narrow preload API.
- Automatic startup and readiness checks for the bundled DeepSeek Harness.
- Loading of the existing Harness Web surface after the local runtime is ready.
- Bounded shutdown and process-tree cleanup when DeepViewer exits.
- Separate arm64 and x64 applications, native dependencies, and DMG images.
- Build-time checks for the pinned Harness commit, runtime manifest, target
  architecture, native modules, and contained symbolic links.
- Local runtime logs with common authorization and API-key values redacted.

## Current limitations

- The application still uses the upstream Harness Web interface. DeepViewer's
  UI, navigation, onboarding, and differentiated functions are the next phase.
- The packages are unsigned and not notarized, so Gatekeeper warnings are
  expected.
- The Intel build passed architecture checks and a Rosetta GUI/runtime smoke
  test on Apple Silicon, but still needs acceptance testing on physical Intel
  hardware.
- The initial runtime is intentionally complete rather than size-optimized;
  each DMG is roughly 425–450 MB.
- Windows packaging is deferred until the macOS UI and feature path is stable.
- The minimum supported macOS version is not yet a release commitment.

## Privacy by design

- Harness listens only on a randomly assigned loopback address.
- The desktop window rejects unexpected navigation and new windows.
- Harness telemetry is disabled by the desktop launch configuration.
- The Renderer receives only an allowlisted desktop bridge; it does not receive
  general shell or filesystem access.
- Logs redact common authorization headers, DeepSeek API-key assignments, and
  secret-like key values.
- DeepViewer does not upload the user's workspace, credentials, or complete
  session history as part of the desktop shell.

## Requirements

For the prebuilt application:

- A Mac with Apple Silicon or an Intel processor.
- No global Node.js, npm, pnpm, or DeepSeek Harness installation is required.
- Because this is an unsigned test release, the user must explicitly approve
  the first launch through macOS security controls.

For development:

- Node.js 24 or later.
- pnpm 11.19.0.
- The pinned DeepSeek Harness checkout described below.

## Build and test

Clone DeepViewer and install the workspace dependencies:

```sh
git clone https://github.com/Duoasa/DeepViewer.git
cd DeepViewer
pnpm install
```

Prepare the pinned Harness baseline:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh
```

Run checks and create both macOS packages:

```sh
pnpm typecheck
pnpm test
pnpm desktop:build
pnpm desktop:package:arm64
pnpm desktop:package:x64
```

Generated applications, runtimes, and DMGs are written below `out/` and
`.runtime/`. They are build outputs and are intentionally excluded from Git.

## Production source structure

```text
apps/
└── deepviewer-desktop/          # Electron main, preload, launch UI, tests, and packaging
docs/sdd/
├── product/                     # Vision, principles, and roadmap
├── architecture/                # System boundaries, constraints, and ADRs
├── specs/                       # Feature specifications, tasks, and verification
└── releases/                    # Public release records and artifact evidence
package.json                     # Workspace commands and pinned tool versions
pnpm-workspace.yaml              # Workspace packages and dependency policy
upstream/deepseek-harness/       # Ignored pinned build input, never the source of unique changes
```

## Roadmap

1. Validate the macOS packaging foundation on Apple Silicon and Intel.
2. Implement the approved DeepViewer UI and feature plan on macOS.
3. Add observability, control, files, tools, permissions, and recovery flows.
4. Adapt the proven product path to Windows.
5. Add signing, notarization, updates, diagnostics, and reliable releases.

See the [product roadmap](docs/sdd/product/roadmap.md) for the maintained
delivery sequence.

## Spec-Driven Development

DeepViewer's [SDD documentation system](docs/sdd/README.md) is the source of
truth for product baselines, architecture decisions, specifications, tasks,
verification, and public release evidence.

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
