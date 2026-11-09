// Public surface of project sharing. Pages are not exported from barrels.

// Transfer and Move of the V2 Settings panel.
export { useMoveProject, useTransferProject } from "./api/sharing.mutations";
// Query keys and the queries other features read: "Shared with me" and the
// Transfer ownership list of the V2 Settings panel.
export {
	projectSharingQuery,
	sharedProjectsQuery,
	sharingKeys,
	workspaceMembersQuery,
} from "./api/sharing.queries";
// The Share button of the V2 top bar and the dialog of the project card menu.
export { ShareButton } from "./components/share-button";
export { ProjectShareDialog } from "./components/share-dialog";
export { useSharingEnabled } from "./lib/hooks";
// Role rules that the builder panels and the card menu read.
export { hasProjectRole } from "./lib/project-roles";
