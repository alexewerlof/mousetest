import { BUTTON_IDS } from "./mouse-art.js";

/** Directions a pointer can move in. */
const DIRECTIONS = ["up", "down", "left", "right"];

/** Directions a scroll wheel reports on its own axis. */
const SCROLL_DIRECTIONS = ["up", "down"];

/** Directions the scroll wheel reports when it tilts sideways. */
const TILT_DIRECTIONS = ["left", "right"];

/** Maps `MouseEvent.button` to the button it represents. */
const BUTTON_BY_INDEX = ["primary", "wheel", "secondary", "back", "forward"];

/**
 * Some mice report a wheel tilt as buttons 6 (left) and 7 (right) instead of,
 * or in addition to, horizontal scroll deltas.
 */
const TILT_BY_BUTTON_INDEX = { 6: "left", 7: "right" };

/** Maps internal state keys to the classes that render them on the SVG. */
const CLASS_BY_DIRECTION = {
  up: "is-up",
  down: "is-down",
  left: "is-left",
  right: "is-right",
};

/**
 * The axis each direction is reported on. A direction is cleared once its own
 * axis stops moving, so moving sideways does not keep a vertical arrow alive.
 */
const AXIS_BY_DIRECTION = { up: "y", down: "y", left: "x", right: "x" };

const CLASS_BY_SCROLL = {
  up: "is-scroll-up",
  down: "is-scroll-down",
};

const CLASS_BY_TILT = {
  left: "is-tilt-left",
  right: "is-tilt-right",
};

/** Class shared by every pressed button. */
const PRESSED_CLASS = "is-pressed";

/** Movement below this many pixels is treated as jitter, not a direction. */
const MOVE_THRESHOLD_PX = 1;

/** How long an arrow stays after the last movement on its axis. */
const DIRECTION_HOLD_MS = 140;

/** How long the wheel nudge lasts after the last wheel step. */
const SCROLL_CUE_MS = 120;

/**
 * How long the sideways wheel nudge lasts after a tilt. Tilt arrives as one or
 * two sparse detents, so it needs a longer cue than a scroll to stay readable.
 */
const TILT_CUE_MS = 220;

/**
 * Wires the mouse testing behaviour onto the illustration.
 *
 * All state lives in the closure and is rendered as classes on the elements
 * that show it, so the visual language stays in CSS.
 *
 * @param {{ root: Element, buttons: Record<string, Element> }} art - Handles
 *   for the injected artwork, as returned by `loadMouseArt()`.
 * @returns {{ reset: () => void }} A controller with a manual reset.
 */
export function createMouseTest({ root, buttons }) {
  const directions = { up: false, down: false, left: false, right: false };
  const scroll = { up: false, down: false };
  const tilt = { left: false, right: false };
  const pressed = Object.fromEntries(
    Object.keys(BUTTON_IDS).map((name) => [name, false]),
  );

  const directionTimers = { x: null, y: null };
  const scrollTimers = new Map();
  const tiltTimers = new Map();

  /** Last pointer position, used to derive movement deltas. */
  let lastPoint = null;

  const render = () => {
    for (const direction of DIRECTIONS) {
      const className = CLASS_BY_DIRECTION[direction];
      // On the root, because that is what the stylesheet reads to reveal the
      // matching arrow.
      root.classList.toggle(className, directions[direction]);
    }
    for (const [name, element] of Object.entries(buttons)) {
      element.classList.toggle(PRESSED_CLASS, pressed[name]);
    }
    for (const direction of SCROLL_DIRECTIONS) {
      buttons.wheel.classList.toggle(
        CLASS_BY_SCROLL[direction],
        scroll[direction],
      );
    }
    for (const direction of TILT_DIRECTIONS) {
      buttons.wheel.classList.toggle(CLASS_BY_TILT[direction], tilt[direction]);
    }
  };

  /** Adds or removes one arrow, reporting whether that changed anything. */
  const setDirection = (direction, isActive) => {
    if (directions[direction] === isActive) return false;
    directions[direction] = isActive;
    render();
    return true;
  };

  /**
   * Shows the arrow for a direction and hides it again once its axis stops
   * moving. The arrow is either visible or not, so the timer only decides when
   * to take it away - there is no fade to wait for.
   */
  const showDirection = (direction) => {
    const axis = AXIS_BY_DIRECTION[direction];
    setDirection(direction, true);

    clearTimeout(directionTimers[axis]);
    directionTimers[axis] = setTimeout(() => {
      directionTimers[axis] = null;
      for (const other of DIRECTIONS) {
        if (AXIS_BY_DIRECTION[other] === axis) setDirection(other, false);
      }
    }, DIRECTION_HOLD_MS);
  };

  /** Briefly nudges the wheel for scroll feedback. */
  const showScroll = (direction) => {
    if (!scroll[direction]) {
      scroll[direction] = true;
      render();
    }
    clearTimeout(scrollTimers.get(direction));
    scrollTimers.set(
      direction,
      setTimeout(() => {
        scrollTimers.delete(direction);
        scroll[direction] = false;
        render();
      }, SCROLL_CUE_MS),
    );
  };

  /** Briefly shifts the wheel sideways for tilt feedback. */
  const showTilt = (direction) => {
    if (!tilt[direction]) {
      tilt[direction] = true;
      render();
    }
    clearTimeout(tiltTimers.get(direction));
    tiltTimers.set(
      direction,
      setTimeout(() => {
        tiltTimers.delete(direction);
        tilt[direction] = false;
        render();
      }, TILT_CUE_MS),
    );
  };

  const setButton = (buttonIndex, isPressed) => {
    const name = BUTTON_BY_INDEX[buttonIndex];
    if (!name || pressed[name] === isPressed) return;
    pressed[name] = isPressed;
    render();
  };

  const onPointerMove = (event) => {
    const point = { x: event.clientX, y: event.clientY };
    if (!lastPoint) {
      lastPoint = point;
      return;
    }
    const deltaX = point.x - lastPoint.x;
    const deltaY = point.y - lastPoint.y;
    lastPoint = point;

    if (Math.abs(deltaX) >= MOVE_THRESHOLD_PX) {
      showDirection(deltaX < 0 ? "left" : "right");
    }
    if (Math.abs(deltaY) >= MOVE_THRESHOLD_PX) {
      showDirection(deltaY < 0 ? "up" : "down");
    }
  };

  const onPointerLeave = () => {
    lastPoint = null;
  };

  const onWheel = (event) => {
    if (event.deltaY) {
      showScroll(event.deltaY < 0 ? "up" : "down");
    }
    if (event.deltaX) {
      // A wheel that tilts side to side reports its movement on X.
      showTilt(event.deltaX < 0 ? "left" : "right");
    }
  };

  const onMouseDown = (event) => {
    const tiltDirection = TILT_BY_BUTTON_INDEX[event.button];
    if (tiltDirection) {
      event.preventDefault();
      showTilt(tiltDirection);
      return;
    }
    // Suppress middle-click auto-scroll so the wheel button can be tested.
    if (event.button === 1) event.preventDefault();
    // The thumb buttons are run by the browser itself, so this cannot stop the
    // navigation they cause; js/back-guard.js is what keeps the page in place.
    if (event.button === 3 || event.button === 4) event.preventDefault();
    setButton(event.button, true);
  };

  const onMouseUp = (event) => {
    setButton(event.button, false);
  };

  const onContextMenu = (event) => {
    // The secondary button is under test here, not a menu.
    event.preventDefault();
  };

  /** Clears every indicator, e.g. when the window loses focus mid-click. */
  const reset = () => {
    for (const axis of Object.keys(directionTimers)) {
      clearTimeout(directionTimers[axis]);
      directionTimers[axis] = null;
    }
    for (const timer of scrollTimers.values()) clearTimeout(timer);
    scrollTimers.clear();
    for (const timer of tiltTimers.values()) clearTimeout(timer);
    tiltTimers.clear();

    for (const direction of DIRECTIONS) directions[direction] = false;
    for (const direction of SCROLL_DIRECTIONS) scroll[direction] = false;
    for (const direction of TILT_DIRECTIONS) tilt[direction] = false;
    for (const name of Object.keys(pressed)) pressed[name] = false;

    lastPoint = null;
    render();
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("wheel", onWheel, { passive: true });
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", reset);
  document.addEventListener("contextmenu", onContextMenu);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") reset();
  });

  render();

  return { reset };
}
