import { type Variants, type Transition } from "framer-motion";

export const SPRING_TRANSITION: Transition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
};

export const EASE_TRANSITION: Transition = {
    ease: [0.32, 0.72, 0, 1],
    duration: 0.3,
};

// Faster transition for interactions that need to feel snappy
export const FAST_TRANSITION: Transition = {
    ease: "easeInOut",
    duration: 0.15,
};

export const PAGE_VARIANTS: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

export const SLIDE_VARIANTS: Variants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 20 : -20,
        opacity: 0,
    }),
    center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        zIndex: 0,
        x: direction < 0 ? 20 : -20,
        opacity: 0,
    }),
};

export const SCALE_FADE_VARIANTS: Variants = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
};

export const BACKDROP_VARIANTS: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
};

// Reduced motion settings can be handled by conditionally applying these or using useReducedMotion hook in components
