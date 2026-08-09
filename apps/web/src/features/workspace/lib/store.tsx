// Workspace UI state shared by the header, page preview and tabs through
// plain React context (house rule: no store lib). Publishing is REAL here:
// deployments, versions and pixels all come from the API; this provider only
// composes their queries/mutations and holds pure UI state (tab, viewport,
// chat pane, selected version).
//
// ── Where this sits in the AI-chat flow ────────────────────────────────────
// pages/workspace-page.tsx mounts <WorkspaceProvider> around the whole
// workspace screen. From there:
//   • components/chat/chat-pane.tsx reads `chatOpen` / `toggleChat` /
//     `setChatOpenState` to show, hide, and drag-collapse the chat panel
//     (the open/closed choice is persisted in localStorage across reloads).
//   • components/chat/generation-card.tsx reads `activeVersion` /
//     `selectVersion` so clicking a finished generation card focuses that
//     page version in the Page tab.
//   • The actual chat messages + SSE streaming live in use-project-chat.tsx;
//     this file deliberately knows nothing about them.
// NOTE: despite the "store.tsx" filename this is NOT a Zustand/Redux store —
// it is a plain React Context provider (house rule: no state library).

import { useNavigate } from "@tanstack/react-router";
import type {
	PageOverview,
	PageVersionListItem,
	PageVersionSummary,
} from "@wandit/contracts";
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
	useProjectQuery,
	useUpdateProjectPixels,
} from "@/features/projects";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import type { DeploymentCurrent } from "../api/deployments.dto";
import {
	usePublishDeployment,
	useRollbackDeployment,
	useUnpublishDeployment,
} from "../api/deployments.mutations";
import { useDeploymentCurrentQuery } from "../api/deployments.queries";
import type { WorkspaceTab } from "../api/dto";
import {
	usePageOverviewQuery,
	usePageVersionsQuery,
	useRestorePageVersion,
} from "../api/pages.queries";
import { CHAT_OPEN_STORAGE_KEY } from "./constants";
import {
	buildPublishedSlugRenameBody,
	buildPublishPageBody,
	deriveGenerationState,
	type GenerationPhase,
	isHistoricalPreview,
	type PreviewVersion,
	resolvePreviewVersion,
} from "./page-version-state";
import { getPublishErrorMessage } from "./publish-error";

export type Viewport = "mobile" | "desktop";
export type { GenerationPhase, PreviewVersion } from "./page-version-state";

type WorkspaceContextValue = {
	projectId: string;
	project: Project | undefined;
	projectPending: boolean;
	projectMissing: boolean;
	/** Server truth about publishing — undefined only while first loading. */
	deployment: DeploymentCurrent | undefined;
	deploymentPending: boolean;
	versions: PageVersionListItem[];
	versionsPending: boolean;
	pageOverview: PageOverview | undefined;
	pageOverviewPending: boolean;
	tab: WorkspaceTab;
	setTab: (tab: WorkspaceTab) => void;
	chatOpen: boolean;
	toggleChat: () => void;
	/** Direct setter — lets the resizable panel sync a drag-to-collapse back into state. */
	setChatOpenState: (open: boolean) => void;
	viewport: Viewport;
	setViewport: (viewport: Viewport) => void;
	/** Resolved canvas version. Kept as an alias for older consumers. */
	activeVersion: PreviewVersion | undefined;
	serverActiveVersion: PageVersionSummary | null;
	previewVersion: PreviewVersion | null;
	isPreviewingHistorical: boolean;
	selectVersion: (
		version: PreviewVersion,
		opts?: { focusPage?: boolean },
	) => void;
	backToLatest: () => void;
	restorePreviewVersion: () => void;
	restorePending: boolean;
	generationPhase: GenerationPhase;
	isGenerating: boolean;
	pendingVersionNumber: number;
	/** Opens the version-aware confirmation, defaulting to the resolved canvas version. */
	publish: (options?: { slug?: string; version?: PreviewVersion }) => void;
	publishCandidateVersion: PreviewVersion | null;
	confirmPublish: () => void;
	cancelPublish: () => void;
	publishPending: boolean;
	unpublish: () => void;
	rollbackTo: (input: {
		deploymentId: string;
		versionNumber: number | null;
	}) => void;
	/**
	 * Live project → republish under the new slug. Draft project → remember
	 * the choice locally and send it with the first publish.
	 */
	updateSlug: (slug: string) => void;
	/** Pre-publish slug choice not yet on the server (null once published). */
	draftSlug: string | null;
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
	const navigate = useNavigate();
	const { t } = useTranslation();

	const projectQuery = useProjectQuery(projectId);
	const deploymentQuery = useDeploymentCurrentQuery(projectId);
	const overviewQuery = usePageOverviewQuery(projectId);
	const versionsQuery = usePageVersionsQuery(projectId);

	const publishMutation = usePublishDeployment(projectId);
	const unpublishMutation = useUnpublishDeployment(projectId);
	const rollbackMutation = useRollbackDeployment(projectId);
	const restoreMutation = useRestorePageVersion(projectId);
	const pixelsMutation = useUpdateProjectPixels();

	const [chatOpen, setChatOpen] = useState(readChatOpen);
	const [viewport, setViewport] = useState<Viewport>("mobile");
	const [manualVersion, setManualVersion] = useState<PreviewVersion | null>(
		null,
	);
	const [publishCandidate, setPublishCandidate] = useState<{
		version: PreviewVersion;
		slug?: string;
	} | null>(null);
	// A slug picked before the first publish. The server keeps the live slug
	// once published, so this only matters while the project is a draft.
	const [draftSlug, setDraftSlug] = useState<string | null>(null);

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
		const nextOpen = !chatOpen;
		persistChatOpen(nextOpen);
		setChatOpen(nextOpen);
	}, [chatOpen, persistChatOpen]);

	const versions = useMemo(
		() => (versionsQuery.data ?? []).toSorted((a, b) => a.number - b.number),
		[versionsQuery.data],
	);

	const pageOverview = overviewQuery.data;
	const serverActiveVersion = pageOverview?.activeVersion ?? null;
	const previewVersion = resolvePreviewVersion(
		manualVersion,
		serverActiveVersion,
		versionsQuery.data,
	);
	const isPreviewingHistorical = isHistoricalPreview(
		previewVersion,
		serverActiveVersion,
	);

	// Selecting what is currently active means "follow latest", not "pin this
	// id". The effect covers the race where selection happens before overview
	// finishes loading; clearing the pin is what lets a later build auto-advance.
	useEffect(() => {
		if (manualVersion?.id !== serverActiveVersion?.id) return;
		setManualVersion(null);
	}, [manualVersion?.id, serverActiveVersion?.id]);

	// Overview polling observes a completed build before the independently
	// cached history list does. Refresh it once per unseen active id so the
	// switcher catches up without delaying the canvas itself.
	const refreshedVersionIdRef = useRef<string | null>(null);
	useEffect(() => {
		const activeId = serverActiveVersion?.id;
		if (!activeId || versions.some((version) => version.id === activeId))
			return;
		if (refreshedVersionIdRef.current === activeId) return;
		refreshedVersionIdRef.current = activeId;
		void versionsQuery.refetch();
	}, [serverActiveVersion?.id, versions, versionsQuery.refetch]);

	const selectVersion = useCallback(
		(version: PreviewVersion, opts?: { focusPage?: boolean }) => {
			setManualVersion(version.id === serverActiveVersion?.id ? null : version);
			if (opts?.focusPage && tab !== "page") setTab("page");
		},
		[serverActiveVersion?.id, tab, setTab],
	);

	const backToLatest = useCallback(() => setManualVersion(null), []);

	const restorePreviewVersion = useCallback(() => {
		if (
			!previewVersion ||
			!serverActiveVersion ||
			previewVersion.id === serverActiveVersion.id
		) {
			return;
		}

		restoreMutation.mutate(
			{
				versionId: previewVersion.id,
				expectedActiveVersionId: serverActiveVersion.id,
			},
			{
				onSuccess: ({ version }) => {
					setManualVersion(null);
					toast.success(
						t("workspace.page.restoreSucceeded", { n: version.number }),
					);
				},
				onError: (error) => toast.error(getApiErrorMessage(error)),
			},
		);
	}, [previewVersion, restoreMutation, serverActiveVersion, t]);

	const { generationPhase, isGenerating, pendingVersionNumber } =
		deriveGenerationState(pageOverview);

	// --- publishing ------------------------------------------------------------

	const publishErrorToast = useCallback(
		(error: unknown) => {
			toast.error(
				getPublishErrorMessage(
					error,
					t("workspace.publish.earlyAccessRequired"),
				),
			);
		},
		[t],
	);

	const publish = useCallback(
		(options?: { slug?: string; version?: PreviewVersion }) => {
			const version = options?.version ?? previewVersion;
			if (!version || publishMutation.isPending) return;
			const slug = options?.slug ?? draftSlug;
			setPublishCandidate({
				version,
				...(slug ? { slug } : {}),
			});
		},
		[draftSlug, previewVersion, publishMutation.isPending],
	);

	const cancelPublish = useCallback(() => setPublishCandidate(null), []);

	const confirmPublish = useCallback(() => {
		if (!publishCandidate) return;
		const body = buildPublishPageBody(
			publishCandidate.version,
			publishCandidate.slug,
		);
		setPublishCandidate(null);
		publishMutation.mutate(body, {
			onSuccess: ({ current }) => {
				setDraftSlug(null);
				if (current.liveUrl) {
					toast.success(
						t("workspace.publish.publishedToast", {
							url: current.liveUrl.replace(/^https:\/\//, ""),
						}),
					);
				}
			},
			onError: publishErrorToast,
		});
	}, [publishCandidate, publishMutation, publishErrorToast, t]);

	const unpublish = useCallback(() => {
		unpublishMutation.mutate(undefined, {
			onSuccess: () => {
				toast.success(t("workspace.publish.unpublishedToast"));
			},
			onError: publishErrorToast,
		});
	}, [unpublishMutation, publishErrorToast, t]);

	const rollbackTo = useCallback(
		(input: { deploymentId: string; versionNumber: number | null }) => {
			rollbackMutation.mutate(
				{ deploymentId: input.deploymentId },
				{
					onSuccess: ({ current }) => {
						toast.success(
							input.versionNumber !== null
								? t("settings.historyRolledBackToast", {
										n: input.versionNumber,
									})
								: t("workspace.publish.publishedToast", {
										url: (current.liveUrl ?? "").replace(/^https:\/\//, ""),
									}),
						);
					},
					onError: publishErrorToast,
				},
			);
		},
		[rollbackMutation, publishErrorToast, t],
	);

	const deployment = deploymentQuery.data;

	const updateSlug = useCallback(
		(slug: string) => {
			if (deployment?.uiState === "published") {
				// Slug lives on the deployment, so a rename is a republish. Pin the
				// currently live immutable version: active may intentionally be newer.
				publishMutation.mutate(
					buildPublishedSlugRenameBody(slug, deployment.publishedVersionId),
					{
						onSuccess: ({ current }) => {
							if (current.liveUrl) {
								toast.success(
									t("workspace.publish.publishedToast", {
										url: current.liveUrl.replace(/^https:\/\//, ""),
									}),
								);
							}
						},
						onError: publishErrorToast,
					},
				);
				return;
			}

			setDraftSlug(slug);
		},
		[
			deployment?.publishedVersionId,
			deployment?.uiState,
			publishMutation,
			publishErrorToast,
			t,
		],
	);

	// --- settings ------------------------------------------------------------

	const updatePixels = useCallback(
		(patch: { metaPixelId?: string | null; tiktokPixelId?: string | null }) => {
			const current = projectQuery.data;
			pixelsMutation.mutate(
				{
					id: projectId,
					metaPixelId:
						patch.metaPixelId === undefined
							? (current?.metaPixelId ?? null)
							: patch.metaPixelId,
					tiktokPixelId:
						patch.tiktokPixelId === undefined
							? (current?.tiktokPixelId ?? null)
							: patch.tiktokPixelId,
				},
				{
					onSuccess: () => {
						toast.success(t("settings.pixelsSaved"));
					},
					onError: (error) => {
						toast.error(getApiErrorMessage(error));
					},
				},
			);
		},
		[pixelsMutation, projectId, projectQuery.data, t],
	);

	const liveUrl = deployment?.liveUrl ?? null;

	const publishPending =
		publishMutation.isPending ||
		unpublishMutation.isPending ||
		rollbackMutation.isPending;

	const value = useMemo<WorkspaceContextValue>(
		() => ({
			projectId,
			project: projectQuery.data,
			projectPending: projectQuery.isPending,
			projectMissing: projectQuery.isError,
			deployment,
			deploymentPending: deploymentQuery.isPending,
			versions,
			versionsPending: versionsQuery.isPending,
			pageOverview,
			pageOverviewPending: overviewQuery.isPending,
			tab,
			setTab,
			chatOpen,
			toggleChat,
			setChatOpenState,
			viewport,
			setViewport,
			activeVersion: previewVersion ?? undefined,
			serverActiveVersion,
			previewVersion,
			isPreviewingHistorical,
			selectVersion,
			backToLatest,
			restorePreviewVersion,
			restorePending: restoreMutation.isPending,
			generationPhase,
			isGenerating,
			pendingVersionNumber,
			publish,
			publishCandidateVersion: publishCandidate?.version ?? null,
			confirmPublish,
			cancelPublish,
			publishPending,
			unpublish,
			rollbackTo,
			updateSlug,
			draftSlug,
			updatePixels,
			liveUrl,
		}),
		[
			projectId,
			projectQuery.data,
			projectQuery.isPending,
			projectQuery.isError,
			deployment,
			deploymentQuery.isPending,
			versions,
			versionsQuery.isPending,
			pageOverview,
			overviewQuery.isPending,
			tab,
			setTab,
			chatOpen,
			toggleChat,
			setChatOpenState,
			viewport,
			serverActiveVersion,
			previewVersion,
			isPreviewingHistorical,
			selectVersion,
			backToLatest,
			restorePreviewVersion,
			restoreMutation.isPending,
			generationPhase,
			isGenerating,
			pendingVersionNumber,
			publish,
			publishCandidate?.version,
			confirmPublish,
			cancelPublish,
			publishPending,
			unpublish,
			rollbackTo,
			updateSlug,
			draftSlug,
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
