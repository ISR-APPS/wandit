/**
 * Public barrel for the projects feature.
 *
 * Flow position:
 * - Landing, dashboard, and workspace import shared project UI/API pieces here.
 * - PromptBox and useCreateProjectWithPrompt are the key exports for starting
 *   the AI chat/project flow from a prompt.
 * - Lower-level files still own the actual HTTP calls, mutations, and helpers.
 *
 * Gotchas:
 * - Pages stay out of this barrel to avoid accidental route-level imports.
 * - Keep exports intentional so other features depend on a small public surface.
 */
// Public surface consumed by other features (landing hero, workspace).
// Pages are never exported from barrels.
// Project types are re-exported from the feature DTO layer, which is derived
// from shared contracts rather than handwritten duplicate types.
export type { Project, ProjectStatus } from "./api/dto";
// Mutations that other features can use to update existing projects.
export { useDeleteProject, useRenameProject } from "./api/projects.mutations";
// Query keys and query hooks for reading project list/detail data.
export {
	projectKeys,
	useProjectQuery,
	useProjectsQuery,
} from "./api/projects.queries";
// Shared composer used both to create a project and to send chat messages.
export { PromptBox } from "./components/prompt-box";
// Public name-length cap used by forms that edit project names.
export { PROJECT_NAME_MAX_LENGTH } from "./lib/constants";
// Deterministic thumbnail helper for project cards.
export { thumbGradient } from "./lib/helpers";
// High-level create-with-prompt hook that handles auth, credits, creation, and navigation.
export { useCreateProjectWithPrompt } from "./lib/hooks";
