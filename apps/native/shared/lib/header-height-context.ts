import { createContext } from "react";

// Local twin of @react-navigation/elements' HeaderHeightContext:
// that package is a transitive dep (pnpm isolated node-linker) and must not
// be imported directly. Every screen currently draws its own header
// (headerShown: false), so no navigator provides a height and consumers fall
// back to the safe-area inset. If native headers ever come back, bridge the
// real context value into this one at the layout level.
export const HeaderHeightContext = createContext<number | undefined>(undefined);
