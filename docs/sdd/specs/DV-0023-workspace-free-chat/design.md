# Design
R-001/R-002: Ship deepviewer-chat as a system Agent preset. Official session creation accepts no workspaceId; internal default cwd is not registered or exposed as a project.
R-003: Persona suppresses runtime/project context; mount only tool-web. On composition apply a web_search/web_fetch tool allowlist and a monotonic execution guard permitting web_search/web_fetch. Existing native upload processing remains shared.
R-004: Derive current mode from persisted preset, use official navigation and session rows. Work list excludes Chat. Chat creation errors stay visible. No new RPC or Session format.
R-005: Existing session event log, projection, model and input services remain authoritative.
Target core 0.1.5-rc.2; Active plugins DVP-0001 subscriptions, DVP-0003 reasoning, DVP-0004 better-sidebar require compatibility checks. No changes to the upstream agent loop.

Decision: [ADR-0009](../../architecture/decisions/ADR-0009-chat-as-agent-preset.md).
