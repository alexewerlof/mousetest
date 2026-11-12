/**
 * Loads the mouse illustration from `assets/mouse.svg`.
 *
 * The artwork is a normal, standalone SVG file so it can be edited in any SVG
 * editor. This module is the only place that knows how the app and the drawing
 * are connected: the ids below and which element shows which state.
 *
 * Editors write files in their own way, so anything the app can put right on
 * its own it fixes here instead of refusing to draw. Only the button ids are a
 * hard requirement - those are what the interaction code holds on to.
 */

/**
 * Where the artwork lives. Resolved against this module, so the page works from
 * any directory it is served from.
 */
const MOUSE_SVG_URL = new URL("../assets/mouse.svg", import.meta.url);

/**
 * The button shapes, keyed by the name the interaction code uses. The ids
 * match `MouseEvent.button` 0..4 in that order, so the mapping stays obvious.
 */
export const BUTTON_IDS = {
  primary: "primary-button",
  wheel: "wheel-button",
  secondary: "secondary-button",
  back: "back-button",
  forward: "forward-button",
};

/**
 * The direction arrows. Optional: a drawing without them simply has no
 * pointer feedback, which is better than refusing to show the mouse at all.
 */
export const ARROW_IDS = {
  up: "arrow-up",
  down: "arrow-down",
  left: "arrow-left",
  right: "arrow-right",
};

/** Class the stylesheet uses to size and style the injected drawing. */
const ROOT_CLASS = "mouse-test";

/** Id the injected drawing gets, so CSS and tests have a stable hook. */
const ROOT_ID = "mouse-test";

/** Fallback accessible name, used only when the artwork has no `<title>`. */
const FALLBACK_LABEL = "A computer mouse";

/**
 * Inline style declarations that have a presentation-attribute equivalent, and
 * that the app takes over from the artwork.
 *
 * @remarks
 * Editors write `style` attributes for anything you touch - BoxySVG does it for
 * a fill you pick or a stroke width you type. An inline `style` outranks the
 * stylesheet, so a leftover `fill` would freeze that shape and the pressed
 * state would stop working. The same declaration as a presentation attribute
 * has a lower priority than the stylesheet, which is exactly what we want: the
 * value is kept in the file, and the state rules still win at runtime.
 */
const PRESENTATION_PROPERTIES = new Set([
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "color",
  "display",
  "opacity",
  "paint-order",
  "visibility",
]);

/**
 * Raised when the artwork cannot be used.
 *
 * `code` says which stage failed, so the page can tell "no connection" apart
 * from "the drawing is missing something".
 */
export class ArtworkError extends Error {
  /**
   * @param {"network" | "parse" | "contract"} code - The stage that failed.
   * @param {string} message - Developer-facing detail, for the console.
   * @param {string[]} problems - Short, user-facing problem lines.
   */
  constructor(code, message, problems = []) {
    super(message);
    this.name = "ArtworkError";
    this.code = code;
    this.problems = problems;
  }
}

/**
 * Parses SVG source into an element of the current document.
 *
 * @param {string} source - The contents of an `.svg` file.
 * @returns {SVGSVGElement} The detached root element.
 */
const parseSvg = (source) => {
  const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
  const failure =
    parsed.querySelector("parsererror") ??
    parsed.getElementsByTagName("parsererror")[0];

  if (failure) {
    throw new ArtworkError(
      "parse",
      `The mouse artwork is not valid SVG: ${failure.textContent}`,
    );
  }

  const root = document.importNode(parsed.documentElement, true);
  if (root.localName !== "svg") {
    throw new ArtworkError(
      "parse",
      `The mouse artwork must have an <svg> root, found <${root.localName}>.`,
    );
  }

  return root;
};

/**
 * Applies the parts of the presentation the app owns, leaving everything
 * visual to the artwork and the stylesheet.
 *
 * @param {SVGSVGElement} root - The parsed drawing.
 */
const prepareRoot = (root) => {
  root.id = ROOT_ID;
  root.classList.add(ROOT_CLASS);
  root.setAttribute("role", "img");
  root.setAttribute("focusable", "false");
  // The stylesheet sizes the drawing; a hard-coded size in the file would win
  // over it on some browsers.
  root.removeAttribute("width");
  root.removeAttribute("height");

  if (!root.querySelector("title") && !root.hasAttribute("aria-label")) {
    root.setAttribute("aria-label", FALLBACK_LABEL);
  }
};

/**
 * Rewrites inline styles as presentation attributes.
 *
 * @remarks
 * An editor writes `style` for everything it touches, and that is the normal
 * shape of this file, so the rewrite itself is not worth reporting. Only a
 * declaration that had to be thrown away is, because that is a change the
 * author did not ask for.
 *
 * @param {SVGSVGElement} root - The parsed drawing.
 * @returns {string[]} Declarations that had no attribute equivalent.
 */
const flattenStyles = (root) => {
  const dropped = [];

  for (const element of root.querySelectorAll("[style]")) {
    for (const property of [...element.style]) {
      const value = element.style.getPropertyValue(property);
      const name = `#${element.id || element.localName} ${property}`;

      if (!PRESENTATION_PROPERTIES.has(property)) {
        // No attribute equivalent (a `filter: blur()` from the editor, for
        // example), so it is dropped rather than kept half-applied.
        dropped.push(name);
        continue;
      }

      if (value) element.setAttribute(property, value);
    }

    element.removeAttribute("style");
  }

  return dropped;
};

/**
 * Collects the elements the interaction code needs.
 *
 * @param {SVGSVGElement} root - The parsed drawing.
 * @returns {{ buttons: Record<string, Element>, arrows: Record<string, Element>,
 *   missingArrows: string[] }} The elements to drive, plus any arrows the
 *   drawing does not have.
 */
const collectHandles = (root) => {
  const byId = new Map();
  for (const element of root.querySelectorAll("[id]")) {
    if (!byId.has(element.id)) byId.set(element.id, element);
  }

  const missing = [];
  const required = (id) => {
    const element = byId.get(id);
    if (!element) missing.push(id);
    return element;
  };

  const buttons = {};
  for (const [name, id] of Object.entries(BUTTON_IDS)) {
    buttons[name] = required(id);
  }

  if (missing.length) {
    const problems = missing.map((id) => `missing id "${id}"`);
    throw new ArtworkError(
      "contract",
      `The mouse artwork in assets/mouse.svg is missing: ${missing.map((id) => `#${id}`).join(", ")}`,
      problems,
    );
  }

  const arrows = {};
  const missingArrows = [];
  for (const [direction, id] of Object.entries(ARROW_IDS)) {
    const element = byId.get(id);
    if (element) arrows[direction] = element;
    else missingArrows.push(id);
  }

  return { buttons, arrows, missingArrows };
};

/**
 * Fetches, parses and validates the mouse artwork.
 *
 * @returns {Promise<{ root: SVGSVGElement, buttons: Record<string, Element>,
 *   arrows: Record<string, Element> }>} Handles for the interaction code.
 */
export async function loadMouseArt() {
  let response;

  try {
    // `no-cache` revalidates, so a redrawn file is picked up on the next load
    // instead of being served from a stale cache.
    response = await fetch(MOUSE_SVG_URL, { cache: "no-cache" });
  } catch (cause) {
    throw new ArtworkError(
      "network",
      `Could not fetch ${MOUSE_SVG_URL}: ${cause.message}`,
    );
  }

  if (!response.ok) {
    const status = `${response.status} ${response.statusText}`;
    throw new ArtworkError(
      "network",
      `Could not load ${MOUSE_SVG_URL}: ${status}`,
    );
  }

  const root = parseSvg(await response.text());
  prepareRoot(root);

  const dropped = flattenStyles(root);
  const { buttons, arrows, missingArrows } = collectHandles(root);

  // Nothing here needs the author's attention, but it is worth saying out loud
  // when the file had to be adjusted on the way in.
  if (dropped.length) {
    console.info(`mouse artwork: dropped ${dropped.join(", ")}`);
  }
  if (missingArrows.length) {
    console.info(
      `mouse artwork has no ${missingArrows.map((id) => `#${id}`).join(", ")}; pointer direction will not be shown`,
    );
  }

  return { root, buttons, arrows };
}
