// Non-copy config for the projects feature (grid sizing + name cap). All
// user-facing copy now lives in the `projects` dictionary namespace.

import type { ComposerQuality } from "@wandit/contracts";

export const GRID_SKELETON_COUNT = 6;
export const PROJECT_NAME_MAX_LENGTH = 60;

// Skill chips shown inline in the composer before collapsing the rest into a
// single "+N" overflow pill.
export const MAX_VISIBLE_SKILLS = 2;

// Mock credit cost per composer quality tier — display only, no pricing logic.
export const QUALITY_CREDITS: Record<ComposerQuality, number> = {
	standard: 10,
	max: 25,
};
