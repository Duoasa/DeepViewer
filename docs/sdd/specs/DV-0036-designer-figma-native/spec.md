---
status: Implementing
updated: 2026-10-20
---
# DV-0036 · Designer agent and native Figma integration

Approved scope: maintainer directly requested native DSH-to-Figma integration, designer-focused positioning, version 0.7.3, README product image and release publication. Existing frontend and DSH 0.2.1-rc.2 (687f282e8625c6b8d11ff58211a90524be2e4317) remain.

## Requirements
- R-001: Ship pinned MIT dsh-to-figma 0.2.1 as an application-owned Host module, with its native tools, skill and public companion template; no separate package installation.
- R-002: Generate private paired companion under the current DeepViewer home. Use separate stable/development loopback ports; preserve existing explicit plugin configuration and disabled choices; fail softly on unavailable bridge.
- R-003: Position DeepViewer as a dedicated agent optimized for designers; bilingual README includes attributed Figma product image, capabilities, setup and limitations.
- R-004: Freshly build, sign, notarize and publish 0.7.3 arm64 DMG/checksum and release notes; preserve current frontend.
- NFR-001: No upstream agent-loop fork, personal data or private pairing credentials in shipped payload. Preserve upstream license and source provenance.
- NFR-002: Keep work-session workspace/document boundaries, authorization and uncertain-mutation protection; support native module disable and profile backup.

## Acceptance
- AC-001: Staged and relocated runtime resolves plugin and compatible singleton kernel peers; native Host registers tools and bundled skill.
- AC-002: Isolated tests cover private companion, authentication, document/workspace boundaries, conflict failure, disable and configuration migration.
- AC-003: README positioning, product image, setup and release metadata agree with 0.7.3.
- AC-004: Fresh arm64 package passes payload audit, signed Host smoke, codesign/stapler/Gatekeeper and remote checksum verification.
- AC-005: Maintainer verifies real Figma pairing and editable-canvas workflow in DeepViewer (Pending Manual; public release does not imply this passes).

Active modules: DVP-0001 subscriptions, DVP-0006 model capabilities, DVP-0007 adapter, DVP-0008 Figma. PC-001–009 evidence will be synchronized at release.
