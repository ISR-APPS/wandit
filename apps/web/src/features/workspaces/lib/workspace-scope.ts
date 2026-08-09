/**
 * Active-workspace scope — the single client-side source of truth for which
 * workspace every API request acts in (teams-workspaces.md §2/§9).
 *
 * This is a tiny framework-free store on purpose: the axios request
 * interceptor (BaseService.ts) and the AI-chat DefaultChatTransport both live
 * OUTSIDE React, so the header value cannot come from a hook. The
 * WorkspaceProvider owns persistence + hydration and writes here; everything
 * that sends a request reads here.
 */
import { PERSONAL_WORKSPACE, WORKSPACE_HEADER } from "@wandit/contracts";

/** `personal`, or an organization id. */
export type ActiveWorkspaceId = string;

let activeWorkspaceId: ActiveWorkspaceId = PERSONAL_WORKSPACE;

const listeners = new Set<() => void>();

export function getActiveWorkspaceId(): ActiveWorkspaceId {
	return activeWorkspaceId;
}

export function isPersonalWorkspaceActive(): boolean {
	return activeWorkspaceId === PERSONAL_WORKSPACE;
}

export function setActiveWorkspaceId(next: ActiveWorkspaceId): void {
	const value = next || PERSONAL_WORKSPACE;

	if (value === activeWorkspaceId) {
		return;
	}

	activeWorkspaceId = value;

	for (const listener of listeners) {
		listener();
	}
}

/** useSyncExternalStore-compatible subscription. */
export function subscribeActiveWorkspace(listener: () => void): () => void {
	listeners.add(listener);

	return () => {
		listeners.delete(listener);
	};
}

/**
 * The scoping header for the active workspace. Personal sends NO header —
 * byte-identical requests to pre-teams clients, and the server treats absent
 * and `personal` the same.
 */
export function workspaceScopeHeaders(): Record<string, string> {
	return activeWorkspaceId === PERSONAL_WORKSPACE
		? {}
		: { [WORKSPACE_HEADER]: activeWorkspaceId };
}
