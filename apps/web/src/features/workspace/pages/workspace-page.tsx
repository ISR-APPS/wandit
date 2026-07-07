// The /p/$projectId workspace: app chrome on top, then a muted "tray" where
// the chat pane and the polymorphic main pane (Page | Assets | Leads |
// Settings) sit as two separate floating cards with a gap between them.
// Desktop gets a drag-resizable split (the handle lives invisibly in the
// gap); mobile keeps the chat pane as a full-screen overlay. Workspace tabs
// live inside the main card's own header next to per-tab controls. All
// workspace-level state lives in WorkspaceProvider (lib/store.tsx).

import { Link } from "@tanstack/react-router";
import { Button } from "@wandit/ui/components/button";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
	type ResizablePanelHandle,
} from "@wandit/ui/components/resizable";
import { TooltipProvider } from "@wandit/ui/components/tooltip";
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import { Spark } from "@/components/logo";
import { useTranslation } from "@/lib/i18n";
import type { WorkspaceTab } from "../api/dto";
import { AssetsTab } from "../components/assets/assets-tab";
import { ChatPane } from "../components/chat/chat-pane";
import { LeadsTab } from "../components/leads/leads-tab";
import { MarketingTab } from "../components/marketing/marketing-tab";
import { PageTab } from "../components/page/page-tab";
import { PublishPanel } from "../components/publish/publish-panel";
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

function WorkspaceLayout() {
	const { tab, projectMissing } = useWorkspace();
	const isMobile = useIsMobile();

	if (projectMissing) return <ProjectNotFound />;

	return (
		<TooltipProvider>
			<div className="relative flex h-svh flex-col overflow-hidden bg-background">
				{/* Ambient prismatic horizon — glows through the translucent header
				    only; the opaque tray below clips it (DESIGN.md, Warm Horizon). */}
				<div
					aria-hidden
					className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[150px] bg-gradient-horizon opacity-90 [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_34%,transparent_92%)] [mask-image:linear-gradient(to_bottom,black_0%,black_34%,transparent_92%)]"
				/>
				<WorkspaceHeader />
				<div className="relative z-10 min-h-0 flex-1 bg-background">
					{isMobile ? <MobileSplit tab={tab} /> : <DesktopSplit tab={tab} />}
				</div>
				<PublishPanel />
			</div>
		</TooltipProvider>
	);
}

function MobileSplit({ tab }: { tab: WorkspaceTab }) {
	const { chatOpen } = useWorkspace();
	return (
		<div className="relative h-full min-h-0">
			<div className={cn("absolute inset-0 z-30", !chatOpen && "hidden")}>
				<ChatPane />
			</div>
			<WorkspaceMain tab={tab} />
		</div>
	);
}

// Fixed px, not %: the compact PromptBox composer (hint chip + mic + generate
// button) needs ~410px to avoid clipping, and % of viewport can't guarantee
// that on narrower desktop widths the way a floor in px can. 430px is the
// dc-reference chat-panel width.
const DEFAULT_CHAT_WIDTH = "430px";
const MIN_CHAT_WIDTH = "430px";

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
				<div className="h-full py-3 ps-3 pe-1">
					<ChatPane className="rounded-2xl border bg-secondary" />
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
			<ResizablePanel id="main" minSize="40%">
				<div className={cn("h-full py-3 pe-3", chatOpen ? "ps-1" : "ps-3")}>
					<WorkspaceMain
						tab={tab}
						className="rounded-2xl border bg-secondary"
					/>
				</div>
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}

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
