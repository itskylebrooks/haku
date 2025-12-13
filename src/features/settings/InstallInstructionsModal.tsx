import { Share } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BACKDROP_VARIANTS, SCALE_FADE_VARIANTS } from "@/shared/ui/animations";

interface InstallInstructionsModalProps {
    open: boolean;
    onClose: () => void;
}

export default function InstallInstructionsModal({
    open,
    onClose,
}: InstallInstructionsModalProps) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="fixed inset-0 z-[60] flex items-center justify-center p-5 transition-colors duration-200 bg-[var(--color-overlay)] backdrop-blur-sm"
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                    variants={BACKDROP_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                >
                    <motion.div
                        className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-6 shadow-[var(--shadow-elevated)] border border-[var(--color-border)]"
                        onClick={(e) => e.stopPropagation()}
                        variants={SCALE_FADE_VARIANTS}
                    >
                        <div className="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">
                            Install App
                        </div>

                        <div className="space-y-4 text-sm text-[var(--color-text-primary)]">
                            {/iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream ? (
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>
                                        Tap the <Share className="inline w-4 h-4 mx-1" /> Share button in your browser toolbar.
                                    </li>
                                    <li>
                                        Scroll down and select <strong>"Add to Home Screen"</strong>.
                                    </li>
                                </ol>
                            ) : (
                                <div className="space-y-2">
                                    <p>
                                        To install this app, look for the <strong>"Install"</strong> or <strong>"Add to Home Screen"</strong> option in your browser's menu.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6">
                            <button
                                onClick={onClose}
                                className="w-full rounded-xl px-4 py-3 text-sm font-semibold bg-[var(--color-emphasis-bg)] text-[var(--color-emphasis-text)] hover:bg-[var(--color-emphasis-bg-hover)] transition"
                            >
                                Got it
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
