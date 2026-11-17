import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetFolded } from "@/lib/hooks/use-folded";

// Vitest runs without globals, so Testing Library cannot register this itself.
afterEach(() => {
  cleanup();
  // Folded lists are remembered on the device (spec 032): each test starts unfolded.
  try {
    localStorage.clear();
  } catch {
    // Node environment: no storage.
  }
  resetFolded();
});
