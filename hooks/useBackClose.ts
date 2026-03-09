import { useEffect, useRef } from "react";

/**
 * When an overlay (panel/modal/drawer) opens, pushes a synthetic browser
 * history entry so that swipe-back / device back closes the overlay instead
 * of navigating away from the page.
 */

// Prevents cleanup's history.back() from firing other overlays' popstate handlers
let _backInProgress = false;

// Call before any onClose()+router.push() pair to skip the history.back() cleanup
// entirely — avoids cancelling in-progress navigations.
let _suppress = false;

export function suppressBackOnClose() {
  _suppress = true;
  setTimeout(() => { _suppress = false; }, 500);
}

function safeBack() {
  _backInProgress = true;
  history.back();
  // Reset after the browser has dispatched the resulting popstate event
  setTimeout(() => { _backInProgress = false; }, 50);
}

export function useBackClose(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (pushedRef.current) {
        pushedRef.current = false;
        if (!_suppress) {
          safeBack();
        }
      }
      return;
    }

    // Overlay opened — push a fake history entry
    history.pushState({ overlay: true }, "");
    pushedRef.current = true;

    const handler = () => {
      if (_backInProgress) return; // ignore popstate from cleanup, not user gesture
      pushedRef.current = false;
      onClose();
    };
    window.addEventListener("popstate", handler);

    return () => {
      window.removeEventListener("popstate", handler);
      // Unmounted while open — clean up the pushed entry
      if (pushedRef.current) {
        pushedRef.current = false;
        if (!_suppress) {
          safeBack();
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
