# @deepviewer/dsh-plugin-model-capabilities

DSH model capability scanner, version **1.0.1**. Based on the maintainer's MIT-licensed 1.0.0 internal-gateway adaptation; provenance is in [UPSTREAM.md](UPSTREAM.md).

The priority is a working model configuration. The scanner tries compatible request parameters, verifies the selected image/effort combination, and prepares settings that the pinned pi-ai runtime can reproduce. Applying results may replace earlier manual capabilities. The previous settings remain restorable until another configuration change or deliberate manual save.

| Check | Adaptation |
| --- | --- |
| Text response | Require complete Chat Completions / Responses output; empty, failed and interrupted replies do not pass |
| Instruction role | Validate developer, fall back to system on rejection; verify the final role used by pi-ai |
| Token parameters | Retry `max_tokens` / `max_completion_tokens`; retry truncated reasoning with a larger output budget; Responses uses at least 16 output tokens |
| Image input | Random six-colour challenge, larger retry, final combined verification |
| Effort levels | Reject an invalid control value, test low/medium/high, then test the selected combination |
| Recovery | If image + reasoning fails, try image without reasoning, then plain text; only a successful final path produces an applicable configuration |

Catalog and `/models` claims are hints. They never substitute for a working request. When applying a text-only result, explicit `input: ["text"]` and `reasoningEfforts: false` prevent inaccurate inherited capabilities from being used. The report displays both independent probe findings and the configuration that will actually be applied.

## Compatibility and installation

- DSH **0.1.7-rc.2**, Cordis **4.0.4**, Web client; `llm-pi-ai` model settings.
- Node **22.19+ or 24+** as constrained by `package.json`.
- `openai-completions` and `openai-responses` providers with saved credentials.
- Remote endpoints require HTTPS; HTTP is allowed only for localhost / loopback. Redirects are refused.
- No public registry publication is implied. Build a standalone copy and install its local path:

```sh
npm ci
npm test
npm run check
npm run build
dsh plugin --profile web add /absolute/path/dsh-plugin-model-capabilities
```

The bundle patch mounts host id `model-capabilities`; `dsh.client` advertises the browser entry. Restart the target DSH client after installation. See [INSTALL.zh-CN.md](INSTALL.zh-CN.md) for replacement and migration notes. DeepViewer now integrates this plugin by default in place of `dsh-plugin-reasoning`; no manual installation is needed there. Its native staging builder uses the pinned DSH toolchain. This directory remains excluded from the desktop pnpm workspace; its own npm shrinkwrap controls the standalone toolchain.

## Usage

Settings → Models → provider card → Model capability scan.

1. Scan configured models (default), or all models listed by the API. Only synthetic prompts/images are sent, with at most 12 requests per model by default. API charges may apply.
2. Inspect per-model findings and **Will apply**. Unusable or incomplete results have no working recommendation.
3. Apply the working configuration. Capability fields and the tested compatibility fields can replace earlier manual values; unrelated metadata stays intact. Removing confirmed missing models or adding newly discovered models requires the corresponding option.
4. Restore the previous model list while its fingerprint still matches. A manual save, including a same-value save, invalidates old scan application and restoration.

An explicit output limit below the budget needed to pass is raised when applying; larger limits are retained. The Completions path disables untested `store` and `stream_options` fields and selects the tested OpenAI effort format. This verifies the synthetic text/image/effort requests, not every gateway-specific tool, multi-turn or vendor-specific thinking feature.

## Configuration

```yaml
- id: model-capabilities
  config:
    limits:
      models: 200
      concurrency: 2
      requestsPerModel: 12
      timeoutMs: 20000
      textOutputTokens: 8
      textRetryOutputTokens: 1024
      imageTimeoutMs: 60000
      imageOutputTokens: 96
      imageRetryOutputTokens: 1024
      probeEfforts: true
```

The request budget includes final verification and fallback requests. An undersized budget can leave a model unverified. Disabling effort probes produces a tested configuration without an effort parameter.

## Data and isolation

New reports use `<DSH_HOME>/deepviewer-model-capability-scans.json`, schema 4, mode 0600 and atomic writes. Migration looks only in that same DSH home, in this order:

1. `model-capability-scans.json` (old capability plugin)
2. `deepviewer-model-scans.json` (DeepViewer reasoning scanner)
3. `deepviewer-model-scans.json` (legacy name within this profile only)

The new store wins when present. Versions 2/3 import history metadata marked stale; old conclusions, ownership flags, raw errors and rollback snapshots are not re-applied. The original source remains intact. An explicitly configured legacy `storeFile` receives a uniquely named `.bak` before migration. Unknown/malformed formats stop loading instead of being overwritten. No other application's DSH home is searched.

Request-scoped redaction removes the actual API key, configured header values and common encodings from provider replies and exceptions. Received data is bounded: 1 MiB for probes, 64 KiB for HTTP error bodies and 8 MiB for listings; readers are cancelled at the limit. RPC transport exposes only authored error messages. Restore snapshots are private local model-configuration copies; no credential service values are written into them.

## Development verification

```sh
npm test
npm run check
npm run build
node scripts/smoke-runtime.mjs
DSH_ROOT=/path/to/pinned/deepseek-harness node scripts/smoke-host.mjs
```

`DSH_TOOLCHAIN=/path/to/build-tools` can supply esbuild for the build. Runtime smoke uses the installed `dsh-llm-pi-ai` peer to capture actual payloads before dispatch. Host smoke creates a temporary HOME/DSH_HOME and a fake gateway, checks authenticated scan/apply/restore/edit RPCs, and never mounts a real profile. Its artifact path is printed.

`live-scan.mjs` is an explicit, optional real-gateway diagnostic. It is not run by tests or installation. `MC_BASE_URL`, `MC_API_KEY` and optionally `MC_API` are read from the environment; pass model IDs as positional arguments.

MIT. Original license notices are preserved.
