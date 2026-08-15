# DeepViewer

DeepViewer is an open-source, customizable agent workspace built on top of
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

The project aims to provide a visual and controllable desktop experience for
running agents, inspecting their activity, and adapting workflows to different
use cases.

> [!NOTE]
> DeepViewer is an independent community project. It is not affiliated with or
> endorsed by DeepSeek.

## Status

DeepViewer is in early development. The product scope, architecture, and user
experience are still being defined.

## Goals

- A clear UI for agent tasks, tool activity, and execution state
- Customizable workflows and product experiences
- Compatibility with the plugin-oriented architecture of DeepSeek Harness
- A local-first foundation with understandable, user-controlled behavior

## Upstream

DeepViewer is intended to build upon DeepSeek Harness, which is distributed
under the MIT License. Upstream code and third-party components retain their
respective copyright notices and licenses.

## Development

DeepViewer uses a lightweight Spec-Driven Development workflow. Product
baselines, architectural decisions, feature specifications, implementation
tasks, and verification evidence live in the
[SDD documentation system](docs/sdd/README.md).

The current desktop spike uses Electron 43.4.0 and Electron Packager 20.3.0.
It produces separate, self-contained macOS artifacts for Apple Silicon and
Intel Macs. Windows packaging is intentionally deferred until the macOS UI and
feature path is established.

### Prepare the pinned Harness baseline

```sh
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm --dir upstream/deepseek-harness install
pnpm --dir upstream/deepseek-harness run build
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh
```

The upstream checkout and generated runtime directories are build inputs and
are not committed to DeepViewer.

### Build and test

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm desktop:build
pnpm desktop:package:arm64
pnpm desktop:package:x64
```

The macOS artifacts are written to `out/`:

- `DeepViewer-0.0.1-macos-arm64.dmg`
- `DeepViewer-0.0.1-macos-x64.dmg`

These are unsigned development artifacts. Signing, notarization, runtime
trimming, and automatic updates belong to a later release specification.

## License

DeepViewer's original code is released under the [MIT License](LICENSE).
