/**
 * The `/app/$projectId` workspace: the chat column on the desk and the main
 * card, each with its half of the top bar above it. On desktop a resizable
 * split moves the work pane controls with the main card. On phones the open
 * chat covers it.
 * Rendered by routes/_auth/app.$projectId.tsx after its loader filled the
 * project query. The URL search params hold the view state.
 * The Backend group of the More view shows only behind useCloudTabEnabled;
 * the Appetize device of a mobile project only behind useDevicePreviewEnabled.
 * The details panel of a reply covers the main card (a sheet on a phone).
 * Raw agent thinking never shows in production; local dev has a switch.
 * The page owns the elements picked in the web preview: the composer shows
 * them as chips.
 */

import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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

import { getApiErrorMessage } from "@/lib/api-client";
import { useTranslation } from "@/lib/i18n";
import { appProjectQuery, turnEstimateQuery } from "../api/app-builder.queries";
import { cloudBackendQuery } from "../api/cloud.queries";
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
	readChatLayout,
	readChatOpen,
	readDeveloperView,
	resolvePanel,
	writeChatLayout,
	writeChatOpen,
	writeDeveloperView,
} from "../lib/helpers";
import type { AppBuilderSearch } from "../lib/schemas";
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
	/** Validated `?view=&panel=&device=&viewport=&file=` of the URL. */
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
	const thread = useBuilderThread(projectId);
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
	// A reply that leaves the thread (a project switch, a canceled turn) closes the panel.
	const activityMessage =
		activityMessageId === null
			? undefined
			: thread.messages.find((message) => message.id === activityMessageId);
	// The project menu switches the project in place. A missing reply must not open again on the way back.
	if (isActivityOpen && activityMessage === undefined) setIsActivityOpen(false);
	// The preview boot screen shows the database step on every view, so this read is always on.
	// The query polls while Supabase creates or wakes the project.
	const { data: backend } = useQuery(cloudBackendQuery(projectId, true));
	// The live app of a web project: the host link in the preview bar and the
	// Live mark of the versions read it. A mobile app has no publish status.
	const { data: publishStatus } = useQuery({
		...appPublishQuery(projectId),
		enabled: project?.kind === "web",
	});
	const live = publishStatus?.live ?? null;
	// Undefined until a status arrives, so the preview bar never says "Not published yet" for a live app.
	const previewLiveUrl =
		publishStatus === undefined ? undefined : (live?.url ?? null);
	const isCloudTabEnabled = useCloudTabEnabled(project?.engine);
	const isDevicePreviewEnabled = useDevicePreviewEnabled();
	const [chatOpen, setChatOpen] = useState(readChatOpen);
	// A new key makes the panel mint a new token; the reload button of the preview bar bumps it.
	const [reloadKey, setReloadKey] = useState(0);
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
	const panel = resolvePanel(project.kind, search.panel, isCloudTabEnabled);
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
	const openSecrets = isCloudTabEnabled
		? () => {
				setIsActivityOpen(false);
				setSearch({ view: "more", panel: "secrets" }, false);
			}
		: undefined;

	const chatCard = (
		<ChatPane
			messages={thread.messages}
			// The running turn shows its own hold; before a send, the estimate route answers.
			turnEstimateCredits={
				thread.estimate?.credits ?? nextTurnEstimate?.estimate?.credits ?? null
			}
			targets={targets}
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
			onSend={(input) => {
				thread.send(input, targets);
				setPicked({ projectId, targets: [] });
			}}
			onDecideApproval={thread.decideApproval}
			// LIMIT: an answer to a question round carries no targets; the chips stay for
			// the next plain message. Upgrade: add the targets to the ask_user tool result.
			onAnswerQuestions={thread.answerQuestions}
			isPlanMode={thread.isPlanMode}
			onPlanModeChange={thread.setPlanMode}
			onCancel={() =>
				void thread
					.cancel()
					.catch((error: unknown) => toast.error(getApiErrorMessage(error)))
			}
			errorText={thread.errorText}
			onCollapse={() => setChatOpenAndStore(false)}
			onOpenSecrets={openSecrets}
			hasOlderMessages={thread.hasOlderMessages}
			isLoadingOlderMessages={thread.isLoadingOlderMessages}
			onLoadOlderMessages={thread.loadOlderMessages}
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
				{project.kind === "web" ? (
					<WebPreview
						key={project.id}
						project={project}
						liveUrl={previewLiveUrl}
						viewport={viewport}
						onChangeViewport={(next) => setSearch({ viewport: next }, true)}
						reloadKey={reloadKey}
						onReload={() => setReloadKey((key) => key + 1)}
						bootContext={bootContext}
						canStartTurn={thread.isReady && !thread.isSending}
						isSelecting={isSelecting}
						onSelectingChange={setIsSelecting}
						onPickTarget={pickTarget}
						// The errors belong to the whole app, so the picks stay for a later message.
						onTryToFix={(message) => thread.send({ text: message, files: [] })}
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
						canRunOnDevice={isDevicePreviewEnabled}
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
					showBackendGroup={isCloudTabEnabled}
					onSelectPanel={(next) => setSearch({ panel: next }, false)}
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
			canAskFix={thread.isReady && !thread.isSending}
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
