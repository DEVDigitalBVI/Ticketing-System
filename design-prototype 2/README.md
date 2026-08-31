# Resort IT Service Desk design prototype

## Open the prototype on a Mac

Double-click **Start Preview.command**. A small Terminal window will remain open while the preview is running, and the design will open automatically in your browser.

When you finish reviewing, close that Terminal window or press **Control-C** in it.

If macOS asks whether you want to open the file, choose **Open**. The launcher only starts a local web server for the files in this folder. It does not install software, connect to an external service, or send data anywhere.

## Alternative command

From this folder, run:

```sh
python3 -m http.server 43127 --bind 127.0.0.1
```

Then open [http://127.0.0.1:43127/](http://127.0.0.1:43127/).

## What is included

- `index.html`: interface structure
- `styles.css`: responsive design system and layout
- `app.js`: prototype navigation and interactions
- `DESIGN_NOTES.md`: human interface principles and design rationale

This package is an interactive design prototype. It does not yet include authentication, a database, ticket persistence, Microsoft 365, or live Level.io integration.
