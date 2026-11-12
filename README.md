# Mouse Test

A single-page mouse tester. Move the pointer, scroll the wheel and press the buttons of your
mouse to see them light up on a minimal SVG illustration.

Live site: `https://<your-user>.github.io/mousetest/`

## What it tests

| Input                                    | Feedback                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| Pointer moving up / down / left / right  | The matching arrow appears while you keep moving that way |
| Wheel scrolled up / down                 | The wheel nudges up or down                               |
| Wheel tilted left / right (if supported) | The wheel shifts sideways                                 |
| Primary button (`button: 0`)             | Left button of the illustration is filled                 |
| Middle button (`button: 1`)              | Wheel is filled                                           |
| Secondary button (`button: 2`)           | Right button of the illustration is filled                |
| Back button (`button: 3`)                | Rear (lower) half of the side button is filled            |
| Forward button (`button: 4`)             | Front (upper) half of the side button is filled           |

Every highlight is the same thing: the shape fills with orange (`#ff7646`) and keeps its own grey
outline, so a pressed button reads as one kind of feedback and the drawing stays line art. Button
highlights stay on while the button is held; the wheel cues clear shortly after the input stops.

The four direction arrows are hidden at rest. An arrow appears while the pointer moves that way and
disappears as soon as you stop — no fade, so the drawing is either quiet or showing exactly the
direction you are moving in. Nothing else on the illustration moves with the pointer.

## Run locally

The page needs to be served over HTTP — the artwork is fetched over `fetch()`, which does not work
from `file://`:

```sh
python3 -m http.server 8080
# then open http://localhost:8080/
```

## Deploy

Pushing to `main` publishes the repository root with GitHub Actions
(`.github/workflows/pages.yml`). One-time setup: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

There is no build step and no dependencies to install. To use your own domain, add a `CNAME` file
containing the domain and configure it under **Settings → Pages → Custom domain**; the workflow
needs no changes.

## Structure

```
index.html                  page shell: title, stage, static fallback text
styles.css                  tokens, layout, fills and motion for each state
assets/mouse.svg            the illustration; edit this in an SVG editor
js/main.js                  bootstrap: guard the back button, load the artwork, insert it, wire it up
js/mouse-art.js             fetch, parse and validate the artwork
js/back-guard.js            keeps the browser's back button on this page
js/mouse-test.js            input events, state, class rendering
.github/workflows/pages.yml GitHub Pages deployment
```

## Editing the illustration

`assets/mouse.svg` is a plain, standalone SVG file. Open it in Inkscape, BoxySVG, Illustrator or
any other editor, change the shapes, save it back — no build step, no generated files. The app
fetches it on load, so a reload shows your changes.

The app finds the parts it animates by id. That is the whole contract:

| id                         | element        | role                                                        |
| -------------------------- | -------------- | ----------------------------------------------------------- |
| `primary-button`           | closed shape   | left button (`button: 0`)                                   |
| `secondary-button`         | closed shape   | right button (`button: 2`)                                  |
| `wheel-button`             | shape or `<g>` | wheel (`button: 1`); also receives the scroll and tilt cues |
| `back-button`              | closed shape   | lower/rear half of the side button (`button: 3`)            |
| `forward-button`           | closed shape   | upper/front half of the side button (`button: 4`)           |
| `arrow-up` … `arrow-right` | shape or `<g>` | optional; revealed by pointer movement                      |

The five button ids are required — the page lists any that are missing instead of drawing. The
arrows are optional: without them the mouse still works, it just has no pointer feedback.

Rules worth knowing before you redraw:

- **Buttons are closed shapes.** Each button is one path whose outline is its own border: the
  shared seam, the centre split and the flanks all come from the neighbouring shape's edge. There
  are no clip paths and no separate outline layers to keep in sync.
- **Shared edges must coincide.** Adjacent shapes both stroke the edge they share — that is what
  keeps a hairline exactly as thick as one stroke. If the outlines diverge, the line doubles. The
  shape painted later owns that edge, so the seam and the centre split stay ink even while the
  button beside them is filled.
- **Order matters.** Paint the arrows first, then the shell, then the buttons, then the wheel.
  Keep the wheel in one `#wheel-button` group so it highlights and nudges as a unit.
- **The drawing is line art; the stylesheet only fills for a state.** `stroke`, `stroke-width`,
  `stroke-linecap` and `stroke-linejoin` are set on the root, so the drawing looks while you edit
  it the way it renders. Nothing is filled at rest, and nothing in the file needs to match the page
  colour: the buttons are cut out around the wheel rather than the wheel being filled to hide the
  lines behind it.
- **The `viewBox` is the canvas.** The app fits it to the stage and derives the width from the
  aspect ratio, so reframing or resizing the drawing needs no CSS change.
- **Do not put a `transform` attribute on `#wheel-button`.** The app animates it with the CSS
  `translate` property, which composes with an authored transform rather than replacing it, but a
  transform attribute there will make the nudge harder to reason about.

### What the app fixes for you

Editors write files their own way, so the loader repairs one thing instead of refusing to draw:

- **Inline `style` attributes become presentation attributes.** BoxySVG adds a `style` attribute to
  anything whose fill or stroke you touch, and an inline style outranks the stylesheet — a leftover
  `fill` would freeze that shape and the pressed state would stop showing. The declaration is moved
  to the attribute of the same name, which keeps your value in the file while leaving the stylesheet
  in charge at runtime. Declarations with no attribute equivalent (a `filter`, say) are dropped, and
  only those drops are reported in the console — moving the rest is routine, since that is how the
  file is written.

The repair is reported once in the browser console. The loader refuses a file that is not valid SVG
or that is missing one of the five button ids, and the page says which.

## How it works

`js/main.js` arms the back-button guard, fetches the artwork, appends it to the stage and hands the
elements to `js/mouse-test.js`. That module keeps four small state objects (direction, scroll, tilt,
pressed), rebuilds nothing, and simply toggles classes on the element each state belongs to, so there
is one render path and all visuals stay in CSS:

- `is-up`, `is-down`, `is-left`, `is-right` on the SVG root — which arrow is shown
- `is-scroll-up`, `is-scroll-down` on `#wheel-button` — vertical wheel nudge
- `is-tilt-left`, `is-tilt-right` on `#wheel-button` — sideways wheel nudge
- `is-pressed` on any button shape — orange fill, outline unchanged

The wheel nudge is a CSS custom property (`--wheel-x`, `--wheel-y`) read by one `translate`, so a
diagonal wheel event composes instead of overriding, and the amount is a single token
(`--wheel-nudge`, in drawing units). The arrows have no transition at all: `is-up/down/left/right`
on the root simply switches their `opacity`, so there is nothing to time.

## Browser notes

- Buttons 3 and 4 are the browser's back and forward buttons, and the browser runs that navigation
  itself — `preventDefault()` on the `mousedown` it reports does not stop it. `js/back-guard.js`
  handles it differently: it keeps one spare history entry for this same URL, so the step the button
  asks for lands back on this page instead of the previous one. The page therefore stays put while
  you test the button, repeated presses included, and a back press that the guard did not cause is
  left alone so the visitor can still leave. Firefox may not report these buttons at all, depending
  on the OS and mouse driver.
- Middle-click auto-scroll is suppressed so the wheel test stays visible.
- Wheel tilt is reported by the browser as horizontal scroll (`event.deltaX`), or by some mice as
  buttons 6 and 7. Both encodings are handled, so a horizontal two-finger trackpad swipe or
  shift+scroll also shifts the wheel sideways.
- The context menu is suppressed on this page because the secondary button is what is being tested.
- Touch devices have no wheel: dragging still shows the direction arrows.
- The test needs a pointing device; there is no keyboard equivalent.
- If the artwork cannot be loaded the stage says why: an unreachable file and a file that is
  missing parts read differently.
