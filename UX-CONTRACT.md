# Touched workflow contract

Authority: the user chose to stay on Firebase Spark and remove the proposed rate limit. Normal app operations are allowed, with no impersonation or changes to another account's content. Existing public profiles, published projects, posts, comments, follower counts and presence remain public. Saved-project lists remain private. Passwords and Firebase Auth account records are never exposed.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Form | imagePicker in js/app.js | This contract | thumbnail, profile photo | tests/uploads.spec.cjs |
| Select/Listbox | Native projectCategory select | index.html | platform native | browser regression |
| Scrollbar | Global index.html stylesheet | DESIGN.md | existing feed geometry | browser screenshot |
| Toast | showToast in js/app.js | Existing application | success/error text | browser regression |
| CRUD | Firebase SDK service in js/firebase-service.js | firestore.rules and database.rules.json | each app action | tests/rules.test.cjs |

Image pickers accept one decodable PNG, JPEG, WebP or GIF up to 5 MB. Images are normalized to a still WebP up to 1600 pixels and 600,000 characters, previewed locally and saved in the profile/project Firestore document only when Save/Publish is selected. Invalid input leaves a previous valid selection intact. Removing a pending profile photo retains the existing Avatar URL; clearing that URL removes the saved avatar. Save buttons prevent duplicate submissions, keep form values after failure and report errors. Rules enforce verified ownership on every document/path. Upload preparation never makes a request.

The same source lives in js/ and the self-contained index.html used by GitHub Pages. scripts/sync-inline.mjs maintains the embedded copy; its check mode prevents drift. Reads and writes use Firebase SDKs and remain subject to the same rules as direct REST requests. Root-wide grants must never override private branches. App account identity derives from Firebase Auth, including the verified-email mapping for the existing MaxP account.

Data lifecycle: existing public records are preserved and own-content deletion remains available. HTML is divided by Unicode code point into Firestore source documents under the owner's reserved project. A random version prevents partial uploads from replacing an active version. Source parts are removed before the project is deleted. No billing plan or legal terms are changed. Normal Firebase Spark quotas still apply. Authentication uses existing Firebase Google sign-in.
