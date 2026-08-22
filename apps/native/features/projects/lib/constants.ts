import { type ComposerQuality, CREDIT_COSTS } from "@wandit/contracts";

// Credit cost per composer quality tier — display only, not the source of
// truth for backend credit enforcement (web constants.ts parity). Standard
// mirrors the contracts price card (page generation, 10 credits); max has no
// fixed price in the v4 catalog, so it shows no tag (null).
export const QUALITY_CREDITS: Record<ComposerQuality, number | null> = {
	standard: CREDIT_COSTS.landingPageGeneration,
	max: null,
};

// Drawer letter-tile gradients, kept as RN-parseable hex pairs.
export const PROJECT_TILE_GRADIENTS = [
	["#F1E6DA", "#E8C2A9"],
	["#F5E6EF", "#E4CBE1"],
	["#E0EEEF", "#BBDBE1"],
	["#F1EEE7", "#E2D6C2"],
] as const;
