// Public surface consumed by other features (landing hero, workspace).
// Pages are never exported from barrels.
export type { Project, ProjectStatus } from "./api/dto";
export { useDeleteProject, useRenameProject } from "./api/projects.mutations";
export {
	projectKeys,
	useProjectQuery,
	useProjectsQuery,
} from "./api/projects.queries";
export { PromptBox } from "./components/prompt-box";
export { PROJECT_NAME_MAX_LENGTH } from "./lib/constants";
export { thumbGradient } from "./lib/helpers";
export { useCreateProjectWithPrompt } from "./lib/hooks";
export { setMockProjectStatus } from "./lib/mock-projects";
