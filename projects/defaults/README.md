# RapidFire starter collection

Imported projects appear as **Default Project**, without a RapidFire account, handle, or Follow button. Original creator names, repository links, and license notices remain available in Project details. Likes, saves, and comments refer to the project, not an invented account. Initial engagement counts are zero.

The canonical collection is `catalog.json`; run `node scripts/sync-inline.mjs` after editing it. The three Flash HTML wrappers contain the original compressed SWF bytes downloaded from Adam Saltsman's own sites. Their download URLs and SHA-256 digests are recorded in the catalog. Ruffle 0.7.1 loads on demand from jsDelivr. Flash runs in an opaque-origin iframe with scripting access and SWF networking disabled. No Adobe Flash plugin is installed.

2048 is an MIT-licensed local copy of Gabriele Cirulli's project, with external tracking removed, system fonts, a derivative notice, and an Escape-to-feed handler. Its original creator and concept credits remain. Hextris is a separate GPL-3.0-or-later program in `hextris/`, with its corresponding editable source, assets, README, and license included. Changes dated 2026-10-20 remove ads, analytics, and external fonts, use in-memory scores in the isolated frame, and add Escape-to-feed. Both games keep scores only for the current play session. Their upstream repositories are linked in details.

Fluid Simulation, 0h h1, and Astray load the creators' published demos in cross-origin sandboxed frames. Those demos require a network connection and remain maintained by their creators; their source and individual license notices are linked in details.

Flash games and Astray use keyboard controls; the other projects also support pointer or touch input. Hardware acceleration improves Flash and WebGL performance. Returning to the feed unloads the running frame.

Display names may be shared by multiple people. Usernames are case-insensitive, unique, and reserved transactionally: changing one must release its previous reservation in the same transaction. Firebase rules reject extra aliases, forged profile ownership, and writes that impersonate starter project IDs.
