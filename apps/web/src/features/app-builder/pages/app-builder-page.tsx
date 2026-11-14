/**
 * The `/app/$projectId` workspace: the chat column on the desk and the main
 * card, each with its half of the top bar above it. On desktop a resizable
 * split moves the work pane controls with the main card. On phones the open
 * chat covers it.
 * Rendered by routes/_auth/app.$projectId.tsx after its loader filled the
 * project query. The URL search params hold the view state and the open
 * conversation. The page reads the conversation list, picks the open
 * conversation, and switches it in place: the preview stays mounted.
 * The Backend group of the More view shows only behind useCloudTabEnabled and for an editor,
 * and never for a desktop project. The Appetize device of a mobile project shows only behind
 * useDevicePreviewEnabled. A desktop project shows its preview in a Windows window inside WebPreview.
 * The details panel of a reply covers the main card (a sheet on a phone).
 * Raw agent thinking never shows in production; local dev has a switch.
 * The page owns the elements picked in the web preview: the composer shows
 * them as chips. It also owns the model pick of the project, which every
 * send carries, and reads the chat cost for the line under the composer.
 * Every edit control reads `project.access.role`, never the workspace header
 * role: a project viewer gets a read-only builder. The payer state of the
 * composer comes from the turn estimate (workspaces-sharing.md 4 and 6).
 * It reads the GitHub status and owns the pull: the chat shows an Update
 * strip, and a pull reloads the preview. It sends the scan and fix turns of
 * the Security panel, and the scan card of the chat opens that panel.
 */

import {
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PREVIEW_TARGETS_MAX, type PreviewTarget } from "@wandit/contracts";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	type ResizablePanelHandle,
} from "@wandit/ui/components/resizable";
import { Sheet, SheetContent, SheetTitle } from "@wandit/ui/components/sheet";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { hasProjectRole } from "@/features/project-sharing";
import { useWorkspace } from "@/features/workspaces";
import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { useCreateProjectChat } from "../api/app-builder.mutations";
import {
	appBuilderKeys,
	appProjectQuery,
	chatCostQuery,
	projectChatsQuery,
	turnEstimateQuery,
} from "../api/app-builder.queries";
import { cloudBackendQuery } from "../api/cloud.queries";
import { usePullFromGithub } from "../api/github.mutations";
import { projectGithubStatusQuery } from "../api/github.queries";
import { appPublishQuery } from "../api/publish.queries";
import { ActivityPanel } from "../components/chat/activity-panel";
import { ChatPane } from "../components/chat/chat-pane";
import { CodeView } from "../components/code/code-view";
import { MoreView } from "../components/more/more-view";
import { PhonePreview } from "../components/preview/phone-preview";
import { WebPreview } from "../components/preview/web-preview";
import { AppNotFound } from "../components/shell/app-not-found";
import { ProjectBar, WorkBar } from "../components/shell/top-bar";
import type { BootContext } from "../lib/boot-state";
import {
	CHAT_PANEL_DEFAULT_WIDTH,
	CHAT_PANEL_MIN_WIDTH,
} from "../lib/constants";
import {
	openChatOf,
	readChatLayout,
	readChatOpen,
	readDeveloperView,
	resolvePanel,
	writeChatLayout,
	writeChatOpen,
	writeDeveloperView,
} from "../lib/helpers";
import type { AppBuilderSearch } from "../lib/schemas";
import { useBuilderModelPick } from "../lib/use-builder-model-pick";
import { useBuilderThread } from "../lib/use-builder-thread";
import { useCloudTabEnabled } from "../lib/use-cloud-tab-enabled";
import { useDevicePreviewEnabled } from "../lib/use-device-preview-enabled";

// The desk: warm sand with a soft spark glow over the project controls. The
// glow sits at the start side, so it moves to the right in RTL. In dark mode
// the glow is ember on the warm near-black page color. The variables keep one
// gradient for every theme and direction.
const DESK_CLASS =
	"[--desk-bottom:#f3eee6] [--desk-glow-x:8%] [--desk-glow:rgb(250_171_63/0.2)] [--desk-top:#f8f2e8] bg-[radial-gradient(900px_380px_at_var(--desk-glow-x)_-14%,var(--desk-glow),transparent_70%),linear-gradient(180deg,var(--desk-top),var(--desk-bottom))] rtl:[--desk-glow-x:92%] dark:[--desk-bottom:var(--background)] dark:[--desk-glow:rgb(209_96_34/0.14)] dark:[--desk-top:var(--background)]";

// The chat lies on the desk with no card, so the stage is the one lifted
// surface: a white sheet with a navy hairline and a soft navy shadow. In dark
// mode it is one step lighter than the desk.
const STAGE_CARD_CLASS =
	"rounded-[1.5rem] border border-night/[0.08] bg-white shadow-[0_1px_0_rgb(11_16_51/0.04),0_18px_44px_-26px_rgb(11_16_51/0.35)] dark:border-white/[0.07] dark:bg-sand dark:shadow-none";

export type AppBuilderPageProps = {
	projectId: string;
	/** Validated `?view=&panel=&device=&viewport=&file=&chat=` of the URL. */
	search: AppBuilderSearch;
};

/** The workspace page. Owns the chat open state, the details panel state, and the chat view of local dev. */
export default function AppBuilderPage({
	projectId,
	search,
}: AppBuilderPageProps) {
	const { t } = useTranslation();
	const navigate = useNavigate({ from: "/app/$projectId" });
	// The route loader filled the project query, so it does not suspend on first paint.
	const { data: project } = useSuspenseQuery(appProjectQuery(projectId));
	// The hold of the next turn. A failed read hides the estimate; it never blocks a send.
	const { data: nextTurnEstimate } = useQuery(turnEstimateQuery(projectId));
	// The not-found screen needs no model list. A user outside the rollout
	// sees that screen, and the list route answers that user 403.
	const modelPick = useBuilderModelPick(projectId, project !== null);
	const queryClient = useQueryClient();
	// The conversations of the project. The not-found screen needs none.
	const { data: chatList, error: chatListError } = useQuery({
		...projectChatsQuery(projectId),
		enabled: project !== null,
	});
	const chats = chatList?.chats ?? [];
	const openChat = openChatOf(chats, search.chat);
	const openChatId = openChat?.id;
	const thread = useBuilderThread(projectId, openChat, modelPick.modelId);
	const createChat = useCreateProjectChat(projectId);
	// A link without `?chat=` opens the conversation with the newest activity.
	// The URL then gets its id. Without it, a list refresh with a new order
	// would switch the conversation, and a reload could open another one.
	const hasChatParam = search.chat !== undefined;
	useEffect(() => {
		if (openChatId === undefined || hasChatParam) return;
		void navigate({
			search: (previous) => ({ ...previous, chat: openChatId }),
			replace: true,
		});
	}, [openChatId, hasChatParam, navigate]);
	// The busy conversation can be newer than the loaded list, for example
	// one that a teammate started. The list then loads again and holds it.
	const isBusyChatUnknown =
		chatList !== undefined &&
		thread.busyChatId !== null &&
		!chatList.chats.some((chat) => chat.id === thread.busyChatId);
	useEffect(() => {
		if (!isBusyChatUnknown) return;
		void queryClient.invalidateQueries({
			queryKey: appBuilderKeys.chats(projectId),
		});
	}, [isBusyChatUnknown, queryClient, projectId]);
	// The full cost of the chat. A failed read hides the line; it never blocks a send.
	const { data: chatCost } = useQuery(chatCostQuery(projectId, openChatId));
	// Product rule: raw thinking never shows in production, also not for staff.
	// Local dev can switch to the developer view to see every step.
	const [isDeveloperView, setIsDeveloperView] = useState(
		() => import.meta.env.DEV && readDeveloperView(),
	);
	// Id of the reply whose details panel opened last, or null before the first open.
	// A close keeps the id, so the phone sheet still shows the reply while it slides out.
	const [activityMessageId, setActivityMessageId] = useState<string | null>(
		null,
	);
	const [isActivityOpen, setIsActivityOpen] = useState(false);
	// A reply that leaves the thread (a project or conversation switch, a canceled turn) closes the panel.
	const activityMessage =
		activityMessageId === null
			? undefined
			: thread.messages.find((message) => message.id === activityMessageId);
	// The project menu switches the project in place. A missing reply must not open again on the way back.
	if (isActivityOpen && activityMessage === undefined) setIsActivityOpen(false);
	// The preview boot screen shows the database step on every view, so this read is on for every view.
	// The query polls while Supabase creates or wakes the project.
	// A desktop app keeps its data in a local SQLite file and has no Supabase backend.
	const isDesktopProject = project?.kind === "desktop";
	const { data: backend } = useQuery(
		cloudBackendQuery(projectId, !isDesktopProject),
	);
	// The live app of a web project: the host link in the preview bar and the
	// Live mark of the versions read it. A mobile or desktop app has no publish status.
	const { data: publishStatus } = useQuery({
		...appPublishQuery(projectId),
		enabled: project?.kind === "web",
	});
	const live = publishStatus?.live ?? null;
	// Undefined until a status arrives, so the preview bar never says "Not published yet" for a live app.
	const previewLiveUrl =
		publishStatus === undefined ? undefined : (live?.url ?? null);
	// No backend, so no Backend group: a desktop project never shows the Cloud panels.
	const isCloudTabEnabled =
		useCloudTabEnabled(project?.engine) && !isDesktopProject;
	const isDevicePreviewEnabled = useDevicePreviewEnabled();
	const { activeWorkspace } = useWorkspace();
	const [chatOpen, setChatOpen] = useState(readChatOpen);
	// A new key makes the panel mint a new token; the reload button of the preview bar bumps it.
	const [reloadKey, setReloadKey] = useState(0);
	// The GitHub link of the project. The chat strip offers Update while GitHub has commits to pull.
	const { data: githubStatus } = useQuery({
		...projectGithubStatusQuery(projectId),
		enabled: project !== null,
	});
	// The pull writes the merged tree into the sandbox worktree, like a
	// restore. The reload mints a new token and shows it.
	const githubPull = usePullFromGithub(projectId, () =>
		setReloadKey((key) => key + 1),
	);
	// The elements picked in the preview for the next turn, with their project.
	// A project switch in place keeps this page, so picks of another project read as none.
	const [picked, setPicked] = useState<{
		projectId: string;
		targets: PreviewTarget[];
	}>({ projectId, targets: [] });
	const targets = picked.projectId === projectId ? picked.targets : [];
	const [isSelecting, setIsSelecting] = useState(false);
	// A turn changes the app under the picks, so the select mode stops when a send starts.
	if (thread.isSending && isSelecting) setIsSelecting(false);
	// LIMIT: the first paint on a phone shows the desktop split for one frame. Upgrade: read the breakpoint in the route loader.
	const isMobile = useIsMobile();
	const chatPanelRef = useRef<ResizablePanelHandle>(null);

	// The expand button and the chat header button drive the panel; a drag reports back through onLayoutChanged.
	// The group mounts again when the window returns from a phone width, so the effect also runs on isMobile.
	useEffect(() => {
		// On a phone there is no panel to drive.
		if (isMobile) return;
		const panel = chatPanelRef.current;
		if (!panel) return;
		if (chatOpen && panel.isCollapsed()) {
			panel.expand();
			// A drag to zero records no width to expand to, so the stored layout sets it.
			const stored = readChatLayout();
			panel.resize(
				stored?.chat === undefined
					? CHAT_PANEL_DEFAULT_WIDTH
					: `${stored.chat}%`,
			);
		}
		if (!chatOpen && !panel.isCollapsed()) panel.collapse();
	}, [chatOpen, isMobile]);

	if (!project) return <AppNotFound />;

	// Product rule: a project viewer gets a read-only builder (workspaces-sharing.md 6).
	const canEdit = hasProjectRole(project.access, "editor");
	// The Cloud panels and the secrets need the editor role, so a viewer gets no Backend group.
	const showBackendGroup = isCloudTabEnabled && canEdit;
	// The payer state of the composer. A missing estimate fails open: the API's
	// 402 stays the authority. An older API sends no payer: undefined then.
	const payerOutOfCredits =
		nextTurnEstimate === undefined
			? false
			: nextTurnEstimate.payer?.outOfCredits;
	// The project's workspace pool pays for its turns (workspaces-sharing.md 4).
	const isPayerActiveWorkspace =
		project.access === undefined ||
		activeWorkspace?.id === project.access.workspace.id;
	// Product rule: one conversation at a time uses the project. The fix
	// buttons of the preview and the work bar send a turn, so they lock too.
	const isOtherChatBusy =
		thread.busyChatId !== null && thread.busyChatId !== openChatId;
	const canStartTurn =
		canEdit && thread.isReady && !thread.isSending && !isOtherChatBusy;

	const bootContext: BootContext = {
		isTurnRunning: thread.isTurnRunning,
		turnPhase: thread.phase,
		lastTurnFailed: thread.lastTurnFailed,
		isFirstTurn: thread.isFirstTurn,
		backend,
		hasCodeChanges: project.hasCodeChanges,
		isPlanning: thread.latestTurnMode === "plan",
	};

	const view = search.view ?? "preview";
	const panel = resolvePanel(project.kind, search.panel, showBackendGroup);
	// A mobile project opens on the web build of the app; a device streams only on request.
	const mobileTarget = search.device ?? "web";
	const viewport = search.viewport ?? "desktop";

	// Views and panels make a history entry. Frame toggles and file picks replace it.
	function setSearch(patch: Partial<AppBuilderSearch>, replace: boolean) {
		void navigate({
			search: (previous) => ({ ...previous, ...patch }),
			replace,
		});
	}

	// A conversation switch makes a history entry, so Back opens the conversation before.
	function openChatById(chatId: string) {
		setSearch({ chat: chatId }, false);
	}

	// Product rule: a new conversation needs the editor role, so a viewer gets no create action.
	const createAndOpenChat = canEdit
		? () =>
				createChat.mutate(undefined, {
					onSuccess: ({ chat }) => openChatById(chat.id),
				})
		: undefined;

	// Every open or close path (top bar, chat header, drag to zero) goes through here, so the choice persists.
	function setChatOpenAndStore(open: boolean) {
		setChatOpen(open);
		writeChatOpen(open);
	}

	function pickTarget(target: PreviewTarget) {
		// A list item repeats one JSX element, so the text tells two picks of it apart.
		const isPicked = targets.some(
			(current) => current.src === target.src && current.label === target.label,
		);
		if (isPicked) return;
		// The turn route takes at most PREVIEW_TARGETS_MAX targets.
		if (targets.length >= PREVIEW_TARGETS_MAX) {
			toast(
				t("appBuilder.preview.selectLimit", { count: PREVIEW_TARGETS_MAX }),
			);
			return;
		}
		setPicked({ projectId, targets: [...targets, target] });
	}

	// The Secrets panel is a Cloud panel; with the Cloud gate closed the link would land elsewhere.
	// The More view replaces the details panel, so the panel closes.
	const openSecrets = showBackendGroup
		? () => {
				setIsActivityOpen(false);
				setSearch({ view: "more", panel: "secrets" }, false);
			}
		: undefined;

	// The scan card of the chat opens the stored report. The More view replaces
	// the details panel, and on a phone the open chat covers the view, so both close.
	function openSecurityReport() {
		setIsActivityOpen(false);
		if (isMobile) setChatOpenAndStore(false);
		setSearch({ view: "more", panel: "security" }, false);
	}

	// A Security panel turn shows its reply in the chat, so a closed chat opens.
	function sendSecurityTurn(text: string, mode: "build" | "security_scan") {
		void thread.send({ text, files: [], mode });
		setChatOpenAndStore(true);
	}

	const chatCard = (
		<ChatPane
			// A new key mounts a new pane for each conversation. The draft, the
			// files, the tray, and the scroll state of the other one go away.
			key={openChatId}
			messages={thread.messages}
			// The running turn shows its own hold; before a send, the estimate route answers.
			turnEstimateCredits={
				thread.estimate?.credits ?? nextTurnEstimate?.estimate?.credits ?? null
			}
			targets={targets}
			isReadOnly={!canEdit}
			payerOutOfCredits={payerOutOfCredits}
			isPayerActiveWorkspace={isPayerActiveWorkspace}
			onRemoveTarget={(index) =>
				setPicked({
					projectId,
					targets: targets.filter((_, current) => current !== index),
				})
			}
			isSending={thread.isSending}
			phase={thread.phase}
			isFirstTurn={thread.isFirstTurn}
			liveMessageId={thread.liveMessageId}
			isDeveloperView={isDeveloperView}
			// The switch exists only in local dev. A production build always shows the production view.
			onChangeDeveloperView={
				import.meta.env.DEV
					? (next) => {
							setIsDeveloperView(next);
							writeDeveloperView(next);
						}
					: null
			}
			onOpenActivity={(messageId) => {
				setActivityMessageId(messageId);
				setIsActivityOpen(true);
			}}
			isReady={thread.isReady}
			chats={chats}
			openChatId={openChatId}
			busyChatId={thread.busyChatId}
			onOpenChat={openChatById}
			onCreateChat={createAndOpenChat}
			onSend={async (input) => {
				setPicked({ projectId, targets: [] });
				const isAccepted = await thread.send(input, targets);
				// A refused send gives the picks back, like the composer gives back the draft.
				if (!isAccepted) setPicked({ projectId, targets });
				return isAccepted;
			}}
			onDecideApproval={thread.decideApproval}
			// LIMIT: an answer to a question round carries no targets; the chips stay for
			// the next plain message. Upgrade: add the targets to the ask_user tool result.
			onAnswerQuestions={thread.answerQuestions}
			isPlanMode={thread.isPlanMode}
			onPlanModeChange={thread.setPlanMode}
			modelPick={modelPick}
			chatCost={chatCost}
			contextUsage={thread.contextUsage}
			onCancel={() =>
				void thread
					.cancel()
					.catch((error: unknown) => toast.error(getApiErrorMessage(error)))
			}
			// Without the conversation list no thread loads, so its failed load shows in the same row.
			errorText={
				thread.errorText ??
				(chatListError === null ? null : getApiErrorMessage(chatListError))
			}
			onReconnect={thread.reconnect}
			onCollapse={() => setChatOpenAndStore(false)}
			onOpenSecrets={openSecrets}
			onOpenSecurityReport={openSecurityReport}
			hasOlderMessages={thread.hasOlderMessages}
			isLoadingOlderMessages={thread.isLoadingOlderMessages}
			onLoadOlderMessages={thread.loadOlderMessages}
			githubUpdate={
				githubStatus?.link?.updateAvailable
					? {
							isUpdating: githubPull.isPending,
							onUpdate: () => githubPull.mutate(githubStatus.headSha),
						}
					: undefined
			}
			className="h-full"
		/>
	);

	const mainCard = (
		<div
			className={cn(
				"relative flex h-full min-h-0 flex-col overflow-hidden",
				STAGE_CARD_CLASS,
			)}
		>
			{/* The preview stays mounted across views so the app inside keeps its state. */}
			<div
				className={cn(
					"h-full min-h-0 flex-col",
					view === "preview" ? "flex" : "hidden",
				)}
			>
				{/* A project switch in place remounts the preview, so the old frame and its token state go away. */}
				{/* A desktop app runs the same Vite frontend in the browser, so WebPreview shows it in a window frame. */}
				{project.kind !== "mobile" ? (
					<WebPreview
						key={project.id}
						project={project}
						liveUrl={previewLiveUrl}
						viewport={viewport}
						onChangeViewport={(next) => setSearch({ viewport: next }, true)}
						reloadKey={reloadKey}
						onReload={() => setReloadKey((key) => key + 1)}
						bootContext={bootContext}
						canStartTurn={canStartTurn}
						canEditTheme={canEdit}
						isSelecting={isSelecting}
						onSelectingChange={setIsSelecting}
						onPickTarget={pickTarget}
						// The errors belong to the whole app, so the picks stay for a later message.
						onTryToFix={(message) => thread.send({ text: message, files: [] })}
						isActive={view === "preview"}
					/>
				) : (
					<PhonePreview
						key={project.id}
						project={project}
						target={mobileTarget}
						onChangeTarget={(next) => setSearch({ device: next }, true)}
						reloadKey={reloadKey}
						onReload={() => setReloadKey((key) => key + 1)}
						bootContext={bootContext}
						// A device session needs the editor role.
						canRunOnDevice={canEdit && isDevicePreviewEnabled}
						canStartTurn={canStartTurn}
						onTryToFix={(message) => thread.send({ text: message, files: [] })}
					/>
				)}
			</div>
			{view === "code" ? (
				<CodeView
					projectId={project.id}
					filePath={search.file}
					onSelectFile={(path) => setSearch({ file: path }, true)}
					isTurnRunning={thread.isTurnRunning}
				/>
			) : null}
			{/* Hidden, not unmounted: the SQL draft and the open page stay. Its Cloud queries wait for isActive. */}
			<div
				className={cn(
					"h-full min-h-0 flex-col",
					view === "more" ? "flex" : "hidden",
				)}
			>
				{/* A project switch in place remounts the view, so no draft or result of the old project stays. */}
				<MoreView
					key={project.id}
					project={project}
					panel={panel}
					isActive={view === "more"}
					showBackendGroup={showBackendGroup}
					onSelectPanel={(next) => setSearch({ panel: next }, false)}
					canSendTurn={canEdit && thread.isReady && !thread.isSending}
					onRunSecurityScan={() =>
						sendSecurityTurn(
							t("appBuilder.security.scanMessage"),
							"security_scan",
						)
					}
					// An explicit build: with the Plan toggle on, a fix must not become a plan.
					onAskSecurityFix={(text) => sendSecurityTurn(text, "build")}
				/>
			</div>
			{/* The panel covers the views and keeps them mounted, so the preview keeps its state. */}
			{!isMobile && isActivityOpen && activityMessage !== undefined ? (
				<ActivityPanel
					// A new reply mounts a new panel, so its scroll and its follow state start fresh.
					key={activityMessage.id}
					message={activityMessage}
					isLive={activityMessageId === thread.liveMessageId}
					onClose={() => setIsActivityOpen(false)}
					onOpenSecrets={openSecrets}
					// The panel takes the surface of the stage card it covers.
					className="absolute inset-0 z-20 bg-white dark:bg-sand"
				/>
			) : null}
		</div>
	);

	const projectBar = (
		<ProjectBar
			project={project}
			chatOpen={chatOpen}
			onExpandChat={() => setChatOpenAndStore(true)}
			liveCommitSha={live?.commitSha ?? null}
			// The restore writes the old tree into the sandbox worktree; the reload
			// mints a new token and shows it. A stopped sandbox shows the waking
			// state until the next turn.
			onRestored={() => setReloadKey((key) => key + 1)}
		/>
	);

	const workBar = (
		<WorkBar
			project={project}
			view={view}
			// A view change is a new intent, so it also closes the details panel.
			onChangeView={(next) => {
				setIsActivityOpen(false);
				setSearch({ view: next }, false);
			}}
			canAskFix={thread.isReady && !thread.isSending && !isOtherChatBusy}
			onAskFix={(text) => {
				thread.send({ files: [], text });
				// The reply shows in the chat, so a closed chat opens. On a phone it covers the work pane.
				setChatOpenAndStore(true);
			}}
		/>
	);

	return (
		<TooltipProvider>
			<div className={cn("flex h-svh flex-col overflow-hidden", DESK_CLASS)}>
				{isMobile ? (
					<>
						<div className="flex h-12 shrink-0 items-center gap-2 px-3">
							{projectBar}
							{workBar}
						</div>
						<div className="relative flex min-h-0 flex-1">
							{/* On phones the open chat covers the main card. */}
							<div
								className={cn(
									"absolute inset-0 z-30 p-3 pt-0",
									DESK_CLASS,
									!chatOpen && "hidden",
								)}
							>
								{chatCard}
							</div>
							<main className="min-h-0 min-w-0 flex-1 p-3 pt-0">
								{mainCard}
							</main>
						</div>
						{/* On a phone the details open as a full-screen sheet over the chat. */}
						<Sheet
							open={isActivityOpen && activityMessage !== undefined}
							onOpenChange={(open) => {
								if (!open) setIsActivityOpen(false);
							}}
						>
							<SheetContent
								// Radix focuses the first button, which is the close button. On a
								// phone, its tooltip then opens. The dialog itself takes the focus instead.
								onOpenAutoFocus={(event) => {
									event.preventDefault();
									if (event.currentTarget instanceof HTMLElement) {
										event.currentTarget.focus();
									}
								}}
								side="bottom"
								showCloseButton={false}
								aria-describedby={undefined}
								className="flex h-svh flex-col gap-0 bg-white p-0 dark:bg-sand"
							>
								{/* Radix needs a dialog title; the panel header shows the same words. */}
								<SheetTitle className="sr-only">
									{t("appBuilder.chat.details")}
								</SheetTitle>
								{activityMessage !== undefined ? (
									<ActivityPanel
										// A new reply mounts a new panel, so its scroll and its follow state start fresh.
										key={activityMessage.id}
										message={activityMessage}
										isLive={activityMessageId === thread.liveMessageId}
										onClose={() => setIsActivityOpen(false)}
										onOpenSecrets={openSecrets}
										className="flex-1"
									/>
								) : null}
							</SheetContent>
						</Sheet>
					</>
				) : (
					<ResizablePanelGroup
						orientation="horizontal"
						// The preview iframe swallows the pointer, so it ignores pointer events while a separator drags.
						className="has-[[data-separator=active]]:[&_iframe]:pointer-events-none"
						defaultLayout={readChatLayout()}
						onLayoutChanged={(layout, meta) => {
							// A programmatic collapse fires this callback too; only a real drag may overwrite the stored width.
							if (!meta.isUserInteraction) return;
							const collapsed = (layout.chat ?? 0) === 0;
							// A zero width is not a width to restore, so a drag to zero keeps the last stored layout.
							if (!collapsed) writeChatLayout(layout);
							if (collapsed === chatOpen) setChatOpenAndStore(!collapsed);
						}}
					>
						{/* defaultSize stays constant: a new value re-registers the panel and forgets the width to expand to. */}
						{/* The effect above collapses a closed chat at mount, so a closed mount needs no zero size. */}
						<ResizablePanel
							id="chat"
							defaultSize={CHAT_PANEL_DEFAULT_WIDTH}
							minSize={CHAT_PANEL_MIN_WIDTH}
							// The main card keeps 55 % or more, so the preview frame has room.
							maxSize="45%"
							collapsible
							collapsedSize="0%"
							panelRef={chatPanelRef}
							className="overflow-hidden"
						>
							{/* The project controls sit over the chat column and leave with it. */}
							{/* A collapsed panel keeps the chat mounted at zero width. inert takes its hidden controls out of the tab order. */}
							<div
								inert={!chatOpen}
								className="flex h-full flex-col ps-3 pe-1.5"
							>
								<div className="flex h-12 shrink-0 items-center">
									{chatOpen ? projectBar : null}
								</div>
								<div className="min-h-0 flex-1 pb-3">{chatCard}</div>
							</div>
						</ResizablePanel>
						{/* The handle sits invisibly in the gap between the two columns; it tints while hovered or dragged. */}
						{/* The tint spans the columns only: it starts below the 48 px bar row and stops at the bottom padding. */}
						<ResizableHandle
							className={cn(
								"bg-transparent after:top-12 after:bottom-3 after:rounded-full after:transition-colors data-[separator=active]:after:bg-foreground/20 data-[separator=hover]:after:bg-foreground/15 data-[separator=keyboard]:after:bg-foreground/20",
								!chatOpen && "hidden",
							)}
						/>
						<ResizablePanel id="main">
							{/* The work pane controls sit over the main card, so a drag moves them with it. */}
							{/* While the chat is closed, the project controls join them at the start. */}
							<div
								className={cn(
									"flex h-full flex-col pe-3",
									chatOpen ? "ps-1.5" : "ps-3",
								)}
							>
								<div className="flex h-12 shrink-0 items-center gap-2">
									{chatOpen ? null : projectBar}
									{workBar}
								</div>
								<main className="min-h-0 flex-1 pb-3">{mainCard}</main>
							</div>
						</ResizablePanel>
					</ResizablePanelGroup>
				)}
			</div>
		</TooltipProvider>
	);
}
