// Public surface consumed by routes and other features.
// Pages are never exported from barrels.
export type { WorkspaceTab } from "./api/dto";
// Tab defs power the launch-window /preview lookalike's static tab bar too.
export { WORKSPACE_TABS } from "./lib/constants";
export { isWorkspaceTab } from "./lib/helpers";
