import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

const TRANSITION_MS = 220;

export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmModalProps) {
  const [visible, setVisible] = useState(open);
  const [closing, setClosing] = useState(false);
  const [entering, setEntering] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const enterRaf = useRef<number | null>(null);

  // Track open prop and drive entry/exit transitions.
  useEffect(() => {
    if (open) {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
      if (enterRaf.current) {
        cancelAnimationFrame(enterRaf.current);
      }

      setVisible(true);
      setClosing(false);
      setEntering(true);
      enterRaf.current = requestAnimationFrame(() => {
        enterRaf.current = requestAnimationFrame(() => {
          setEntering(false);
        });
      });
      return;
    }

    if (visible) {
      setClosing(true);
      closeTimer.current = window.setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, TRANSITION_MS);
    }
  }, [open, visible]);

  // Cleanup timers and RAFs on unmount.
  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
      if (enterRaf.current) {
        cancelAnimationFrame(enterRaf.current);
      }
    };
  }, []);

  // Prevent background scrolling while modal is mounted.
  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  if (!visible || typeof document === "undefined") {
    return null;
  }

  const overlayHidden = closing || entering;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-5 transition-colors duration-200 ${overlayHidden ? "bg-transparent" : "bg-[var(--color-overlay)] backdrop-blur-sm"}`}
      onClick={() => {
        if (!closing) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className={`w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-elevated)] transition-all duration-200 ${overlayHidden ? "opacity-0 scale-[0.95] translate-y-1" : "opacity-100 scale-100 translate-y-0"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-title" className="text-base font-semibold text-[var(--color-text-primary)]">
          {title}
        </h2>
        {message && (
          <div className="mt-2 text-sm text-[var(--color-text-subtle)]">
            {message}
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition"
            onClick={() => {
              if (!closing) {
                onClose();
              }
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition ${
              destructive
                ? "bg-[var(--color-danger-text)] hover:opacity-90"
                : "bg-[var(--color-text-primary)] hover:opacity-90"
            }`}
            onClick={() => {
              if (!closing) {
                onConfirm();
              }
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
