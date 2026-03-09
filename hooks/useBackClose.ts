import { useEffect, useRef } from "react";

/**
 * When an overlay (panel/modal/drawer) opens, pushes a synthetic browser
 * history entry so that swipe-back / device back closes the overlay instead
 * of navigating away from the page.
 *
 * Call suppressBackOnClose() before programmatic navigation that also closes
 * an overlay — this prevents the hook's cleanup from calling history.back()
 * and cancelling the in-progress navigation.
 */

let _suppress = false;

export function suppressBackOnClose() {
  _suppress = true;
  // Auto-reset after a short window in case the caller forgets
  setTimeout(() => { _suppress = false; }, 500);
}

export function useBackClose(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (pushedRef.current) {
        pushedRef.current = false;
        if (!_suppress) {
          history.back();
        }
      }
      return;
    }

    // Overlay opened — push a fake history entry
    history.pushState({ overlay: true }, "");
    pushedRef.current = true;

    const handler = () => {
      pushedRef.current = false; // browser already went back
      onClose();
    };
    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      // Unmounted while open — clean up the pushed entry
      if (pushedRef.current) {
        pushedRef.current = false;
        if (!_suppress) {
          history.back();
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
