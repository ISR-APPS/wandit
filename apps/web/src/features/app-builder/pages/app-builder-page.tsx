/**
 * The `/app/$projectId` workspace: the chat card and the main card, each with
 * its half of the top bar above it. On desktop a resizable split moves the
 * work pane controls with the main card. On phones the open chat covers it.
 * Rendered by routes/_auth/app.$projectId.tsx after its loader filled the
 * project and thread queries. The URL search params hold the view state.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	type ResizablePanelHandle,
} from "@wandit/ui/components/resizable";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
import { Suspense, useEffect, useRef, useState } from "react";

import Loader from "@/components/loader";
import { useTranslation } from "@/lib/i18n";
import { useSendBuilderMessage } from "../api/app-builder.mutations";
import {
	appProjectQuery,
	builderThreadQuery,
} from "../api/app-builder.queries";
import { ChatPane } from "../components/chat/chat-pane";
import { CodeView } from "../components/code/code-view";
import { MoreView } from "../components/more/more-view";
import { PhonePreview } from "../components/preview/phone-preview";
import { WebPreview } from "../components/preview/web-preview";
import { AppNotFound } from "../components/shell/app-not-found";
import { ProjectBar, WorkBar } from "../components/shell/top-bar";
import {
	CHAT_PANEL_DEFAULT_WIDTH,
	CHAT_PANEL_MIN_WIDTH,
	MORE_PANEL_META,
} from "../lib/constants";
import {
	readChatLayout,
	readChatOpen,
	resolveMorePanel,
	writeChatLayout,
	writeChatOpen,
} from "../lib/helpers";
import type { AppBuilderSearch } from "../lib/schemas";

export type AppBuilderPageProps = {
	projectId: string;
	/** Validated `?view=&panel=&device=&viewport=&file=` of the URL. */
	search: AppBuilderSearch;
};

export default function AppBuilderPage({
	projectId,
	search,
}: AppBuilderPageProps) {
	const { t } = useTranslation();
	const navigate = useNavigate({ from: "/app/$projectId" });
	// The route loader filled both queries, so neither suspends on first paint.
	const { data: project } = useSuspenseQuery(appProjectQuery(projectId));
	const { data: thread } = useSuspenseQuery(builderThreadQuery(projectId));
	const sendMessage = useSendBuilderMessage(projectId);
	const [chatOpen, setChatOpen] = useState(readChatOpen);
	// A new key remounts the preview iframe; the top bar reload button bumps it.
	const [reloadKey, setReloadKey] = useState(0);
	// LIMIT: the first paint on a phone shows the desktop split for one frame. Upgrade: read the breakpoint in the route loader.
	const isMobile = useIsMobile();
	const chatPanelRef = useRef<ResizablePanelHandle>(null);

	// The expand button and the card header button drive the panel; a drag reports back through onLayoutChanged.
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

	const view = search.view ?? "preview";
	const panel = resolveMorePanel(project.kind, search.panel);
	const device = search.device ?? "ios";
	const viewport = search.viewport ?? "desktop";
	const title =
		view === "more"
			? t(MORE_PANEL_META[panel].title)
			: t(`appBuilder.views.${view}`);

	// Views and panels make a history entry. Frame toggles and file picks replace it.
	function setSearch(patch: Partial<AppBuilderSearch>, replace: boolean) {
		void navigate({
			search: (previous) => ({ ...previous, ...patch }),
			replace,
		});
	}

	// Every open or close path (top bar, card header, drag to zero) goes through here, so the choice persists.
	function setChatOpenAndStore(open: boolean) {
		setChatOpen(open);
		writeChatOpen(open);
	}

	const chatCard = (
		<ChatPane
			messages={thread.messages}
			turnEstimateCredits={thread.turnEstimateCredits}
			focusLabel={thread.focusLabel}
			isSending={sendMessage.isPending}
			projectName={project.name}
			onSend={(input) => sendMessage.mutate(input)}
			onCollapse={() => setChatOpenAndStore(false)}
			onPreviewVersion={() => setSearch({ view: "preview" }, false)}
			className="h-full rounded-2xl border bg-sidebar"
		/>
	);

	const mainCard = (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border bg-sidebar">
			{/* The preview stays mounted across views so the app inside keeps its state. */}
			<div
				className={cn(
					"h-full min-h-0 flex-col",
					view === "preview" ? "flex" : "hidden",
				)}
			>
				{project.kind === "web" ? (
					<WebPreview
						project={project}
						viewport={viewport}
						reloadKey={reloadKey}
					/>
				) : (
					<PhonePreview
						project={project}
						device={device}
						reloadKey={reloadKey}
					/>
				)}
			</div>
			{view === "code" ? (
				<Suspense fallback={<Loader />}>
					<CodeView
						projectId={project.id}
						filePath={search.file}
						onSelectFile={(path) => setSearch({ file: path }, true)}
					/>
				</Suspense>
			) : null}
			{view === "more" ? (
				<MoreView
					project={project}
					panel={panel}
					onSelectPanel={(next) => setSearch({ panel: next }, false)}
				/>
			) : null}
		</div>
	);

	const projectBar = (
		<ProjectBar
			project={project}
			chatOpen={chatOpen}
			onExpandChat={() => setChatOpenAndStore(true)}
		/>
	);

	const workBar = (
		<WorkBar
			project={project}
			view={view}
			title={title}
			device={device}
			viewport={viewport}
			onChangeView={(next) => setSearch({ view: next }, false)}
			onChangeDevice={(next) => setSearch({ device: next }, true)}
			onChangeViewport={(next) => setSearch({ viewport: next }, true)}
			onReload={() => setReloadKey((key) => key + 1)}
			onOpenExternal={() =>
				window.open(`https://${project.slug}.wandit.app`, "_blank", "noopener")
			}
		/>
	);

	return (
		<TooltipProvider>
			<div className="flex h-svh flex-col overflow-hidden bg-background">
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
									"absolute inset-0 z-30 bg-background p-3 pt-0",
									!chatOpen && "hidden",
								)}
							>
								{chatCard}
							</div>
							<main className="min-h-0 min-w-0 flex-1 p-3 pt-0">
								{mainCard}
							</main>
						</div>
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
							{/* The project controls sit over the chat card and leave with it. */}
							{/* A collapsed panel keeps the card mounted at zero width. inert takes its hidden controls out of the tab order. */}
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
						{/* The tint spans the cards only: it starts below the 48 px bar row and stops at the bottom padding. */}
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
