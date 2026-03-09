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
      // Overlay closed normally — consume the pushed history entry only if
      // we're still sitting at the synthetic entry. If the user navigated
      // away (e.g. tapped "Sign In" → router.push), history.state will no
      // longer be {overlay:true}, so we skip history.back() to avoid
      // cancelling the in-progress navigation.
      if (pushedRef.current) {
        pushedRef.current = false;
        if (history.state?.overlay) {
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
      // Unmounted while open — clean up the pushed entry if still there
      if (pushedRef.current) {
        pushedRef.current = false;
        if (history.state?.overlay) {
          history.back();
        }
      }
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
