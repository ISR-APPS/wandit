// Workspace UI state + the mock generation/publish "jobs", shared by the
// header, chat pane, canvas and tabs through plain React context (house rule:
// no store lib). The generation flow mirrors what the queue/SSE backend will
// do — stream an assistant reply, then register a new immutable version and
// move the active pointer — so swapping in the real transport later only
// touches this file and the services layer.

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

import { CREDIT_COSTS, useCredits } from "@/features/credits";
import {
	type Project,
	type ProjectStatus,
	projectKeys,
	setMockProjectStatus,
	useProjectQuery,
} from "@/features/projects";
import type {
	ChatMessage,
	PageLang,
	PageVersion,
	WorkspaceState,
	WorkspaceTab,
} from "../api/dto";
import {
	useWorkspaceStateQuery,
	workspaceKeys,
} from "../api/workspace.queries";
import {
	appendMockMessage,
	createMockVersion,
	getWorkspaceSnapshot,
	patchMockDeployment,
	patchMockPixels,
} from "../api/workspace.services";
import {
	BUILD_DURATION_MS,
	CHAT_OPEN_STORAGE_KEY,
	FIRST_GENERATION_REPLIES,
	ITERATION_REPLIES,
	PUBLISH_DURATION_MS,
	PUBLISHED_DOMAIN,
	STREAM_WORD_INTERVAL_MS,
	THINKING_DELAY_MS,
	WORKSPACE_COPY,
} from "./constants";
import { hashString, pickPageKey, slugify, truncatePrompt } from "./helpers";
import { getMockPage } from "./mock-pages";

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
	viewport: Viewport;
	setViewport: (viewport: Viewport) => void;
	activeVersion: PageVersion | undefined;
	selectVersion: (versionId: string, opts?: { focusCanvas?: boolean }) => void;
	generationPhase: GenerationPhase;
	isGenerating: boolean;
	pendingVersionNumber: number;
	streamingMessage: ChatMessage | null;
	/** Returns false when the run was refused (busy or insufficient credits). */
	sendPrompt: (prompt: string) => boolean;
	generationCost: number;
	insufficientOpen: boolean;
	setInsufficientOpen: (open: boolean) => void;
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
	const { canAfford, consume } = useCredits();

	const projectQuery = useProjectQuery(projectId);
	const stateQuery = useWorkspaceStateQuery(projectId);

	const projectRef = useRef<Project | undefined>(undefined);
	projectRef.current = projectQuery.data;

	const [chatOpen, setChatOpen] = useState(readChatOpen);
	const [viewport, setViewport] = useState<Viewport>("mobile");
	const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
	const [insufficientOpen, setInsufficientOpen] = useState(false);
	const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(
		null,
	);
	const [pendingVersionNumber, setPendingVersionNumber] = useState(0);

	const [generationPhase, setGenerationPhaseState] =
		useState<GenerationPhase>("idle");
	const phaseRef = useRef<GenerationPhase>("idle");
	const setPhase = useCallback((phase: GenerationPhase) => {
		phaseRef.current = phase;
		setGenerationPhaseState(phase);
	}, []);

	// Mock job timers — cleared on unmount so navigation kills the simulation
	// (the "stuck publishing" resolver below recovers interrupted publishes).
	const timersRef = useRef<number[]>([]);
	const streamIntervalRef = useRef<number | null>(null);
	const publishTimerActiveRef = useRef(false);
	useEffect(
		() => () => {
			for (const id of timersRef.current) window.clearTimeout(id);
			if (streamIntervalRef.current !== null) {
				window.clearInterval(streamIntervalRef.current);
			}
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

	// Keep the projects store/cache coherent with deployment transitions so
	// the switcher dot and the dashboard cards tell the same story.
	const syncProjectStatus = useCallback(
		(patch: { status: ProjectStatus; publishedSlug?: string | null }) => {
			const updated = setMockProjectStatus(projectId, patch);
			if (!updated) return;
			queryClient.setQueryData(projectKeys.detail(projectId), updated);
			void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
		},
		[projectId, queryClient],
	);

	const generationCost = CREDIT_COSTS.generation;

	const setTab = useCallback(
		(next: WorkspaceTab) => {
			void navigate({
				to: "/p/$projectId",
				params: { projectId },
				search: next === "canvas" ? {} : { tab: next },
			});
		},
		[navigate, projectId],
	);

	const toggleChat = useCallback(() => {
		setChatOpen((open) => {
			try {
				window.localStorage.setItem(
					CHAT_OPEN_STORAGE_KEY,
					open ? "closed" : "open",
				);
			} catch {
				// storage unavailable — state still toggles for the session
			}
			return !open;
		});
	}, []);

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
		(versionId: string, opts?: { focusCanvas?: boolean }) => {
			setActiveVersionId(versionId);
			if (opts?.focusCanvas && tab !== "canvas") setTab("canvas");
		},
		[tab, setTab],
	);

	// --- generation simulation ---------------------------------------------

	const finishGeneration = useCallback(
		(input: {
			replyText: string;
			summary: string;
			versionNumber: number;
			charge: boolean;
			pageKey: string;
			lang: PageLang;
		}) => {
			schedule(() => {
				const created = createMockVersion(projectId, {
					label: input.summary,
					lang: input.lang,
					pageKey: input.pageKey,
				});
				appendMockMessage(projectId, {
					role: "assistant",
					parts: [
						{ type: "text", text: input.replyText },
						{
							type: "generation",
							status: "complete",
							versionId: created.id,
							versionNumber: created.number,
							summary: input.summary,
						},
					],
				});
				if (input.charge) {
					consume(
						generationCost,
						`v${created.number} — ${projectRef.current?.name ?? "Landing page"}`,
					);
				}
				setStreamingMessage(null);
				setPhase("idle");
				setPendingVersionNumber(0);
				setActiveVersionId(created.id);
				refreshState();
			}, BUILD_DURATION_MS);
		},
		[projectId, schedule, consume, setPhase, refreshState],
	);

	const runGeneration = useCallback(
		(
			prompt: string,
			charge: boolean,
			opts?: { skipUserMessage?: boolean },
		): boolean => {
			if (phaseRef.current !== "idle") return false;
			if (charge && !canAfford(generationCost)) {
				setInsufficientOpen(true);
				return false;
			}
			const before = getWorkspaceSnapshot(projectId);
			const isFirst = before.versions.length === 0;
			const versionNumber =
				before.versions.reduce((max, v) => Math.max(max, v.number), 0) + 1;
			if (!opts?.skipUserMessage) {
				appendMockMessage(projectId, {
					role: "user",
					parts: [{ type: "text", text: prompt }],
				});
				refreshState();
			}

			// Resolve the upcoming version's page (and language) up front so the
			// streamed assistant reply matches the thread's language.
			const pageKey = pickPageKey(projectId, versionNumber - 1);
			const lang = getMockPage(pageKey, {
				title: projectRef.current?.name,
			}).lang;
			const firstReplies = FIRST_GENERATION_REPLIES[lang];
			const iterationReplies = ITERATION_REPLIES[lang];
			const replyText = isFirst
				? firstReplies[hashString(prompt) % firstReplies.length](
						projectRef.current?.name ?? "your page",
					)
				: iterationReplies[hashString(prompt) % iterationReplies.length];
			const summary = isFirst ? "Initial generation" : truncatePrompt(prompt);

			setPhase("thinking");
			setPendingVersionNumber(versionNumber);
			setStreamingMessage({
				id: "m_streaming",
				role: "assistant",
				parts: [{ type: "text", text: "" }],
				createdAt: new Date().toISOString(),
			});

			schedule(() => {
				setPhase("streaming");
				const words = replyText.split(" ");
				let count = 0;
				streamIntervalRef.current = window.setInterval(() => {
					count += 1;
					const textSoFar = words.slice(0, count).join(" ");
					setStreamingMessage((prev) =>
						prev
							? { ...prev, parts: [{ type: "text", text: textSoFar }] }
							: prev,
					);
					if (count >= words.length) {
						if (streamIntervalRef.current !== null) {
							window.clearInterval(streamIntervalRef.current);
							streamIntervalRef.current = null;
						}
						setPhase("building");
						setStreamingMessage((prev) =>
							prev
								? {
										...prev,
										parts: [
											{ type: "text", text: replyText },
											{
												type: "generation",
												status: "running",
												versionId: null,
												versionNumber,
												summary,
											},
										],
									}
								: prev,
						);
						finishGeneration({
							replyText,
							summary,
							versionNumber,
							charge,
							pageKey,
							lang,
						});
					}
				}, STREAM_WORD_INTERVAL_MS);
			}, THINKING_DELAY_MS);
			return true;
		},
		[projectId, canAfford, schedule, setPhase, refreshState, finishGeneration],
	);

	const sendPrompt = useCallback(
		(prompt: string) => runGeneration(prompt, true),
		[runGeneration],
	);

	// First visit to a fresh project: the dashboard flow already charged the
	// generation at create time, so the auto-started run doesn't re-charge.
	const autoStartedRef = useRef(false);
	useEffect(() => {
		if (autoStartedRef.current) return;
		const project = projectQuery.data;
		const state = stateQuery.data;
		if (!project || !state) return;
		if (state.messages.length > 0 || state.versions.length > 0) return;
		if (!project.prompt) return;
		autoStartedRef.current = true;
		runGeneration(project.prompt, false);
	}, [projectQuery.data, stateQuery.data, runGeneration]);

	// Resume a generation interrupted by reload/navigation — the mock store
	// then holds a trailing unanswered user message. First generations were
	// already charged at project creation; interrupted iterations never
	// charged (charging happens on completion), so re-running charges once.
	const recoveredRef = useRef(false);
	useEffect(() => {
		if (recoveredRef.current) return;
		const state = stateQuery.data;
		if (!state || phaseRef.current !== "idle") return;
		const last = state.messages.at(-1);
		if (last?.role !== "user") return;
		const text = last.parts
			.map((part) => (part.type === "text" ? part.text : ""))
			.join("")
			.trim();
		if (!text) return;
		recoveredRef.current = true;
		runGeneration(text, state.versions.length > 0, { skipUserMessage: true });
	}, [stateQuery.data, runGeneration]);

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
			runPublish(activeVersion.id, WORKSPACE_COPY.publish.publishedToast);
		}
	}, [activeVersion, runPublish]);

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
							WORKSPACE_COPY.settings.historyRolledBackToast(
								target?.number ?? 0,
							)
					: WORKSPACE_COPY.publish.publishedToast,
			);
		},
		[versions, runPublish, stateQuery.data?.deployment.publishedVersionId],
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
		toast.success(WORKSPACE_COPY.publish.unpublishedToast);
	}, [projectId, refreshState, syncProjectStatus]);

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
				WORKSPACE_COPY.publish.publishedToast(
					`${deployment.slug}${PUBLISHED_DOMAIN}`,
				),
			);
		}, PUBLISH_DURATION_MS);
	}, [
		stateQuery.data?.deployment.state,
		projectId,
		schedule,
		refreshState,
		syncProjectStatus,
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
			viewport,
			setViewport,
			activeVersion,
			selectVersion,
			generationPhase,
			isGenerating: generationPhase !== "idle",
			pendingVersionNumber,
			streamingMessage,
			sendPrompt,
			generationCost,
			insufficientOpen,
			setInsufficientOpen,
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
			viewport,
			activeVersion,
			selectVersion,
			generationPhase,
			pendingVersionNumber,
			streamingMessage,
			sendPrompt,
			insufficientOpen,
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
