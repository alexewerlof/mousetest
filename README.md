# Mouse Test

A single-page mouse tester. Move the pointer, scroll the wheel and press the buttons of your
mouse to see them light up on a simple illustration.

**[Open the live page →](https://alexewerlof.github.io/mousetest/)**

| Input                                   | Feedback                                                  |
| --------------------------------------- | --------------------------------------------------------- |
| Move up / down / left / right           | The matching arrow appears while you keep moving that way |
| Scroll up / down                        | The wheel nudges up or down                               |
| Tilt the wheel left / right             | The wheel shifts sideways                                 |
| Primary, middle, secondary button       | The matching button fills orange                          |
| Back / forward button (buttons 3 and 4) | The matching half of the side button fills orange         |

Highlights stay on while a button is held; the arrows and the wheel nudge clear as soon as the
input stops. There is no build step and no dependencies — just static files served over HTTP.

## Run locally

The artwork is loaded with `fetch()`, so serve the folder instead of opening the file directly:

```sh
python3 -m http.server 8080
# then open http://localhost:8080/
```

## Deploy

GitHub Pages serves this folder straight from `main` — no workflow, no build:

- **Settings → Pages → Source: Deploy from a branch**
- Branch `main`, folder `/` (root)

Pushing to `main` republishes the site a minute later. Everything in the repository is public
under the Pages URL, so keep notes and scratch files out of it.

## Files

```
index.html                  page shell and fallback text
styles.css                  layout, tokens and state styles
assets/mouse.svg            the illustration (edit it in any SVG editor)
js/main.js                  bootstrap: load the drawing, insert it, wire it up
js/mouse-art.js             fetch, repair and validate the artwork
js/mouse-test.js            input events, state and class rendering
js/back-guard.js            keeps the browser's back button on the page
```

Working on the code or the drawing? See [AGENTS.md](AGENTS.md) for the artwork contract,
conventions and things to watch out for.
