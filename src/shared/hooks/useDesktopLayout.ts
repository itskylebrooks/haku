import { useMediaQuery } from "./useMediaQuery";

export const useDesktopLayout = () => {
  const isWideDesktop = useMediaQuery("(min-width: 1024px)");
  const hasFinePointer = useMediaQuery("(pointer: fine)");
  const isDesktop = isWideDesktop || hasFinePointer;
  const isDesktopNarrow = !isWideDesktop && hasFinePointer;

  return {
    isDesktop,
    isDesktopNarrow,
    isWideDesktop,
  };
};
