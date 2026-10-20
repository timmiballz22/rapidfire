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

The rules tests require Java 21 and use a demo project, never production. They verify permitted own-account operations, authenticated REST POSTs, private saved lists, and rejected account/owner/author/handle spoofing. Browser tests use a deterministic service boundary for upload, retry, keyboard and mobile flows. GitHub CI runs both suites.

After editing `js/app.js` or `js/firebase-service.js`, run `node scripts/sync-inline.mjs` to update the self-contained page. This preserves GitHub Pages compatibility and prevents the two copies from diverging.

## Deploy

1. Sign in with `npx firebase login`.
2. Run `npx firebase deploy --project rapidfire-31bae --only firestore,database` to publish rules and indexes.
3. Merge/push the static site changes to the branch configured for GitHub Pages. Committing rules to GitHub alone does not activate them in Firebase.

Storage rules are included for a future Storage-enabled project but are not needed or deployed by the Spark app. For optional Firebase Hosting, build and deploy with `npx firebase deploy --only hosting`. Keep all private credentials out of Git.

For automatic rule deployment from GitHub, configure the protected `firebase-production` environment with `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` variables. The manual workflow uses short-lived Google Workload Identity Federation instead of a committed service account key. Configure its service account with only the permissions needed to publish the two databases' rules and indexes. The default test workflow requires no cloud credentials.
