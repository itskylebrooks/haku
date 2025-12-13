import { useMediaQuery } from "./useMediaQuery";

export const useDesktopLayout = () => {
  const isWideDesktop = useMediaQuery("(min-width: 1024px)");
  const hasFinePointer = useMediaQuery("(pointer: fine)");
  const hasCoarsePointer = useMediaQuery("(pointer: coarse)");
  const hasLimitedHover = useMediaQuery("(hover: none)");
  const hasTouchPoints = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  const isDesktop = isWideDesktop || hasFinePointer;
  const isDesktopNarrow = !isWideDesktop && hasFinePointer;

  // Prefer touch interactions on devices that advertise coarse pointers / no hover.
  const shouldUseTouch = (hasCoarsePointer || hasLimitedHover) && hasTouchPoints;

  return {
    isDesktop,
    isDesktopNarrow,
    isWideDesktop,
    shouldUseTouch,
  };
};
