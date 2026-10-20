# RapidFire design context

RapidFire lets signed-in creators publish interactive HTML or embedded projects and participate through posts, comments and social actions. The existing dark feed, orange accent, rounded controls and system fonts remain the visual authority. Uploads and comments extend the existing interface.

Runtime tokens live in the root style block of index.html. Uploads reuse `.dropzone`, `.helper`, `.mini-btn`, `--accent` and the existing modal layout. Project thumbnails cover an idle card and disappear during playback. Profile photos use the existing circular avatar rendering.

Both image fields use the same `imagePicker` owner in js/app.js. Keep their labels, accepted formats, preparation states and errors consistent. English is the current interface language. Narrow-screen controls must fit within the modal without horizontal scrolling.

Comments use a 440 px right sidebar and fill narrow screens below 600 px. The header and composer remain reachable while comments scroll inside the panel. The existing dark panels, orange accent, rounded controls and system typography stay authoritative. Embedded projects display Project Embedded without an account handle. Real user profiles display their unique @username.
