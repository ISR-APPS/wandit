import type {
	AuthenticatedRequest,
	MaybeAuthenticatedRequest,
} from "../../../../auth/presentation/http/types/authenticated-request";
import type { WorkspaceContext } from "../../../domain/workspace-context";

export type WorkspaceScopedRequest = AuthenticatedRequest & {
	workspace: WorkspaceContext;
};

export type MaybeWorkspaceScopedRequest = MaybeAuthenticatedRequest & {
	workspace?: WorkspaceContext;
};
