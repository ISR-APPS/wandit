/**
 * WorkspaceProvider — owns which workspace the app is acting in.
 *
 * Responsibilities (teams-workspaces.md §9):
 * - hydrate the persisted per-user choice from localStorage, validated
 *   against the memberships returned by GET /api/v1/workspaces (an org the
 *   user left silently falls back to personal);
 * - keep the own personal workspace on the scope id `personal`, and give the
 *   role flags of a team, an own personal, or another user's personal workspace
 *   (workspaces-sharing.md 3.1);
 * - write every change into the framework-free workspace-scope store that
 *   the axios interceptor and the AI-chat transport read;
 * - set Better Auth's active organization for UI coherence only — the
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
import { usePublicSettingsQuery } from "@/features/settings";
import { setActiveWorkspace } from "@/features/workspaces/api/workspace-members.services";
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
	/**
	 * Summary of the active workspace. In personal scope it is the own personal
	 * workspace. Null while the list loads, or when an older API leaves it out.
	 */
	activeWorkspace: WorkspaceSummary | null;
	/** Every workspace of the user, the own personal one first (may be stale while loading). */
	workspaces: WorkspaceSummary[];
	/** True in the caller's own personal workspace (scope id `personal`, no header). */
	isPersonal: boolean;
	/** True in another user's personal workspace. That user's pool pays, and only that user manages the money. */
	isSharedPersonal: boolean;
	/** owner/admin in the active workspace; true in personal (self-managed). */
	actorCanManageWorkspace: boolean;
	/** owner of a team workspace; true in personal — billing is owner-only. */
	actorCanManageBilling: boolean;
	/** owner/admin of a team workspace; true in personal. Member limits cap the owner's money. */
	actorCanManageLimits: boolean;
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

/**
 * Sets the persisted workspace of one user into the scope store before the
 * provider mounts. The `/_auth` route calls it in `beforeLoad`.
 */
export function hydrateWorkspaceScope(userId: string): void {
	// beforeLoad runs on every navigation, so a stale or throwing storage
	// read must not overwrite a `switchWorkspace` choice.
	if (getActiveWorkspaceId() !== PERSONAL_WORKSPACE) {
		return;
	}
	setActiveWorkspaceId(readPersisted(userId));
}

/** Mounted once in the root route. It drops a stored workspace when the user is no longer a member. */
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

		// The own personal workspace uses the scope id `personal`, never its org id.
		const stillMember = workspaces.some(
			(entry) => entry.id === persisted && !entry.isOwnPersonal,
		);

		if (!stillMember) {
			persist(userId, PERSONAL_WORKSPACE);
			setActiveWorkspaceId(PERSONAL_WORKSPACE);
		}
	}, [userId, workspacesQuery.data, workspaces]);

	const ownPersonalId = workspaces.find((entry) => entry.isOwnPersonal)?.id;

	const switchWorkspace = useCallback(
		(requested: ActiveWorkspaceId) => {
			// A join link can answer the own personal org id. That workspace must
			// send no header, so it maps to the scope id `personal`.
			const target =
				requested === ownPersonalId ? PERSONAL_WORKSPACE : requested;

			if (target === getActiveWorkspaceId()) {
				return;
			}

			setActiveWorkspaceId(target);
			persist(userId, target);

			// UI coherence only — the server scopes by the header, never by the
			// session's active organization (§2).
			void setActiveWorkspace(
				target === PERSONAL_WORKSPACE ? null : target,
			).catch((error: unknown) => {
				// The header store already switched the scope, so the app keeps working.
				console.warn(
					"Setting the Better Auth active organization failed",
					error,
				);
			});

			// Scoped keys embed the workspace id, so the old workspace's data can
			// never be served under the new one — but drop it anyway to free
			// memory and force fresh fetches for the new scope.
			void queryClient.invalidateQueries();
		},
		[ownPersonalId, queryClient, userId],
	);

	const activeWorkspace = useMemo(
		() =>
			workspaces.find((entry) =>
				activeWorkspaceId === PERSONAL_WORKSPACE
					? entry.isOwnPersonal
					: entry.id === activeWorkspaceId,
			) ?? null,
		[activeWorkspaceId, workspaces],
	);

	const value = useMemo<WorkspaceContextValue>(() => {
		const roles = activeWorkspace?.roles ?? [];
		const isPersonal = activeWorkspaceId === PERSONAL_WORKSPACE;
		const isSharedPersonal =
			activeWorkspace?.kind === "personal" && !activeWorkspace.isOwnPersonal;
		const isManager = roles.includes("owner") || roles.includes("admin");

		return {
			activeWorkspaceId,
			activeWorkspace,
			workspaces,
			isPersonal,
			isSharedPersonal,
			actorCanManageWorkspace: isPersonal || isManager,
			// Owner-only billing (Zack's decision) — admins never see money UI.
			// Another user's personal pool is that user's money, so nobody else manages it.
			actorCanManageBilling:
				isPersonal || (!isSharedPersonal && roles.includes("owner")),
			actorCanManageLimits: isPersonal || (!isSharedPersonal && isManager),
			switchWorkspace,
		};
	}, [activeWorkspaceId, activeWorkspace, workspaces, switchWorkspace]);

	return (
		<WorkspaceReactContext.Provider value={value}>
			{children}
		</WorkspaceReactContext.Provider>
	);
}

/** Active workspace and the caller's role flags. Throws outside `WorkspaceProvider`. */
export function useWorkspace(): WorkspaceContextValue {
	const value = useContext(WorkspaceReactContext);

	if (!value) {
		throw new Error("useWorkspace must be used inside WorkspaceProvider");
	}

	return value;
}

/**
 * Which collaboration entry points show (workspaces-sharing.md 3.4 and 6).
 * The switcher, the invitations banner, the sidebar, the People page, and the limits page read it.
 * In the own personal workspace, the flags stay false while the public settings load.
 */
export function useCollaborationGates(): {
	/** True while the public settings load. A page waits for it before it treats a false flag as final. */
	isPending: boolean;
	/** The switcher and the invitations banner. */
	showsCollaboration: boolean;
	/** The People links and the People page. */
	showsPeople: boolean;
	/** The member limits links and the limits page. */
	showsLimits: boolean;
} {
	const settingsQuery = usePublicSettingsQuery();
	const { isPersonal, isSharedPersonal, workspaces } = useWorkspace();
	const organizationsEnabled =
		settingsQuery.data?.organizationsEnabled ?? false;
	// Every user has an own personal workspace, so only other memberships keep
	// the switcher on while the toggle is off.
	const hasOtherMemberships = workspaces.some((entry) => !entry.isOwnPersonal);
	// While the toggle is off, the own personal workspace shows no People and no limits.
	const showsPeople = organizationsEnabled || !isPersonal;

	return {
		isPending: settingsQuery.isPending,
		showsCollaboration: organizationsEnabled || hasOtherMemberships,
		showsPeople,
		// Limits cap the owner's money, so another user's personal workspace hides them.
		showsLimits: showsPeople && !isSharedPersonal,
	};
}

/** Reactive active-workspace id usable outside the provider (e.g. keys). */
export function useActiveWorkspaceId(): ActiveWorkspaceId {
	return useSyncExternalStore(
		subscribeActiveWorkspace,
		getActiveWorkspaceId,
		() => PERSONAL_WORKSPACE,
	);
}
