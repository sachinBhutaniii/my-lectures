import { useEffect, useRef } from "react";

/**
 * When an overlay (panel/modal/drawer) opens, pushes a synthetic browser
 * history entry so that swipe-back / device back closes the overlay instead
 * of navigating away from the page.
 */
export function useBackClose(isOpen: boolean, onClose: () => void) {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Overlay closed normally — consume the pushed history entry
      if (pushedRef.current) {
        pushedRef.current = false;
        history.back();
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
        history.back();
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
