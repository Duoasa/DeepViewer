# DeepViewer native adapter

DeepViewer 0.5.0 uses DSH 0.2.0-rc.2 (`639ed015397290b3745d163aafe02ffee4aa3f84`) and its Electron/private DesktopHost. The upstream checkout is disposable build input. Product adaptations live here; the old 0.1.5 whole-file overlays are not replayed.

| Directory | Ownership |
| --- | --- |
| `desktop/` | Identity, data roots, Dock theme, system proxy/PAC and private-network authorization |
| `client/` | Branding/About, welcome mascot/font, Work/Chat and native-sidebar editor/Git tabs |
| `workflows/` | Chat isolation, generated-file delivery policy, workspace operations |
| `migrations/` | Profile conversion, version-bound kernel backup and allowlisted frontend state |
| `compatibility/` | Pinned native gaps, imported helper files and regression tests |
| `scripts/` | Validate contracts before modifying disposable upstream sources; stage native bundles |

Use native filesystem opening/reveal, document/browser previews, delivery cards, change review, PTY/browser/sidebar state, process folding and statistics. Better Sidebar and Taskboard are not runtime dependencies. The Git helper retains its upstream MIT attribution; editor libraries retain their licenses.

The adapter, subscriptions and model capabilities are application-owned native modules. The shipped Web application composition owns their rows and client settings registrations. Generated CLI metadata owns their dependencies; the upstream installation manifest and lockfile stay unchanged. Integrated manifests omit `dsh.bundle`, and user profiles contain neither their dependencies nor their bundle selections. They have no separate cards, enable switches or uninstall controls in Plugins. Standalone source packages retain their original plugin packaging.

## Reproduce from the repository root

Use Node 24 and the root's pinned pnpm. `bootstrap-native-upstream.mjs` checks the tag/commit and anchors without resetting unknown edits. Install the upstream's pinned dependencies after bootstrap.

```sh
pnpm install --frozen-lockfile
node apps/deepviewer-desktop/scripts/bootstrap-native-upstream.mjs
pnpm --dir upstream/deepseek-harness install --frozen-lockfile
pnpm desktop:build
pnpm typecheck
pnpm desktop:smoke
pnpm --filter @deepviewer/desktop smoke:source
pnpm --filter @deepviewer/desktop smoke:contracts
pnpm --filter @deepviewer/desktop smoke:plugins
pnpm --filter @deepviewer/desktop smoke:native
pnpm --filter @deepviewer/desktop smoke:payload
```

`smoke:native` uses private homes, fake APIs and local update feeds. `smoke:payload` materializes the production dependency closure and creates a temporary ASAR; it checks actual native loading and Office conversion without creating a distributable app or DMG. Source maps, development links and other-platform runtime packages are excluded. `smoke:source` applies all 106 contracts twice to a fresh checkout and rejects Agent-loop patches.

## Compatibility removal conditions

Every anchor is named and explains its purpose. A changed commit or anchor stops preparation before any source write. Preserve the matching tests when upstream provides an equivalent seam, then remove the contract family and its copied helper together.

| Contract family | Remove when the pinned upstream provides | Verification |
| --- | --- | --- |
| Dedicated RPC ownership | Explicit consumer-owned channel lifetime under Cordis 4 | RPC owner unload regression; authenticated Host/plugin smoke |
| Work/Chat creation, cold list/history/search and uploads | Cwd-free Chat preset authorization, persisted preset classification and mode-filtered search | Native Host create/prompt/restart/page/search and workspace rejection; attachment fixtures |
| Delivery preparation and source aliases | Hook to normalize generated files before native presentation | Delivery containment and producer-contract fixtures |
| Branding/locales, hero layout and stats slot | Product identity/locales/layout hooks | Native renderer smoke; visual acceptance remains manual |
| Protection tones | Structured warning tone for stale/unread filesystem guards | Native ToolRow 11-case regression |
| Desktop port/network readiness/web fetch | Product-owned launch/network policy seam | Native Host auth/shutdown and PAC/local-access fixtures |
| Update channel/version policy | Product-selected feed channel and release identity | Native updater tests and real HTTP Range reconstruction |
| External client bundling | Supported native module-table builder for external manifests | Native adapter/model/subscriptions builds |
| Native DeepViewer composition | Application-owned native-module composition and diagnostic disable hook | Host inventory/RPC/recovery, source contracts and staged manifest fixtures |

No contract changes the Agent loop. Native slots and services own sidebar state; DeepViewer owns only the added editor state and product mode selection. Editor saves reject stale content and retain typing made while a save is in flight. Git stage/unstage accepts one selected changed file and only discovered repositories inside the Session workspace.

## Data and recovery

Stable DeepViewer and DeepViewer Dev keep their existing independent roots. Explicit `DEEPVIEWER_DEV_USER_DATA` creates an isolated test profile. Scoder, Saidex and official DSH are not migration sources. Before the new kernel opens durable stores, DeepViewer snapshots its own home into private `migration-backups/kernel-v020` with SHA-256 verification; node_modules, locks and caches are excluded. Incomplete copies are never declared complete. `restoreKernelSnapshot(home, destination)` restores to a new separate home and refuses existing destinations, preserving newer sessions.

Profile conversion backs up metadata before removing retired bundles. The native-module checkpoint uses private `migration-backups/builtins-v1` metadata and keeps its previous migration journal. It removes the three modules' old dependency and bundle declarations, prunes their root lockfile entries and removes only unchanged application-owned links. Provider configuration and prior explicit disable selections become native row overrides. Completion follows successful writes; retry reads the backed-up selection. `rollbackDesktopProfile` restores the previous metadata/journal and owned links without touching accounts or sessions.

Official recovery disables external plugins while DeepViewer's native modules remain available. `DEEPVIEWER_DISABLE_BUILTINS=1` temporarily starts pure native core and wins over explicit enable overrides. Existing subscriptions/model disable flags remain supported; those individual switches persist row disable overrides. Re-enable by removing the diagnostic flag and the relevant `disabled: true` override in the desktop profile, rather than through Plugins. Frontend migration reads only recorded localhost origins from DeepViewer's own logs, backs up allowlisted drafts/view state and imports missing values into `dsh-app://app/`. It does not import browser credentials or overwrite new-origin drafts.

## Distribution and update qualification

The local update harness verifies consecutive/skipped releases, differential byte ranges, missing cache/no-Range/corrupt-blockmap fallback, SHA-512 rejection and HTTP failures. It does not invoke installation. Native task/Host shutdown coordination is retained. No signed application modules are overwritten in place.

`package-native.mjs --release` requires explicit signing identity/team/keychain notary profile, signs the native runtime, seals its inventory, checks the actual ASAR and notarizes the app and DMG. It builds ZIP/blockmap as the update transport and DMG for installation/recovery; it never publishes. Signed installation, data preservation and relaunch must still be qualified on real macOS installations before publication.

The signed output directory's `qualification.json` must bind the feed channel/version and ZIP SHA-512, with schemaVersion 1 and all scenarios true: `consecutive`, `skipped`, `fullDownload`, `differentialFallback`, `busyTaskDeferral`, `signedInstall`, `userDataPreserved`, `relaunch`. This is a release evidence record, not a substitute for running those scenarios. `publish-native-update.mjs --publish` rejects missing/stale qualification, verifies the ZIP's actual signed product/version, requires an intentionally provisioned channel Release, uploads immutable ZIP/blockmaps without replacement, and uploads the mutable feed last.

Stable uses `updates-stable/latest-mac.yml`; preview uses `updates-preview/preview-mac.yml`, with independent updater caches. Public releases increment semver; internal Build changes alone are not public update versions. This milestone has not published those endpoints.
