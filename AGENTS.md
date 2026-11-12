# AGENTS.md

Instructions for AI agents working on this repository.

## What this is

A static, no-build, no-dependency mouse-test page. GitHub Actions publishes the repository root
to GitHub Pages on every push to `main`.

- Live: <https://alexewerlof.github.io/mousetest/>
- Entry point: `index.html` → `js/main.js` → `js/mouse-art.js` → `js/mouse-test.js`
- Composition root is `#stage`; the drawing is fetched from `assets/mouse.svg` and injected.

There is deliberately no framework, bundler, package manager, lockfile or test suite. Do not add
one. Keep the site working as plain files opened over HTTP.

## Commands

```sh
python3 -m http.server 8080   # serve the repo root; ES modules and fetch() need HTTP
```

There is no lint, build or test script. Verify changes in a real browser (Playwright with its own
Chromium works well); do not claim a visual change works without checking it on the page.

## Files and responsibilities

| File                          | Responsibility                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `index.html`                  | Page shell only: metadata, favicon, `#stage`, hidden `#stage-note`, `<noscript>` |
| `styles.css`                  | Tokens, layout, arrow reveal, button fill, wheel nudge, `prefers-reduced-motion` |
| `assets/mouse.svg`            | The illustration; authored and edited by the owner in an external SVG editor     |
| `js/main.js`                  | Arms the back guard, loads the art, appends it, reports failures                 |
| `js/mouse-art.js`             | Fetch, parse, normalise, flatten inline styles, validate ids, `ArtworkError`     |
| `js/mouse-test.js`            | Input listeners → state objects → class toggling (the only render path)          |
| `js/back-guard.js`            | Absorbs browser back-button presses by keeping one spare history entry           |
| `.github/workflows/pages.yml` | Uploads the repo root and deploys it to GitHub Pages                             |

The artwork is the owner's canvas. Never rewrite `assets/mouse.svg` wholesale, re-draw it, or
"fix" its geometry or transforms unless explicitly asked.

## Artwork contract

The interaction code finds elements by id. That is the whole coupling:

| id                         | Element        | Role                                              |
| -------------------------- | -------------- | ------------------------------------------------- |
| `primary-button`           | closed shape   | left button (`MouseEvent.button` 0)               |
| `wheel-button`             | shape or `<g>` | wheel (`button` 1); also receives scroll and tilt |
| `secondary-button`         | closed shape   | right button (`button` 2)                         |
| `back-button`              | closed shape   | lower/rear half of the side button (`button` 3)   |
| `forward-button`           | closed shape   | upper/front half of the side button (`button` 4)  |
| `arrow-up` … `arrow-right` | shape or `<g>` | **optional**; revealed by pointer movement        |

- The five button ids are required; if one is missing the page shows which.
- The arrows are optional; missing ones only produce an `info` console line.
- `#mouse` / `#body` are free-form; nothing depends on them.
- Do not log every flattened inline style. The file legitimately has `style` on most shapes, so
  only report declarations that had to be dropped.

## Rendering model (do not regress)

- **One render path.** State lives in `createMouseTest` and is rendered only by toggling classes.
  Keep visuals in CSS; do not set `fill`/`transform`/`opacity` inline from JS.
- **Direction arrows** live in the artwork, hidden with `opacity: 0`. `is-up` / `is-down` /
  `is-left` / `is-right` go on the SVG **root** and reveal the matching arrow. There is no
  transition on the arrows by design — they are either shown or hidden. Each axis clears
  independently after `DIRECTION_HOLD_MS` (140 ms).
- **Pressed buttons** get `is-pressed`, which sets `fill: var(--press-fill)` only. The shape keeps
  its own stroke, so the drawing stays line art. `.is-pressed > *` is required to recolour the
  wheel's child rects.
- **Wheel cues** use `is-scroll-up/down` (120 ms) and `is-tilt-left/right` (220 ms) plus the
  `--wheel-x` / `--wheel-y` custom properties. The nudge uses the CSS `translate` property, not
  `transform`, so an authored `transform` attribute still composes. Do not put a `transform`
  attribute on `#wheel-button`, and do not put motion back on the arrows.
- **No moving-the-mouse model.** An earlier revision moved the whole mouse over a fixed shadow;
  the owner rejected it. Do not reintroduce offsets, shadows or an opaque backing plate.

## Back-button guard

`js/back-guard.js` pushes one extra history entry for the same URL so the browser's own back step
lands back on this document. It re-arms only after a popstate that follows a `button: 3` press
within 1.5 s, so keyboard/toolbar back still leaves — do not make it re-arm unconditionally, that
would trap visitors. The marker in `history.state` prevents stacking entries on reload.

Chromium performs this navigation in the browser process: `preventDefault()` on `mousedown` does
not stop it. That is why the guard exists.

## Artwork edits (BoxySVG round trip)

The owner edits the SVG in BoxySVG. Known behaviour:

- It adds an XML prolog and rewrites `d` spacing; that is fine.
- It writes `style="…"` for anything touched, including default grey fills and a 2px stroke width;
  `flattenStyles` converts the presentation ones back to attributes silently.
- It adds new objects to the selected group, so a save can move a shape to a surprising place.
- It has dropped cubic segments from the flank after a stray drag. Symptoms of a bad round trip:
  the stage note appears, hairlines double, or the silhouette gains a notch. Check the rendered
  page after any SVG change.
- A duplicate `style` attribute is invalid XML and is rejected by the loader as a parse error.

## Style

- Match the surrounding file. HTML uses 4-space indentation; CSS and JS use 2 spaces, double
  quotes and semicolons (Prettier defaults). Do not mass-reformat unrelated code.
- Keep JS modular and documented in the existing JSDoc style.
- No dependencies, no build step, no generated files.
- User-facing text lives in `index.html` / `js/main.js`, layout and colour in `styles.css`.

## Deployment

`.github/workflows/pages.yml` runs on pushes to `main` (and manual dispatch):

1. `actions/checkout@v7`
2. `actions/configure-pages@v6`
3. `actions/upload-pages-artifact@v5` with `path: .` — it excludes `.git`, `.github` and other
   dotfiles by default
4. `actions/deploy-pages@v5`, exposing `steps.deployment.outputs.page_url`

The job needs `contents: read`, `pages: write` and `id-token: write`, and the `github-pages`
environment. Pages must be configured once with **Source: GitHub Actions** in the repository
settings; without that the deploy step fails. There is no `CNAME`; a custom domain only needs one
plus the Pages settings, no workflow change.

Keep action pins on current major tags and keep `runs-on` a literal (the `env` context is not
allowed there).

## Verification checklist

Before calling a change done:

1. `python3 -m http.server 8080` and load the page — no console errors, drawing visible, note
   removed.
2. Press left, middle and right: each fills orange and clears on release. Buttons 3/4 only via
   synthetic `MouseEvent('mousedown', { button: 3 | 4 })` on `window` or CDP
   `Input.dispatchMouseEvent` — `page.mouse` rejects back/forward.
3. Move the pointer: the matching arrow shows within the hold window and hides afterwards.
4. `page.mouse.wheel()` vertical and horizontal: wheel nudges and clears.
5. Press the real back button (CDP `button: 'back'`) three times: URL and state stay put.
6. Narrow viewport (320–390 px) and desktop: the drawing fits with no scrollbars.

Testing traps seen here:

- The 140 ms direction hold means state must be sampled immediately after a move; a synthetic
  `pointermove` at the same point carries no delta and does not keep it alive.
- `page.mouse.wheel()` resolves before the event lands; wait ~50 ms before asserting.
- Use Playwright's Chromium (`~/.cache/ms-playwright/chromium-*/chrome-linux64/chrome`) with
  `executablePath`; it also avoids the `chromium_headless_shell` version mismatch.
- Do not use the VS Code integrated browser for real mouse presses — `mouse.down`/`up` are not
  delivered there.
