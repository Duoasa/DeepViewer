# DeepViewer 0.3.3 (Build 75) Harness source snapshot

This source-only patch reconstructs the exact Harness source tree used for DeepViewer 0.3.3 from the official `baseCommit` in [`manifest.json`](manifest.json). It includes DeepViewer's Work/Chat, cold-session recovery, file-delivery, progressive-disclosure, preview, appearance, and desktop-network adaptations. Upstream copyright notices and licenses remain intact. No Runtime binaries, local profiles, sessions, credentials, or installer are included.

## Restore and verify

```sh
git clone https://github.com/deepseek-ai/deepseek-harness upstream/deepseek-harness
git -C upstream/deepseek-harness checkout fb2c4b9e698e30edb738bca4cf0618587db7d203
git -C upstream/deepseek-harness apply --whitespace=nowarn ../snapshots/v0.3.3/harness.patch
```

`manifest.json` records the patch SHA-256 and the restored Git tree. The release preparation applied the patch to a clean base checkout and confirmed the resulting tree equals `sourceTree`. Do not apply this full snapshot over an already customized Harness checkout or run the generic override sync over it.

## Rebuild the fixed release

Use Node.js 24 and pnpm 11.19.0 on macOS arm64. Install the frozen root and Harness lockfiles, then build the official Harness and package the vendor and DSH families. Run the three desktop Vite configurations directly for fixed Build 75; the regular `pnpm desktop:build` command increments the build number. Stage the pinned subscriptions and sidebar adapters with `stage-release-plugins.mjs`; `build-runtime.mjs` then packages them with the first-party reasoning plugin.

```sh
pnpm install --frozen-lockfile
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm --dir upstream/deepseek-harness run build:official
pnpm --dir upstream/deepseek-harness run release:pack --family vendor --out dist/deepviewer/vendor
pnpm --dir upstream/deepseek-harness run release:pack --family dsh --out dist/deepviewer/dsh
node apps/deepviewer-desktop/scripts/stage-release-plugins.mjs
pnpm --filter @deepviewer/desktop exec vite build --config vite.main.config.ts
pnpm --filter @deepviewer/desktop exec vite build --config vite.preload.config.ts
pnpm --filter @deepviewer/desktop exec vite build --config vite.renderer.config.ts
node apps/deepviewer-desktop/scripts/build-runtime.mjs --arch=arm64 --local-snapshot
node apps/deepviewer-desktop/scripts/package.mjs --arch=arm64 --local-snapshot --freeze --sign
node apps/deepviewer-desktop/scripts/notarize.mjs --arch=arm64 --freeze --keychain-profile=YOUR_LOCAL_PROFILE
```

Developer ID signing and notarization require the maintainer's own Keychain identity and notarytool profile. Never commit those credentials. The release script checks packaged versions, Runtime contents, app signatures, personal paths, and credential values before the DMG is published. Only compute SHA-256 after the Apple ticket has been stapled.
