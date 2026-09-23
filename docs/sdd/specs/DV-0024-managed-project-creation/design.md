# Design

Extend the existing workspace create request with a mutually exclusive name variant. The desktop supplies DEEPVIEWER_PROJECTS_ROOT using Electron's documents path; the host creates the root lazily and an exclusive child directory, then registers it. Existing path adoption is unchanged. Name creation is serialized with workspace mutations. Failure may remove only the newly created empty directory, never recursively. The picker adds a separate New project entry when its injected callback is present.

Target: DSH 0.1.5-rc.2, derived checkout a02198c1c2d3b2701296219278357e53f34711dc. Active integrations: DVP-0001 subscriptions 0.3.1, DVP-0003 reasoning 0.1.0, DVP-0004 better-sidebar 0.19.1. No agent loop or tool permissions changes. Preserve durable upstream overrides. Registration/UI/runtime checks are required; account-specific plugin and visual acceptance remain manual.
