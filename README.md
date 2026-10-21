# RapidFire

RapidFire is a static GitHub Pages app using Firebase Google sign-in, Firestore and Realtime Database. It works on the Spark plan: profile photos and thumbnails are resized in the browser and saved in Firestore, and uploaded HTML is stored as versioned source parts. No Cloud Functions or paid Storage bucket is required. The user chose not to enforce a custom rate limit.

## Rules and configuration

`firebase.json` is the Firebase CLI deployment map, not a rule document. `database.rules.json` uses Realtime Database's JSON `rules` object with `.read`, `.write` and `.validate`. `firestore.rules` and `storage.rules` use Firebase's separate rules language. `.firebaserc` identifies the existing RapidFire project.

Public app content can be read. Signed-in users can write their own profile, projects, source files, posts and social actions. Existing owner/author/auth UID fields cannot be reassigned. Handle reservations and profile handles are checked together with `getAfter` so a manipulated request cannot claim an existing handle. Saved lists are visible only to their owner. Firebase Auth account records and unlisted collections/paths have no app-level grants. Normal follow operations may write the caller's follower edge on the followed user's public follower list.

Official references: [Realtime Database rule format](https://firebase.google.com/docs/database/security), [Firestore rule structure](https://firebase.google.com/docs/firestore/security/rules-structure), [CLI configuration](https://firebase.google.com/docs/cli), [version-controlled rule deployment](https://firebase.google.com/docs/rules/manage-deploy), [GitHub Hosting integration](https://firebase.google.com/docs/hosting/github-integration).

## Development and verification

```sh
npm ci
node scripts/sync-inline.mjs --check
npm run build
npx playwright install chromium
npm run test:browser
npx firebase emulators:exec --project demo-rapidfire --only auth,firestore,database,storage "npm test"
```

The rules tests require Java 21 and use a demo project, never production. They verify permitted own-account operations, authenticated REST POSTs, private saved lists, and rejected account/owner/author/handle spoofing. Browser tests combine deterministic failure/retry checks with two real emulator-backed users for image uploads, HTML publishing, likes, saves, shares, follows, posts, comments and reload persistence. Each of the ten embedded projects is launched in Chromium. GitHub CI repeats the rules/service suite three times and the browser suite twice.

After editing `js/app.js` or `js/firebase-service.js`, run `node scripts/sync-inline.mjs` to update the self-contained page. This preserves GitHub Pages compatibility and prevents the two copies from diverging.

## Deploy

1. Sign in with `npx firebase login`.
2. Run `npx firebase deploy --project rapidfire-31bae --only firestore,database` to publish rules and indexes.
3. Merge/push the static site changes to the branch configured for GitHub Pages. Committing rules to GitHub alone does not activate them in Firebase.

Storage rules are included for a future Storage-enabled project but are not needed or deployed by the Spark app. To restore all four Firebase website addresses, run `npx firebase deploy --project rapidfire-31bae --only hosting`. Hosting now automatically builds a fresh `dist` before deploying, and explicitly targets sites `rapidfire-31bae` and `rapidfire-project`. Database rules deployment alone does not deploy the website. Keep all private credentials out of Git.

For automatic rule deployment from GitHub, configure the protected `firebase-production` environment with `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` variables. The deployment workflow publishes Hosting and database rules when site code, assets, configuration or rules change on main, or can be started manually. It verifies the deployed page and catalog on all four Firebase domains. It uses short-lived Google Workload Identity Federation instead of a committed service account key. Configure its service account with only the permissions needed to publish Hosting and the two databases' rules and indexes. The default test workflow requires no cloud credentials.

## Social and embedded-project repair, 2026-10-20
The legacy package rejected newer fields, large inline photo URLs, and HTML source subcollections. Deploying static code alone does not publish Firebase rules. The current implementation accepts normal owner-authenticated actions while protecting account identity, unique handles, admin paths and trusted runtimes.

Comments open in a right sidebar with per-project drafts, retries and keyboard focus management. Local photo and thumbnail pickers prepare images before Save/Publish. Ten open-source projects, including three Flash games, have creator/source/license credits and the label Project Embedded. Their original editable sources and licenses are preserved.

Run `python3 scripts/vendor-defaults.py` once before tests/builds if the vendored folders are missing. It reproduces pinned upstream snapshots and verifies the npm Ruffle package digest. Then run `npm install`, `node scripts/build-test-service.mjs`, and the emulator/browser commands in the Verify RapidFire workflow. The workflow runs the rules and real service tests three times and all browser tests twice, then retains the site and test evidence as artifacts. A successful branch verification also commits the reproducible assets and lockfile to the repair branch. No production Firebase records are used in these tests.

Production Firebase rules still require an authenticated deployment to project rapidfire-31bae. This workflow does not claim to deploy backend rules or provide live Google-authentication verification.
