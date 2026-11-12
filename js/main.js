import { ArtworkError, loadMouseArt } from "./mouse-art.js";
import { installBackGuard } from "./back-guard.js";
import { createMouseTest } from "./mouse-test.js";

const stage = document.querySelector("#stage");
const note = document.querySelector("#stage-note");

// Before anything else: testing the back button must not take the page away.
installBackGuard();

/** What to say when the artwork cannot be used, per failure stage. */
const MESSAGES = {
  network:
    "The illustration could not be loaded. Check your connection and reload the page.",
  parse: "The illustration could not be read as SVG.",
  contract: "The illustration is missing the parts this page animates.",
};

/**
 * Fills the stage with an explanation instead of leaving it empty.
 *
 * @param {unknown} error - Whatever `loadMouseArt()` threw.
 */
const showFailure = (error) => {
  const isArtworkError = error instanceof ArtworkError;
  const message = isArtworkError ? MESSAGES[error.code] : MESSAGES.parse;

  const summary = document.createElement("p");
  summary.textContent = message;

  note.replaceChildren(summary);

  if (isArtworkError && error.problems.length) {
    const list = document.createElement("ul");
    for (const problem of error.problems) {
      const item = document.createElement("li");
      item.textContent = problem;
      list.append(item);
    }
    note.append(list);
  }

  note.hidden = false;
};

const start = async () => {
  try {
    const art = await loadMouseArt();
    stage.append(art.root);
    // Only now is the note in the way, so it can go for good.
    note.remove();
    createMouseTest(art);
  } catch (error) {
    // The full detail - including which file and line an editor wrote - belongs
    // in the console; the page itself only says what the reader can act on.
    console.error(error);
    showFailure(error);
  }
};

start();
