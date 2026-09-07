# Wandit V2 visual guide

The complete guide is `../wandit-v2-visual-guide.html`. Open this file in a browser.

The guide contains 16 chapters, four illustrated steps per chapter, a word guide, and one question per chapter.
Each chapter links to its source section in `../wandit-v2-report.html`.

The document contains its text, illustrations, styles, and controls. It needs no package installation or remote assets.
The browser stores the last chapter, step, and question answers on this device.
The optional Listen control needs a local English voice from the browser.

The text applies ASD-STE100 structural rules. Full compliance needs a review with the official dictionary.
The source report contains proposals, estimates, and claims that need evidence. The guide preserves these distinctions.

## Source files

- `content-a.js` contains chapters 1–8.
- `content-b.js` contains chapters 9–16.
- `illustrations.js` contains the SVG illustrations.
- `app.js` contains the chapter controls and the word guide.
- `index.html` and `styles.css` contain the document structure and its appearance.

## Rebuild the complete file

Run this command from this directory:

```sh
node build.mjs
```

The command replaces `../wandit-v2-visual-guide.html`. It does not change the source report.
