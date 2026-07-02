// Public surface consumed by other features (landing hero, workspace).
// Pages are never exported from barrels.
export type { Project, ProjectStatus } from "./api/dto";
export { PromptBox } from "./components/prompt-box";
export { useCreateProjectWithPrompt } from "./lib/hooks";
