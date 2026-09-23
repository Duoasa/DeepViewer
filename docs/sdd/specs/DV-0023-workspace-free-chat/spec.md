# DV-0023 Workspace-free Chat

Status: Implementing
Approval: Maintainer accepted the Chat / Work proposal and requested implementation on 2026-09-20.

## Requirements
- R-001: Chat starts without creating or selecting a workspace; Work keeps its existing workflow.
- R-002: Persist Chat identity through the official agentPreset session projection; legacy sessions remain Work.
- R-003: Chat exposes web search/fetch only, with no shell, filesystem, project instructions, skills or delegation; reuse provider/model selection and native attachments.
- R-004: Separate Chat history and Work workspace navigation, reuse existing icons/theme and bottom composer; hide workspace/permission controls for Chat.
- R-005: Reuse streaming, cancellation, retry and durable conversation history.
- NFR-001: Preserve 0.2.9 frozen artifacts, existing user data and Work permissions. No publication or package generation.

## Acceptance
- AC-001: Create Chat without workspace; no workspace registry mutation.
- AC-002: Chat tools are bounded on create and cold resume; Work remains unaffected.
- AC-003: Chat history survives restart and lists separately; archived entries are excluded.
- AC-004: UI mode switching, bottom input, attachment/model selection and existing Work behavior pass basic checks; visual acceptance Pending Manual.

Chat-to-Work context transfer is a subsequent enhancement, not part of this first slice.
