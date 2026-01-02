import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Linkedin, User } from 'lucide-react';
import pkg from '../../../package.json';
import { BACKDROP_VARIANTS, SCALE_FADE_VARIANTS } from '@/shared/ui/animations';
import { ConfirmModal } from '@/shared/ui';
import { downloadStateAsJson, importStateFromFile, useHakuStore } from '@/shared/state';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  weekStart: 'sunday' | 'monday';
  onWeekStartChange: (value: 'sunday' | 'monday') => void;
  themeMode: 'system' | 'light' | 'dark';
  onThemeChange: (value: 'system' | 'light' | 'dark') => void;

  isInstallable: boolean;
  isInstalled: boolean;
  onInstall: () => void;
  onShowInstallInstructions: () => void;
}

const borderClass = 'border border-[var(--color-border)]';
const settingsControlWidthClass = 'w-[8.5rem] justify-self-end';

export default function SettingsModal({
  open,
  onClose,
  weekStart,
  onWeekStartChange,
  themeMode,
  onThemeChange,

  isInstallable,
  isInstalled,
  onInstall,
  onShowInstallInstructions,
}: SettingsModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const resetAllData = useHakuStore((state) => state.resetAllData);

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset error state when modal closes
  useEffect(() => {
    if (!open) {
      setImportError(null);
      setIsResetConfirmOpen(false);
    }
  }, [open]);

  function beginClose() {
    try {
      onClose();
    } catch {
      /* ignore */
    }
  }

  function triggerFilePick() {
    fileRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportError(null);
    const result = await importStateFromFile(file);

    if (!result.ok) {
      setImportError(result.error);
    } else {
      // Success - close modal and reset file input
      if (fileRef.current) {
        fileRef.current.value = '';
      }
      beginClose();
    }
  }

  function handleExport() {
    try {
      downloadStateAsJson();
    } catch {
      // Silently fail - download already handles errors
    }
  }

  function handleResetClick() {
    setIsResetConfirmOpen(true);
  }

  function handleResetConfirm() {
    resetAllData();
    setIsResetConfirmOpen(false);
    beginClose();
  }

  function handleResetCancel() {
    setIsResetConfirmOpen(false);
  }

  // Use the incoming props to handle PWA install flow
  const handleInstallClick = () => {
    if (isInstallable) {
      onInstall();
    } else {
      onShowInstallInstructions();
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`fixed inset-0 z-50 flex items-start justify-center bg-[var(--color-overlay)] px-4 pt-[8vh] lg:pt-[20vh] transition-colors duration-200 backdrop-blur-sm`}
            onClick={beginClose}
            role="dialog"
            aria-modal="true"
            variants={BACKDROP_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <motion.div
              className={`w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6 pt-3 pb-8 ${borderClass} shadow-[var(--shadow-elevated)] overflow-y-auto`}
              style={{
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 'max(env(safe-area-inset-bottom), 32px)',
              }}
              onClick={(e) => e.stopPropagation()}
              variants={SCALE_FADE_VARIANTS}
            >
              <div className="mb-2">
                <div className="relative h-12 flex items-center justify-center">
                  <span className="text-lg font-semibold tracking-wide text-[var(--color-text-primary)]">
                    Settings
                  </span>
                  {/* Removed the top-right chevron close button by request. Use the 'Done' button below to close. */}
                </div>
              </div>

              <div className="space-y-4 text-[var(--color-text-primary)]">
                {/* Theme */}
                <div className="text-sm">
                  <div className="grid grid-cols-2 items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold mb-0.5">Theme</div>
                    </div>
                    <div
                      className={`flex items-center justify-end gap-2 whitespace-nowrap ${settingsControlWidthClass}`}
                    >
                      <button
                        type="button"
                        onClick={() => onThemeChange('system')}
                        className={`grid h-10 w-10 place-items-center rounded-lg ${borderClass} transition ${
                          themeMode === 'system'
                            ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]'
                            : 'text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                        title="System"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <path d="M8 21h8" />
                          <path d="M12 17v4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onThemeChange('light')}
                        className={`grid h-10 w-10 place-items-center rounded-lg ${borderClass} transition ${
                          themeMode === 'light'
                            ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]'
                            : 'text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                        title="Light"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="4" />
                          <path d="M12 2v2M12 20v2M20 12h2M2 12H0" />
                          <path d="m17 17 1.5 1.5M5.5 5.5 7 7" />
                          <path d="m17 7 1.5-1.5M5.5 18.5 7 17" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onThemeChange('dark')}
                        className={`grid h-10 w-10 place-items-center rounded-lg ${borderClass} transition ${
                          themeMode === 'dark'
                            ? 'bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)]'
                            : 'text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                        title="Dark"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* PWA Install */}
                <div className="text-sm">
                  <div className="grid grid-cols-2 items-center gap-2">
                    <div>
                      <div className="text-sm font-semibold mb-0.5">Install App</div>
                    </div>
                    <div className={settingsControlWidthClass}>
                      <button
                        type="button"
                        disabled={isInstalled}
                        onClick={handleInstallClick}
                        className={`w-full flex items-center justify-center gap-1.5 rounded-lg h-10 px-3 text-xs font-medium transition-colors whitespace-nowrap border border-[var(--color-border)] ${
                          isInstalled
                            ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-subtle)] opacity-50 cursor-default'
                            : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]'
                        }`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        {isInstalled ? 'Installed' : 'Install'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Week Start */}
                <div className="text-sm">
                  <div className="grid grid-cols-2 items-center gap-2">
                    <div>
                      <div className="text-sm font-semibold mb-0.5">Week Start</div>
                    </div>
                    <div className={`relative ${settingsControlWidthClass}`}>
                      <select
                        aria-label="Week starts on"
                        className="appearance-none w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 h-10 pr-7 text-sm text-[var(--color-text-primary)]"
                        value={weekStart}
                        onChange={(e) => onWeekStartChange(e.target.value as 'sunday' | 'monday')}
                      >
                        <option value="sunday">Sunday</option>
                        <option value="monday">Monday</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-subtle)]" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-[var(--color-border)]" />

                {/* Import/Export/Reset buttons moved here */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {/* Import */}
                  <button
                    type="button"
                    onClick={triggerFilePick}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg h-10 px-3 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 9V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1" />
                      <path d="M2 13h10" />
                      <path d="m9 16 3-3-3-3" />
                    </svg>
                    <span>Import</span>
                  </button>

                  {/* Reset */}
                  <button
                    type="button"
                    onClick={handleResetClick}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg h-10 px-3 text-xs font-medium border border-[var(--color-danger-border)] text-[var(--color-danger-text)] hover:bg-[var(--color-danger-surface)] transition whitespace-nowrap"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
                      <path d="m5.082 11.09 8.828 8.828" />
                    </svg>
                    <span>Reset</span>
                  </button>

                  {/* Export */}
                  <button
                    type="button"
                    onClick={handleExport}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg h-10 px-3 text-xs font-medium border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] transition whitespace-nowrap"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2 7.5V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-1.5" />
                      <path d="M2 13h10" />
                      <path d="m5 10-3 3 3 3" />
                    </svg>
                    <span>Export</span>
                  </button>
                </div>

                {/* Import error message */}
                {importError && (
                  <div className="mt-2 text-xs text-[var(--color-danger-text)]">{importError}</div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="mt-5">
                <button
                  onClick={beginClose}
                  className="w-full rounded-2xl px-4 py-3 text-sm font-semibold bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] hover:bg-[var(--color-emphasis-bg-hover)] transition"
                >
                  Done
                </button>
              </div>

              <div className="mt-6 text-center text-[12px] text-[var(--color-text-subtle)] relative">
                <a
                  href="https://www.linkedin.com/in/itskylebrooks/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kyle Brooks on LinkedIn"
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-primary)] opacity-90 hover:opacity-75 transition-opacity"
                >
                  <Linkedin className="w-5 h-5" />
                </a>

                <a
                  href="https://itskylebrooks.tech/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kyle Brooks personal website"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-primary)] opacity-90 hover:opacity-75 transition-opacity"
                >
                  <User className="w-5 h-5" />
                </a>

                <div className="font-medium text-[var(--color-text-primary)]">
                  Kyle Brooks <span className="mx-2">•</span> Haku {pkg.version}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-3">
                  <a
                    href="https://itskylebrooks.vercel.app/imprint"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Imprint
                  </a>
                  <a
                    href="https://itskylebrooks.vercel.app/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Privacy Policy
                  </a>
                  <a
                    href="https://itskylebrooks.vercel.app/license"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    License
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmModal
        open={isResetConfirmOpen}
        onClose={handleResetCancel}
        onConfirm={handleResetConfirm}
        title="Reset Haku?"
        message="This will erase all activities, settings, and saved data. This action cannot be undone."
        confirmLabel="Erase everything"
        cancelLabel="Keep data"
        destructive
      />
    </>
  );
}
