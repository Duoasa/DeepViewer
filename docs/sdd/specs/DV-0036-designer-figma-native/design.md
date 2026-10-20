# Design

## Native module (R-001, NFR-001)
Vendor the official v0.2.1 public source with a file-hash provenance manifest. Stage only production files and resolve dependencies from the pinned Harness installation. Extend native module staging to support Host-only modules without inventing a Web client. Include it in CLI dependencies and runtime closure, not user-managed bundles.

## Profile and bridge (R-002, NFR-002)
Use built-in row `deepviewer-figma`, backend local, default port 3065 (installed) / 3066 (development), distinct from standalone 3055. Profile overrides take precedence. All generated credentials remain under DSH_HOME/figma. Migrate an existing dsh-to-figma activation to an override and back up metadata before first conversion. Disable with DEEPVIEWER_DISABLE_FIGMA or DEEPVIEWER_DISABLE_BUILTINS. Port conflict leaves diagnostics available and Host running. Retain upstream workspace and document binding enforcement.

## Product and release (R-003, R-004)
Keep existing frontend; surface plugin via agent tools and bundled skill. README explains one-time companion import and local native editing; official cloud access remains separate. Use upstream example image with attribution, not evidence of integrated-app acceptance. Bump root/desktop/adapter to 0.7.3; fresh signed arm64 build and public checksum. Rollback uses previous installer and saved metadata; never delete session or credential data.
