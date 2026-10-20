# Embedded project collection
The ten upstream projects appear as **Project Embedded**, with no invented account or @username. Creator credits, original source links and license files remain available in Project details. Actual RapidFire users retain their unique @usernames.

FlxInvaders, Mode and FlxTeroids retain the original licensed SWF bytes and run through bundled Ruffle 0.7.1. The npm player digest is checked by scripts/vendor-defaults.py. Ruffle's MIT/Apache notices are retained. Flash runs in an isolated frame with script access and SWF networking disabled.

2048, Hextris, Fluid Simulation, 0h h1, Astray, Tetris and Breakout retain their corresponding source and license information. The five new local snapshots are pinned in scripts/vendor-defaults.py. Integration notices describe the Escape-to-feed bridge, removal of analytics, relative Astray texture paths, anonymous CORS fluid textures, and in-memory 0h h1 scores. Breakout preserves its original sounds and their CC BY-ND attribution information from its LICENSE.

Only the selected project loads after Tap to play; returning to the feed unloads it. Serve project assets with Access-Control-Allow-Origin: * for isolated fonts and WebGL textures. GitHub Pages supplies this header; Firebase Hosting and the local test server are configured accordingly.
