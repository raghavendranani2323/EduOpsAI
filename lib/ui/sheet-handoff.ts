/**
 * Switch from one bottom-sheet to another without overlapping animations.
 *
 * Vaul's drawer exit animation runs ~180-200ms. If you setState({open:false})
 * for sheetA and immediately setState({open:true}) for sheetB, vaul's portal
 * reconciliation can pick the wrong active drawer and you see a flash of
 * blank scrim. This helper centralises the timing in one place: the close
 * runs synchronously, then we wait for the exit animation to settle, and
 * finally open the next sheet on a paint boundary so it animates in cleanly.
 */

const HANDOFF_EXIT_MS = 200;

export function sheetHandoff(close: () => void, open: () => void) {
  close();
  setTimeout(() => {
    if (typeof window !== "undefined" && "requestAnimationFrame" in window) {
      window.requestAnimationFrame(open);
    } else {
      open();
    }
  }, HANDOFF_EXIT_MS);
}
