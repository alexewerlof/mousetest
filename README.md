# Mouse Test

A single-page mouse tester. Move the pointer, scroll the wheel and press the buttons of your
mouse to see them light up on a minimal SVG illustration.

Live site: `https://<your-user>.github.io/mousetest/`

## What it tests

| Input | Feedback |
| --- | --- |
| Pointer moving up / down / left / right | The matching arrow is filled and fades out 0.5 s after you stop |
| Wheel scrolled up / down | The up / down arrow is filled and the wheel nudges vertically |
| Wheel tilted left / right (if supported) | The left / right arrow is filled and the wheel shifts sideways |
| Primary button (`button: 0`) | Left button of the illustration is filled |
| Middle button (`button: 1`) | Wheel is filled |
| Secondary button (`button: 2`) | Right button of the illustration is filled |
| Back button (`button: 3`) | Rear (lower) half of the side button is filled |
| Forward button (`button: 4`) | Front (upper) half of the side button is filled |

Every highlight uses the same pairing — a lilac fill with an accent outline — so a direction and a
pressed button read as the same kind of feedback. Highlights are removed the moment the button is
released. Direction arrows stay lit while you keep moving in that direction and fade out over half a
second when you pause.

## Run locally

The page needs to be served over HTTP (ES modules and the import map do not work over `file://`):

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
index.html                     markup, SVG illustration, import map
styles.css                     design tokens, layout, state styling
js/main.js                     bootstrap: finds the SVG, starts the test
js/mouse-test.js               state, event listeners, class rendering
.github/workflows/pages.yml    GitHub Pages deployment
```

## How it works

The illustration is static SVG, drawn as a hairline outline: a shell silhouette, an inset button-cap
contour that turns into the button seam, a centre split, a two-ring wheel and a tall side capsule.
The shell path is declared once in `<defs>` and reused through `<use>`. A pressed button is filled
first and then clipped twice — by the shell silhouette and by the cap contour — so the fill covers
exactly the area the button encloses and none of the sliver between the silhouette and the cap line.
The silhouette is painted over the fill afterwards, so pressing a button never thins the outline.
The direction arrows are hollow ribbons: a thick ink stroke with a thinner page-coloured stroke on
top of it. When a direction lights up, that inner stroke changes to the same lilac used for pressed
buttons, so the ribbon reads as filled.

All state is expressed as classes on the SVG root, and CSS decides how each state looks:

- `is-up`, `is-down`, `is-left`, `is-right` — direction arrows
- `is-scroll-up`, `is-scroll-down` — vertical wheel nudge
- `is-tilt-left`, `is-tilt-right` — sideways wheel nudge
- `is-primary`, `is-secondary`, `is-wheel`, `is-back`, `is-forward` — pressed buttons

`js/mouse-test.js` keeps three small state objects, rebuilds one class map and applies it with
`jjSvg.setClasses(map)`, so there is a single render path. The [jj](https://github.com/alexewerlof/jj)
library is loaded from jsDelivr through the import map in `index.html`; it is used only for
event binding and class/query helpers.

## Browser notes

- Buttons 3 and 4 may also trigger the browser's own back/forward navigation. JavaScript cannot
  cancel that; on a fresh visit there is no history entry to go back to, so nothing happens.
  Firefox may not report these buttons at all, depending on the OS and mouse driver.
- Middle-click auto-scroll is suppressed so the wheel test stays visible.
- Wheel tilt is reported by the browser as horizontal scroll (`event.deltaX`), or by some mice as
  buttons 6 and 7. Both encodings are handled, so a horizontal two-finger trackpad swipe or
  shift+scroll also shifts the wheel sideways.
- The context menu is suppressed on this page because the secondary button is what is being tested.
- Touch devices have no wheel: dragging still lights the direction arrows.
- The test needs a pointing device; there is no keyboard equivalent.
- If jsDelivr is unreachable the illustration still renders, but without any interaction.
