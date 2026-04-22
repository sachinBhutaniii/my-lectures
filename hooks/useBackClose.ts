import { useEffect, useRef } from "react";

/**
 * When an overlay (panel/modal/drawer) opens, pushes a synthetic browser
 * history entry so that swipe-back / device back closes the overlay instead
 * of navigating away from the page.
 */

// Call before any onClose()+router.push() pair to skip the replaceState cleanup
// entirely — avoids racing with in-progress navigations.
let _suppress = false;

export function suppressBackOnClose() {
  _suppress = true;
  setTimeout(() => { _suppress = false; }, 500);
}

export function useBackClose(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      if (pushedRef.current) {
        pushedRef.current = false;
        if (!_suppress) {
          // Replace the fake overlay entry in-place rather than calling
          // history.back(), which navigates away on a fresh tab/PWA with
          // no prior history entry.
          history.replaceState(null, "");
        }
      }
      return;
    }

    // Overlay opened — push a fake history entry
    history.pushState({ overlay: true }, "");
    pushedRef.current = true;

    const handler = () => {
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
          history.replaceState(null, "");
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
