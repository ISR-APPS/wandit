/**
 * WorkspaceProvider — owns which workspace the app is acting in.
 *
 * Responsibilities (teams-workspaces.md §9):
 * - hydrate the persisted per-user choice from localStorage, validated
 *   against the memberships returned by GET /api/v1/workspaces (an org the
 *   user left silently falls back to personal);
 * - write every change into the framework-free workspace-scope store that
 *   the axios interceptor and the AI-chat transport read;
 * - call Better Auth's organization.setActive for UI coherence only — the
 *   SERVER never trusts the session's active organization for scoping (§2);
 * - drop all scoped query caches on switch so nothing from the previous
 *   workspace bleeds through.
 */
import { useQueryClient } from "@tanstack/react-query";
import { PERSONAL_WORKSPACE, type WorkspaceSummary } from "@wandit/contracts";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from "react";
import { useSession } from "@/features/auth";
import { authClient } from "@/features/auth/lib/auth-client";
import { useWorkspacesQuery } from "@/features/workspaces/api/workspaces.queries";
import {
	type ActiveWorkspaceId,
	getActiveWorkspaceId,
	setActiveWorkspaceId,
	subscribeActiveWorkspace,
} from "@/features/workspaces/lib/workspace-scope";

const STORAGE_PREFIX = "wandit-active-workspace:";

type WorkspaceContextValue = {
	/** `personal` or an organization id — always usable for scoping. */
	activeWorkspaceId: ActiveWorkspaceId;
	/** The active org's summary, or null in the personal workspace. */
	activeWorkspace: WorkspaceSummary | null;
	/** Every org workspace the user belongs to (may be stale while loading). */
	workspaces: WorkspaceSummary[];
	isPersonal: boolean;
	/** owner/admin in the active org; true in personal (self-managed). */
	actorCanManageWorkspace: boolean;
	/** owner in the active org; true in personal — billing is owner-only. */
	actorCanManageBilling: boolean;
	switchWorkspace: (target: ActiveWorkspaceId) => void;
};

const WorkspaceReactContext = createContext<WorkspaceContextValue | null>(null);

function storageKey(userId: string): string {
	return `${STORAGE_PREFIX}${userId}`;
}

function readPersisted(userId: string | undefined): ActiveWorkspaceId {
	if (!userId || typeof window === "undefined") {
		return PERSONAL_WORKSPACE;
	}

	try {
		return (
			window.localStorage.getItem(storageKey(userId)) ?? PERSONAL_WORKSPACE
		);
	} catch {
		return PERSONAL_WORKSPACE;
	}
}

function persist(userId: string | undefined, value: ActiveWorkspaceId): void {
	if (!userId || typeof window === "undefined") {
		return;
	}

	try {
		if (value === PERSONAL_WORKSPACE) {
			window.localStorage.removeItem(storageKey(userId));
		} else {
			window.localStorage.setItem(storageKey(userId), value);
		}
	} catch {
		// Private-mode storage failures degrade to session-only persistence.
	}
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const userId = session?.user.id;
	const queryClient = useQueryClient();
	const workspacesQuery = useWorkspacesQuery({ enabled: Boolean(userId) });
	const workspaces = useMemo(
		() => workspacesQuery.data?.workspaces ?? [],
		[workspacesQuery.data],
	);
	const activeWorkspaceId = useSyncExternalStore(
		subscribeActiveWorkspace,
		getActiveWorkspaceId,
		() => PERSONAL_WORKSPACE,
	);

	// Hydrate the persisted choice once the user is known. Runs again when the
	// membership list lands so a stale org id can be rejected.
	useEffect(() => {
		if (!userId) {
			setActiveWorkspaceId(PERSONAL_WORKSPACE);
			return;
		}

		const persisted = readPersisted(userId);

		if (persisted === PERSONAL_WORKSPACE) {
			return;
		}

		if (!workspacesQuery.data) {
			// Optimistic: keep the persisted org while memberships load so the
			// first render's requests are already scoped correctly.
			setActiveWorkspaceId(persisted);
			return;
		}

		const stillMember = workspaces.some((entry) => entry.id === persisted);

		if (!stillMember) {
			persist(userId, PERSONAL_WORKSPACE);
			setActiveWorkspaceId(PERSONAL_WORKSPACE);
		}
	}, [userId, workspacesQuery.data, workspaces]);

	const switchWorkspace = useCallback(
		(target: ActiveWorkspaceId) => {
			if (target === getActiveWorkspaceId()) {
				return;
			}

			setActiveWorkspaceId(target);
			persist(userId, target);

			// UI coherence only — the server scopes by the header, never by the
			// session's active organization (§2).
			void authClient.organization
				.setActive({
					organizationId: target === PERSONAL_WORKSPACE ? null : target,
				})
				.catch(() => {
					// Cosmetic call; scoping already switched via the header store.
				});

			// Scoped keys embed the workspace id, so the old workspace's data can
			// never be served under the new one — but drop it anyway to free
			// memory and force fresh fetches for the new scope.
			void queryClient.invalidateQueries();
		},
		[queryClient, userId],
	);

	const activeWorkspace = useMemo(
		() =>
			activeWorkspaceId === PERSONAL_WORKSPACE
				? null
				: (workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null),
		[activeWorkspaceId, workspaces],
	);

	const value = useMemo<WorkspaceContextValue>(() => {
		const roles = activeWorkspace?.roles ?? [];
		const isPersonal = activeWorkspaceId === PERSONAL_WORKSPACE;

		return {
			activeWorkspaceId,
			activeWorkspace,
			workspaces,
			isPersonal,
			actorCanManageWorkspace:
				isPersonal || roles.includes("owner") || roles.includes("admin"),
			// Owner-only billing (Zack's decision) — admins never see money UI.
			actorCanManageBilling: isPersonal || roles.includes("owner"),
			switchWorkspace,
		};
	}, [activeWorkspaceId, activeWorkspace, workspaces, switchWorkspace]);

	return (
		<WorkspaceReactContext.Provider value={value}>
			{children}
		</WorkspaceReactContext.Provider>
	);
}

export function useWorkspace(): WorkspaceContextValue {
	const value = useContext(WorkspaceReactContext);

	if (!value) {
		throw new Error("useWorkspace must be used inside WorkspaceProvider");
	}

	return value;
}

/** Reactive active-workspace id usable outside the provider (e.g. keys). */
export function useActiveWorkspaceId(): ActiveWorkspaceId {
	return useSyncExternalStore(
		subscribeActiveWorkspace,
		getActiveWorkspaceId,
		() => PERSONAL_WORKSPACE,
	);
}
