# Firebase and social repair verification

The repair removes legacy schema restrictions that rejected newer project metadata, large inline profile/thumbnail images, and uploaded HTML source parts. Firestore and Realtime Database use different rule formats: only the Realtime Database rules are JSON. Firebase evaluates authenticated writes and data ownership rather than a blanket HTTP POST permission.

Rules bind profile IDs, project owners, post owners, comment authors, social edges and presence to the Firebase Auth identity. Only the existing verified project administrator can access admin paths, set administrative authority, create reserved catalog entries, or publish trusted builtin runtimes. Profile handles are reserved transactionally and case-insensitively; display names may repeat.

## Verification

The Verify RapidFire workflow runs 12 rules/service tests three times and 21 Chromium browser tests twice. These include authenticated REST POSTs, rejected spoofed authors and owners, unique handle collisions, admin escalation denial, legacy profile updates, actual file images and HTML source publishing, two real emulator-backed users, social counters and persistence, sidebar keyboard/mobile behavior, and launching all ten embedded projects. All test accounts and records stay in demo emulators.

Deterministic browser failure tests cover retries, duplicate writes, stale comment callbacks, preserved drafts, rejected image files, keyboard file selection, and invalid file selection while a preceding image is still being prepared. The keyboard test explicitly acknowledges Chromium file-dialog interception before dispatching Enter; otherwise the input click can precede interception and cause a test-only timeout.

Bundled upstream source snapshots and Ruffle are pinned in scripts/vendor-defaults.py. Original editable sources, licenses and attribution are retained. CI regenerates the same asset tree used by the verified build, then saves it to the repair branch.

## Production

Frontend publication and Firebase rule activation are separate deployments. GitHub Pages publishes the static main branch. The Deploy Firebase rules workflow uses the firebase-production environment and short-lived Google Workload Identity Federation. Missing GCP_WORKLOAD_IDENTITY_PROVIDER or GCP_SERVICE_ACCOUNT configuration is reported explicitly; a successful emulator run is not evidence of production activation.

See README.md for official Firebase references and manual deployment commands. CI logs and downloadable browser evidence are linked from the repair pull request.

Verified source run: https://github.com/timmiballz22/rapidfire/actions/runs/39463285444 (36 rules/service checks and 42 browser cases passed). The final branch revision is also rechecked after vendoring assets.
