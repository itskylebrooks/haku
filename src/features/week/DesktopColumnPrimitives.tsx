import type React from "react";
import { CirclePlus } from "lucide-react";

export const DesktopDivider = ({
  isActive = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  isActive?: boolean;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}) => (
  <div
    className="flex h-[2px] items-center w-full"
    onDragOver={(event) => {
      if (onDragOver) {
        event.preventDefault();
        onDragOver(event);
      }
    }}
    onDragLeave={(event) => {
      if (onDragLeave) {
        onDragLeave(event);
      }
    }}
    onDrop={(event) => {
      if (onDrop) {
        event.preventDefault();
        onDrop(event);
      }
    }}
  >
    <div
      className={`h-px w-full rounded-full transition-colors ${isActive ? "bg-[var(--color-text-meta)]" : "bg-[var(--color-border-divider)]"
        }`}
    />
  </div>
);

export const DesktopEmptySlot = ({ onClick, label = "New activity" }: { onClick: () => void; label?: string }) => (
  <div
    role="button"
    tabIndex={0}
    onClick={onClick}
    onKeyDown={(e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick();
      }
    }}
    className="group/empty flex min-h-[38px] items-center rounded-lg px-1.5 py-1 cursor-pointer transition hover:bg-[var(--color-surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-outline)]"
  >
    <div className="flex min-w-0 flex-1">
      <p className="truncate text-[13px] font-semibold text-[var(--color-text-meta)] opacity-0 group-hover/empty:opacity-100 transition-opacity">
        {label}
      </p>
    </div>
    <div className="flex-shrink-0 opacity-0 group-hover/empty:opacity-100 transition-opacity lg:-translate-x-1.5">
      <CirclePlus className="h-4 w-4 text-[var(--color-text-meta)]" />
    </div>
  </div>
);
