/**
 * Small constants shared inside the projects feature.
 *
 * Flow position:
 * - PromptBox reads composer display settings from here.
 * - Project list screens can also use these values for consistent limits/counts.
 * - These constants do not call the API; they shape UI behavior before submit.
 *
 * Gotchas:
 * - User-facing labels should stay in the i18n dictionaries, not here.
 */
// Non-copy config for the projects feature (grid sizing + name cap). All
// user-facing copy now lives in the `projects` dictionary namespace.

// Number of skeleton cards shown while the project grid is loading.
export const GRID_SKELETON_COUNT = 6;
// Local UI cap for project names. Prompt-derived names may be shorter than this
// because deriveProjectName() applies its own display-friendly truncation.
export const PROJECT_NAME_MAX_LENGTH = 60;

// Skill chips shown inline in the composer before collapsing the rest into a
// single "+N" overflow pill.
// Keeping only a few chips visible prevents the PromptBox from growing too tall.
export const MAX_VISIBLE_SKILLS = 3;
