# DeepViewer Agent Guide

DeepViewer is an independent, open-source agent workspace intended to build on
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Product and
architecture changes follow the Spec-Driven Development (SDD) system in
[`docs/sdd/`](docs/sdd/README.md).

## Before changing the project

1. Read [`docs/sdd/README.md`](docs/sdd/README.md) and
   [`docs/sdd/governance.md`](docs/sdd/governance.md).
2. Find the active specification in `docs/sdd/specs/`.
3. For non-trivial behavior, architecture, data, security, or UX changes, create
   or update a `DV-NNNN-*` specification before implementation.
4. Do not implement a specification whose status is `Draft` or `Review`.

## Required traceability

- Requirements use stable IDs such as `R-001` and `NFR-001`.
- Acceptance criteria use `AC-001`.
- Tasks use `T-001` and reference the requirements they implement.
- Verification maps every acceptance criterion to reproducible evidence.
- Code and documentation changes land together; do not leave an approved
  specification knowingly inconsistent with the implementation.

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
- Run checks proportionate to the changed surface and record the evidence in the
  specification's `verification.md`.

Pure typo fixes and mechanical refactors may skip a new specification when they
do not change behavior, interfaces, data, security, architecture, or user
experience.
