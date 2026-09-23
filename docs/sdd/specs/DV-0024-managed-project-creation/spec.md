# DV-0024 Managed project creation

Status: Implementing
Approval: Maintainer approved name-only project creation and a unified projects directory on 2026-09-20.

- R-001: New project opens an in-app name-only dialog; confirmation creates one directory under Documents/DeepViewer/Projects and registers its workspace.
- R-002: Add existing project remains a separate native directory picker; existing paths and files are not moved.
- R-003: Reject empty/invalid names and occupied paths, prevent duplicate submission, preserve input on failure, and never delete existing user files.
- R-004: Reuse existing icons, theme, modal keyboard behavior and bilingual copy; open the created workspace after success.
- NFR-001: Preserve frozen 0.2.9 artifacts, Chat behavior, DSH approvals and existing data.

Acceptance: AC-001 verifies creation under a temporary managed root and workspace registration (R-001); AC-002 verifies invalid/colliding names and non-destructive failure (R-003); AC-003 verifies independent new/add-existing flows and dialog retry/busy behavior (R-002,R-004). Visual acceptance Pending Manual.
