import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/app";
import { initializePersistence, setupUnloadHandler } from "@/shared/state";
import "./index.css";

// Initialize persistence before rendering
// This sets up the debounced localStorage subscription
initializePersistence();

// Ensure data is persisted before page unload
setupUnloadHandler();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
