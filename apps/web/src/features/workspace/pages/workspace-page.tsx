/**
 * workspace-page.tsx is the main screen for `/p/$projectId`.
 *
 * In the AI chat flow, the route passes projectId/tab into this page, this page
 * mounts WorkspaceProvider, and then ChatPane mounts useProjectChat. The actual
 * chat networking lives lower down: useProjectChat calls chat.services.ts for
 * JSON endpoints and opens the SSE stream for live assistant tokens.
 *
 * This file's job is layout and shell state: desktop vs mobile split, resizable
 * chat panel, current workspace tab, page iframe reload key, and Assets view
 * persistence. A key gotcha is that desktop collapse does not unmount ChatPane;
 * the panel shrinks, so the SSE connection can stay alive during layout changes.
 */
// The /p/$projectId workspace: app chrome on top, then a muted "tray" where
// the chat pane and the polymorphic main pane (Page | Assets | Leads |
// Settings) sit as two separate floating cards with a gap between them.
// Desktop gets a drag-resizable split (the handle lives invisibly in the
// gap); mobile keeps the chat pane as a full-screen overlay. Workspace tabs
// live inside the main card's own header next to per-tab controls. All
// workspace-level state lives in WorkspaceProvider (lib/store.tsx).

// TanStack Router's Link renders app-internal navigation without a full page
// reload. It is used only in the not-found state at the bottom.
import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
// Resizable panels are the desktop split view: a left chat panel, an invisible
// drag handle, and a right main panel. The handle type lets code imperatively
// collapse/expand the chat panel when the store changes.
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	type ResizablePanelHandle,
} from "@wandit/ui/components/resizable";
// TooltipProvider supplies tooltip behavior for the controls rendered inside
// this page's subtree.
import { TooltipProvider } from "@wandit/ui/components/tooltip";
// useIsMobile is a responsive hook from the UI kit; it chooses the mobile
// overlay layout instead of the desktop resizable split.
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
// React hooks hold local-only UI state here: panel refs, reload counters, and
// persisted Assets view mode.
import { useEffect, useRef, useState } from "react";
import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";
import type { WorkspaceTab } from "../api/dto";
import { AssetsTab } from "../components/assets/assets-tab";
import { ChatPane } from "../components/chat/chat-pane";
import { LeadsTab } from "../components/leads/leads-tab";
import { MarketingTab } from "../components/marketing/marketing-tab";
import { PageTab } from "../components/page/page-tab";
import { SettingsTab } from "../components/settings/settings-tab";
import { MainPaneHeader } from "../components/shell/main-pane-header";
import { WorkspaceHeader } from "../components/shell/workspace-header";
import {
	type AssetsView,
	readAssetsView,
	readWorkspacePanelLayout,
	writeAssetsView,
	writeWorkspacePanelLayout,
} from "../lib/helpers";
import { useWorkspace, WorkspaceProvider } from "../lib/store";

// The exported page component is intentionally small: create a fresh workspace
// context for the current project and let WorkspaceLayout consume it.
export default function WorkspacePage({
	projectId,
	tab,
}: {
	projectId: string;
	tab: WorkspaceTab;
}) {
	return (
		<WorkspaceProvider key={projectId} projectId={projectId} tab={tab}>
			<WorkspaceLayout />
		</WorkspaceProvider>
	);
}

// The top-level workspace shell. It chooses the not-found state, wraps the page
// in tooltip support, and switches between mobile and desktop layouts.
function WorkspaceLayout() {
	const { tab, projectMissing } = useWorkspace();
	const isMobile = useIsMobile();

	// Project lookup happens inside WorkspaceProvider. If it failed, do not mount
	// the chat/page tabs against a missing project id.
	if (projectMissing) return <ProjectNotFound />;

	return (
		<TooltipProvider>
			<div className="flex h-svh flex-col overflow-hidden bg-background">
				<WorkspaceHeader />
				<div className="relative min-h-0 flex-1 bg-muted/70 dark:bg-background">
					{/* Mobile uses an overlay chat so the main pane does not become too narrow. */}
					{isMobile ? <MobileSplit tab={tab} /> : <DesktopSplit tab={tab} />}
				</div>
			</div>
		</TooltipProvider>
	);
}

// Mobile layout keeps WorkspaceMain mounted underneath and toggles ChatPane as a
// full-screen overlay. This keeps tab content state alive while the chat opens.
function MobileSplit({ tab }: { tab: WorkspaceTab }) {
	const { chatOpen } = useWorkspace();
	return (
		<div className="relative h-full min-h-0">
			{/* Hidden instead of unmounted so the chat hook can keep its state while closed. */}
			<div className={cn("absolute inset-0 z-30", !chatOpen && "hidden")}>
				<ChatPane />
			</div>
			<WorkspaceMain tab={tab} />
		</div>
	);
}

// Fixed px, not %: the compact PromptBox composer (hint chip + mic + generate
// button) needs ~410px to avoid clipping, and % of viewport can't guarantee
// that on narrower desktop widths the way a floor in px can. The extra 20px
// over the old flush layout absorbs the card's tray padding.
// Default desktop chat width when the panel starts open.
const DEFAULT_CHAT_WIDTH = "440px";
// Hard floor for the composer; narrower than this would clip the compact prompt
// controls.
const MIN_CHAT_WIDTH = "440px";

// Desktop layout is a persistent two-panel shell. Collapsing the chat changes
// panel size instead of unmounting ChatPane, so streaming chat state survives.
function DesktopSplit({ tab }: { tab: WorkspaceTab }) {
	const { chatOpen, setChatOpenState } = useWorkspace();
	const chatPanelRef = useRef<ResizablePanelHandle>(null);

	// Button-driven open/close (from the store) imperatively drives the panel;
	// drag-driven collapse/expand is synced back via onLayoutChanged below.
	useEffect(() => {
		const panel = chatPanelRef.current;
		if (!panel) return;
		if (chatOpen && panel.isCollapsed()) panel.expand();
		if (!chatOpen && !panel.isCollapsed()) panel.collapse();
	}, [chatOpen]);

	// ResizablePanelGroup reports user-driven layout changes so we can persist
	// the split width and keep the store's chatOpen flag in sync with drags.
	return (
		<ResizablePanelGroup
			orientation="horizontal"
			defaultLayout={readWorkspacePanelLayout()}
			onLayoutChanged={(layout, meta) => {
				// isUserInteraction is only true for a real pointer/keyboard drag —
				// unlike onResize, it never fires for programmatic collapse/expand
				// or the animation frames those produce, so it's safe to trust here.
				if (!meta.isUserInteraction) return;
				writeWorkspacePanelLayout(layout);
				const collapsed = (layout.chat ?? 0) === 0;
				if (collapsed === chatOpen) setChatOpenState(!collapsed);
			}}
		>
			{/* Left panel: the real chat pane, with desktop card chrome applied here. */}
			<ResizablePanel
				id="chat"
				defaultSize={chatOpen ? DEFAULT_CHAT_WIDTH : "0%"}
				minSize={MIN_CHAT_WIDTH}
				maxSize="42%"
				collapsible
				collapsedSize="0%"
				panelRef={chatPanelRef}
				className="overflow-hidden"
			>
				<div className="h-full py-2.5 ps-2.5 pe-1">
					<ChatPane className="rounded-xl border shadow-sm" />
				</div>
			</ResizablePanel>
			{/* The handle sits invisibly in the gap between the two cards — no
			    drawn divider, just a wider hit area that tints while hovered. */}
			<ResizableHandle
				className={cn(
					"bg-transparent after:rounded-full after:transition-colors data-[separator=active]:after:bg-foreground/20 data-[separator=hover]:after:bg-foreground/15 data-[separator=keyboard]:after:bg-foreground/20",
					!chatOpen && "hidden",
				)}
			/>
			{/* Right panel: whichever workspace tab is active. */}
			<ResizablePanel id="main" minSize="40%">
				<div
					className={cn("h-full py-2.5 pe-2.5", chatOpen ? "ps-1" : "ps-2.5")}
				>
					<WorkspaceMain tab={tab} className="rounded-xl border shadow-sm" />
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

// The right-hand workspace card. It keeps tab-level controls in MainPaneHeader
// and swaps the body between Page, Assets, Marketing, Leads, and Settings.
function WorkspaceMain({
	tab,
	className,
}: {
	tab: WorkspaceTab;
	className?: string;
}) {
	// Bumping the key remounts the preview iframe — the header's reload
	// control lives outside PageTab, so the key is owned here.
	const [pageReloadKey, setPageReloadKey] = useState(0);
	const [assetsView, setAssetsViewState] = useState<AssetsView>(readAssetsView);

	// Keep React state and localStorage in sync so the Assets tab reopens in the
	// same Library/Canvas mode after a reload.
	const setAssetsView = (view: AssetsView) => {
		setAssetsViewState(view);
		writeAssetsView(view);
	};

	return (
		<main
			className={cn(
				"relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
				className,
			)}
		>
			<MainPaneHeader
				tab={tab}
				onReloadPage={() => setPageReloadKey((key) => key + 1)}
				assetsView={assetsView}
				onAssetsViewChange={setAssetsView}
			/>
			{/* Page stays mounted across tab switches so the preview iframe
			    keeps its state. */}
			<div
				className={cn(
					"h-full min-h-0 flex-col",
					tab === "page" ? "flex" : "hidden",
				)}
			>
				<PageTab reloadKey={pageReloadKey} />
			</div>
			{/* Other tabs mount only when selected; they do not need iframe-style persistence. */}
			{tab === "assets" ? (
				<div className="flex min-h-0 flex-1 flex-col">
					<AssetsTab view={assetsView} />
				</div>
			) : null}
			{tab === "marketing" ? (
				<div className="min-h-0 flex-1 overflow-y-auto">
					<MarketingTab />
				</div>
			) : null}
			{tab === "leads" ? (
				<div className="min-h-0 flex-1 overflow-y-auto">
					<LeadsTab />
				</div>
			) : null}
			{tab === "settings" ? (
				<div className="min-h-0 flex-1 overflow-y-auto">
					<SettingsTab />
				</div>
			) : null}
		</main>
	);
}

// Friendly fallback shown when the project query says this project id does not
// exist or the user cannot access it.
function ProjectNotFound() {
	const { t } = useTranslation();
	return (
		<div className="grid h-svh place-items-center bg-background">
			<div className="flex flex-col items-center gap-3 text-center">
				<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
					<Spark className="size-4 text-primary/60" />
				</span>
				<h1 className="font-display font-semibold text-xl">
					{t("workspace.notFound.title")}
				</h1>
				<p className="text-muted-foreground text-sm">
					{t("workspace.notFound.body")}
				</p>
				<Button asChild variant="secondary" className="mt-2">
					<Link to="/dashboard">{t("workspace.notFound.cta")}</Link>
				</Button>
			</div>
		</div>
	);
}
