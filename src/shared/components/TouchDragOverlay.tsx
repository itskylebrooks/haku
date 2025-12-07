import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface TouchDragOverlayProps {
  children: ReactNode;
  x: number;
  y: number;
}

export const TouchDragOverlay = ({ children, x, y }: TouchDragOverlayProps) => {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        transform: `translate(${x}px, ${y}px)`,
        pointerEvents: "none",
        zIndex: 9999,
        touchAction: "none",
        width: "max-content",
      }}
    >
      {children}
    </div>,
    document.body
  );
};
