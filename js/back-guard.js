/**
 * Keeps the browser's own back button from leaving this page.
 *
 * @remarks
 * Chromium reports a thumb-button press as `mousedown`/`mouseup`/`auxclick`
 * with `button: 3` (back) or `4` (forward), but it performs the history step
 * itself in the browser process, so calling `preventDefault()` on those events
 * does not stop it. Nothing a page can do cancels the command.
 *
 * What the command asks for is one step back in history, so the one lever a
 * page has is where that step lands. Pushing a second history entry for the
 * current URL means the step stays inside this document: no reload, no
 * navigation, and the illustration keeps whatever state it was in. The entry is
 * re-armed after such a step, so banging the button keeps landing here.
 *
 * The cost is one extra history entry while the page is open, which also means
 * the first keyboard or toolbar "back" after loading appears to do nothing.
 * That is a fair trade for a page whose whole purpose is to have its back
 * button pressed, and it cannot trap a visitor: a step the guard did not cause
 * is left alone, so the next back press leaves as usual.
 */

/** `MouseEvent.button` reported by the back thumb button. */
const BACK_BUTTON = 3;

/** How long after a back-button press a history step counts as its doing. */
const ATTRIBUTION_MS = 1500;

/** Marks the guard entry, so reloading does not stack more of them. */
const GUARD_MARK = "mouse-test-back-guard";

/** @returns {boolean} Whether the current entry is the guard entry. */
const isArmed = () => {
  const state = history.state;
  const marker =
    typeof state === "object" && state !== null ? state.marker : null;
  return marker === GUARD_MARK;
};

/**
 * Puts the guard entry on top of the current one, unless it already is.
 *
 * @returns {boolean} Whether a throwaway entry was added.
 */
const arm = () => {
  if (isArmed()) return false;

  try {
    history.pushState({ marker: GUARD_MARK }, "");
    return true;
  } catch (error) {
    // History can be unavailable (sandboxed frame, some file:// setups). The
    // page still works, it just cannot absorb the button.
    console.warn("mouse test: the back button cannot be absorbed here", error);
    return false;
  }
};

/**
 * Arms the guard and keeps it armed while the back button is being tested.
 */
export function installBackGuard() {
  /** When the back button was last pressed, or 0. */
  let pressedAt = 0;

  // Where the browser does report the thumb buttons, this is what tells a press
  // apart from the visitor using the keyboard or the toolbar.
  window.addEventListener("mousedown", (event) => {
    if (event.button === BACK_BUTTON) pressedAt = Date.now();
  });

  window.addEventListener(
    "popstate",
    () => {
      const fromButton = Date.now() - pressedAt < ATTRIBUTION_MS;
      pressedAt = 0;

      // Only a step caused by the button is absorbed repeatedly. Anything else
      // is the visitor's own navigation and must be left able to continue.
      if (fromButton) arm();
    },
    { passive: true },
  );

  arm();
}
