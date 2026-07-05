// Workspace UI state + the mock publish "jobs", shared by the header, page
// preview and tabs through plain React context (house rule: no store lib).
//
// The chat + page-generation flow used to be simulated here; the chat is now
// real (SSE) and lives in lib/use-project-chat.tsx. Page versions, deployment
// and pixels remain mock for this slice — a real project (no seeded workspace)
// simply starts with an empty version list, so the Page tab shows its empty
// state until real page-version streaming lands. The generation-phase fields
// stay on the context (idle) so the Page tab / toolbar keep compiling.

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type * as React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import {
	type Project,
	type ProjectStatus,
	projectKeys,
	useProjectQuery,
} from "@/features/projects";
import { useTranslation } from "@/lib/i18n";
import type { PageVersion, WorkspaceState, WorkspaceTab } from "../api/dto";
import {
	useWorkspaceStateQuery,
	workspaceKeys,
} from "../api/workspace.queries";
import {
	getWorkspaceSnapshot,
	patchMockDeployment,
	patchMockPixels,
} from "../api/workspace.services";
import {
	CHAT_OPEN_STORAGE_KEY,
	PUBLISH_DURATION_MS,
	PUBLISHED_DOMAIN,
} from "./constants";
import { slugify } from "./helpers";

export type Viewport = "mobile" | "desktop";
export type GenerationPhase = "idle" | "thinking" | "streaming" | "building";

type WorkspaceContextValue = {
	projectId: string;
	project: Project | undefined;
	projectPending: boolean;
	projectMissing: boolean;
	state: WorkspaceState | undefined;
	statePending: boolean;
	versions: PageVersion[];
	tab: WorkspaceTab;
	setTab: (tab: WorkspaceTab) => void;
	chatOpen: boolean;
	toggleChat: () => void;
	/** Direct setter — lets the resizable panel sync a drag-to-collapse back into state. */
	setChatOpenState: (open: boolean) => void;
	viewport: Viewport;
	setViewport: (viewport: Viewport) => void;
	activeVersion: PageVersion | undefined;
	selectVersion: (versionId: string, opts?: { focusPage?: boolean }) => void;
	// Page-generation status placeholders — real page-version streaming is not
	// wired in this slice, so these stay idle (the Page tab reads them).
	generationPhase: GenerationPhase;
	isGenerating: boolean;
	pendingVersionNumber: number;
	publish: () => void;
	unpublish: () => void;
	rollbackTo: (versionId: string) => void;
	updateSlug: (slug: string) => void;
	updatePixels: (patch: {
		metaPixelId?: string | null;
		tiktokPixelId?: string | null;
	}) => void;
	liveUrl: string | null;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function readChatOpen(): boolean {
	try {
		return window.localStorage.getItem(CHAT_OPEN_STORAGE_KEY) !== "closed";
	} catch {
		return true;
	}
}

export function WorkspaceProvider({
	projectId,
	tab,
	children,
}: {
	projectId: string;
	tab: WorkspaceTab;
	children: React.ReactNode;
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { t } = useTranslation();

	const projectQuery = useProjectQuery(projectId);
	const stateQuery = useWorkspaceStateQuery(projectId);

	const projectRef = useRef<Project | undefined>(undefined);
	projectRef.current = projectQuery.data;

	const [chatOpen, setChatOpen] = useState(readChatOpen);
	const [viewport, setViewport] = useState<Viewport>("mobile");
	const [activeVersionId, setActiveVersionId] = useState<string | null>(null);

	// Mock publish job timers — cleared on unmount so navigation kills the
	// simulation (the "stuck publishing" resolver below recovers interrupted
	// publishes).
	const timersRef = useRef<number[]>([]);
	const publishTimerActiveRef = useRef(false);
	useEffect(
		() => () => {
			for (const id of timersRef.current) window.clearTimeout(id);
		},
		[],
	);
	const schedule = useCallback((fn: () => void, ms: number) => {
		timersRef.current.push(window.setTimeout(fn, ms));
	}, []);

	const refreshState = useCallback(() => {
		queryClient.setQueryData(
			workspaceKeys.state(projectId),
			getWorkspaceSnapshot(projectId),
		);
	}, [queryClient, projectId]);

	// Keep the projects cache coherent with deployment transitions so the
	// switcher dot and the dashboard cards tell the same story. Projects are
	// real now, so this patches the query cache directly (optimistic) rather
	// than a mock store.
	const syncProjectStatus = useCallback(
		(patch: { status: ProjectStatus; publishedSlug?: string | null }) => {
			const apply = (p: Project): Project => ({
				...p,
				status: patch.status,
				publishedSlug:
					patch.publishedSlug === undefined
						? p.publishedSlug
						: (patch.publishedSlug ?? undefined),
				updatedAt: new Date().toISOString(),
			});
			queryClient.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
				old ? apply(old) : old,
			);
			queryClient.setQueryData<Project[]>(projectKeys.list(), (old) =>
				old?.map((p) => (p.id === projectId ? apply(p) : p)),
			);
		},
		[projectId, queryClient],
	);

	const setTab = useCallback(
		(next: WorkspaceTab) => {
			void navigate({
				to: "/p/$projectId",
				params: { projectId },
				search: next === "page" ? {} : { tab: next },
			});
		},
		[navigate, projectId],
	);

	const persistChatOpen = useCallback((open: boolean) => {
		try {
			window.localStorage.setItem(
				CHAT_OPEN_STORAGE_KEY,
				open ? "open" : "closed",
			);
		} catch {
			// storage unavailable — state still updates for the session
		}
	}, []);

	const setChatOpenState = useCallback(
		(open: boolean) => {
			persistChatOpen(open);
			setChatOpen(open);
		},
		[persistChatOpen],
	);

	const toggleChat = useCallback(() => {
		setChatOpen((open) => {
			persistChatOpen(!open);
			return !open;
		});
	}, [persistChatOpen]);

	const versions = useMemo(
		() =>
			[...(stateQuery.data?.versions ?? [])].sort(
				(a, b) => a.number - b.number,
			),
		[stateQuery.data?.versions],
	);

	const activeVersion = useMemo(
		() => versions.find((v) => v.id === activeVersionId) ?? versions.at(-1),
		[versions, activeVersionId],
	);

	const selectVersion = useCallback(
		(versionId: string, opts?: { focusPage?: boolean }) => {
			setActiveVersionId(versionId);
			if (opts?.focusPage && tab !== "page") setTab("page");
		},
		[tab, setTab],
	);

	// --- publish simulation --------------------------------------------------

	const runPublish = useCallback(
		(versionId: string, successToast: (url: string) => string) => {
			const snapshot = getWorkspaceSnapshot(projectId);
			if (snapshot.deployment.state === "publishing") return;
			const fallbackSlug = `page-${projectId.replace(/^p_/, "").slice(0, 12) || "wandit"}`;
			const slug =
				snapshot.deployment.slug ??
				slugify(projectRef.current?.name ?? "", fallbackSlug);
			patchMockDeployment(projectId, {
				state: "publishing",
				slug,
				pendingVersionId: versionId,
			});
			syncProjectStatus({ status: "publishing" });
			refreshState();
			publishTimerActiveRef.current = true;
			schedule(() => {
				publishTimerActiveRef.current = false;
				const deployment = patchMockDeployment(projectId, {
					state: "published",
					publishedVersionId: versionId,
					pendingVersionId: null,
					publishedAt: new Date().toISOString(),
				});
				syncProjectStatus({
					status: "published",
					publishedSlug: deployment.slug,
				});
				refreshState();
				toast.success(successToast(`${deployment.slug}${PUBLISHED_DOMAIN}`));
			}, PUBLISH_DURATION_MS);
		},
		[projectId, schedule, refreshState, syncProjectStatus],
	);

	const publish = useCallback(() => {
		if (activeVersion) {
			runPublish(activeVersion.id, (url) =>
				t("workspace.publish.publishedToast", { url }),
			);
		}
	}, [activeVersion, runPublish, t]);

	const rollbackTo = useCallback(
		(versionId: string) => {
			const target = versions.find((v) => v.id === versionId);
			const liveVersion = versions.find(
				(v) => v.id === stateQuery.data?.deployment.publishedVersionId,
			);
			// Only publishing something OLDER than the live version is a rollback;
			// otherwise it reads as a regular publish.
			const isRollback =
				target && liveVersion && target.number < liveVersion.number;
			runPublish(
				versionId,
				isRollback
					? () =>
							t("settings.historyRolledBackToast", {
								n: target?.number ?? 0,
							})
					: (url) => t("workspace.publish.publishedToast", { url }),
			);
		},
		[versions, runPublish, stateQuery.data?.deployment.publishedVersionId, t],
	);

	const unpublish = useCallback(() => {
		patchMockDeployment(projectId, {
			state: "draft",
			publishedVersionId: null,
			pendingVersionId: null,
			publishedAt: null,
		});
		syncProjectStatus({ status: "draft", publishedSlug: null });
		refreshState();
		toast.success(t("workspace.publish.unpublishedToast"));
	}, [projectId, refreshState, syncProjectStatus, t]);

	// Recover deployments stuck in "publishing" (seeded that way, or a publish
	// interrupted by navigation) by completing them shortly after mount.
	useEffect(() => {
		if (stateQuery.data?.deployment.state !== "publishing") return;
		if (publishTimerActiveRef.current) return;
		publishTimerActiveRef.current = true;
		schedule(() => {
			publishTimerActiveRef.current = false;
			const snapshot = getWorkspaceSnapshot(projectId);
			if (snapshot.deployment.state !== "publishing") return;
			const latest = [...snapshot.versions]
				.sort((a, b) => a.number - b.number)
				.at(-1);
			const deployment = patchMockDeployment(projectId, {
				state: "published",
				publishedVersionId:
					snapshot.deployment.pendingVersionId ??
					snapshot.deployment.publishedVersionId ??
					latest?.id ??
					null,
				pendingVersionId: null,
				publishedAt: new Date().toISOString(),
			});
			syncProjectStatus({
				status: "published",
				publishedSlug: deployment.slug,
			});
			refreshState();
			toast.success(
				t("workspace.publish.publishedToast", {
					url: `${deployment.slug}${PUBLISHED_DOMAIN}`,
				}),
			);
		}, PUBLISH_DURATION_MS);
	}, [
		stateQuery.data?.deployment.state,
		projectId,
		schedule,
		refreshState,
		syncProjectStatus,
		t,
	]);

	// --- settings ------------------------------------------------------------

	const updateSlug = useCallback(
		(slug: string) => {
			patchMockDeployment(projectId, { slug });
			refreshState();
		},
		[projectId, refreshState],
	);

	const updatePixels = useCallback(
		(patch: { metaPixelId?: string | null; tiktokPixelId?: string | null }) => {
			patchMockPixels(projectId, patch);
			refreshState();
		},
		[projectId, refreshState],
	);

	const deployment = stateQuery.data?.deployment;
	const liveUrl =
		deployment?.state === "published" && deployment.slug
			? `https://${deployment.slug}${PUBLISHED_DOMAIN}`
			: null;

	const value = useMemo<WorkspaceContextValue>(
		() => ({
			projectId,
			project: projectQuery.data,
			projectPending: projectQuery.isPending,
			projectMissing: projectQuery.isError,
			state: stateQuery.data,
			statePending: stateQuery.isPending,
			versions,
			tab,
			setTab,
			chatOpen,
			toggleChat,
			setChatOpenState,
			viewport,
			setViewport,
			activeVersion,
			selectVersion,
			generationPhase: "idle",
			isGenerating: false,
			pendingVersionNumber: 0,
			publish,
			unpublish,
			rollbackTo,
			updateSlug,
			updatePixels,
			liveUrl,
		}),
		[
			projectId,
			projectQuery.data,
			projectQuery.isPending,
			projectQuery.isError,
			stateQuery.data,
			stateQuery.isPending,
			versions,
			tab,
			setTab,
			chatOpen,
			toggleChat,
			setChatOpenState,
			viewport,
			activeVersion,
			selectVersion,
			publish,
			unpublish,
			rollbackTo,
			updateSlug,
			updatePixels,
			liveUrl,
		],
	);

	return (
		<WorkspaceContext.Provider value={value}>
			{children}
		</WorkspaceContext.Provider>
	);
}

export function useWorkspace(): WorkspaceContextValue {
	const context = useContext(WorkspaceContext);
	if (!context) {
		throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
	}
	return context;
}
