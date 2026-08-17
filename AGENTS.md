# DeepViewer Agent Guide

DeepViewer is an independent, open-source agent workspace intended to build on
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Product and
architecture changes follow the Spec-Driven Development (SDD) system in
[`docs/sdd/`](docs/sdd/README.md).

## Before changing the project

1. At the start of a new milestone or when the active specification is unknown,
   read [`docs/sdd/README.md`](docs/sdd/README.md) and
   [`docs/sdd/governance.md`](docs/sdd/governance.md). Do not reread or rewrite
   them for every small implementation slice in the same approved scope.
2. Find the active specification in `docs/sdd/specs/`.
3. For material architecture, data, security, public-interface, or UX-scope
   changes, create or update a `DV-NNNN-*` specification before implementation.
   Small fixes and refinements already covered by an approved milestone
   specification do not require per-change Markdown edits.
4. Do not implement a specification whose status is `Draft` or `Review`.

## Required traceability

- Requirements use stable IDs such as `R-001` and `NFR-001`.
- Acceptance criteria use `AC-001`.
- Tasks use `T-001` and reference the requirements they implement.
- Verification maps every acceptance criterion to reproducible evidence.
- Batch traceability and verification updates at an explicit documentation sync,
  milestone acceptance, or release boundary. They must be current before a
  specification becomes `Verified` or `Released`.

## Change rules

- Prefer DeepSeek Harness plugin and capability extension points over changes to
  the upstream agent loop.
- Record durable architectural choices as ADRs under
  `docs/sdd/architecture/decisions/`.
- Preserve upstream copyright notices and third-party licenses when importing
  or modifying upstream code.
- Never commit credentials, tokens, private prompts, or user data.
- Keep changes scoped to the active specification and report unrelated findings
  separately.
- Run checks proportionate to the changed surface. Record accumulated evidence
  in `verification.md` at the next documentation-sync boundary instead of after
  every small change.

Pure typo fixes and mechanical refactors may skip a new specification when they
do not change behavior, interfaces, data, security, architecture, or user
experience.

Unless the maintainer explicitly requests SDD/README synchronization, a local
preview package, or a formal release, the default iteration changes code and
runs basic verification only.
