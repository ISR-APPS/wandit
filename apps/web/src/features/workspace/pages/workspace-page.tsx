// The /p/$projectId workspace: header chrome, resizable chat pane on the
// left, polymorphic main pane (Page | Assets | Leads | Settings) on the
// right. Desktop gets a drag-resizable split with the main pane floating as
// an inset card (mirrors the admin dashboard's sidebar-inset look); mobile
// keeps the chat pane as a full-screen overlay. All workspace-level state
// lives in WorkspaceProvider (lib/store.tsx).

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
import { useEffect, useRef } from "react";

import { Spark } from "@/components/logo";
import type { WorkspaceTab } from "../api/dto";
import { AssetsTab } from "../components/assets/assets-tab";
import { ChatPane } from "../components/chat/chat-pane";
import { LeadsTab } from "../components/leads/leads-tab";
import { PageTab } from "../components/page/page-tab";
import { SettingsTab } from "../components/settings/settings-tab";
import { WorkspaceHeader } from "../components/shell/workspace-header";
import { WorkspaceTabs } from "../components/shell/workspace-tabs";
import { WORKSPACE_COPY } from "../lib/constants";
import {
	readWorkspacePanelLayout,
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
			<div className="flex h-svh flex-col overflow-hidden bg-background">
				<WorkspaceHeader />

				{/* Tabs move to their own row below the header on small screens. */}
				<div className="flex h-11 shrink-0 items-center justify-center border-b px-3 lg:hidden">
					<WorkspaceTabs />
				</div>

				<div className="relative min-h-0 flex-1 bg-muted/40">
					{isMobile ? <MobileSplit tab={tab} /> : <DesktopSplit tab={tab} />}
				</div>
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
// that on narrower desktop widths the way a floor in px can.
const DEFAULT_CHAT_WIDTH = "420px";
const MIN_CHAT_WIDTH = "420px";

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
			>
				<ChatPane />
			</ResizablePanel>
			<ResizableHandle withHandle className={cn(!chatOpen && "hidden")} />
			<ResizablePanel id="main" minSize="40%">
				<div className="h-full p-2.5 pl-2">
					<WorkspaceMain
						tab={tab}
						className="overflow-hidden rounded-xl border shadow-sm"
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
	return (
		<main
			className={cn(
				"relative flex h-full min-h-0 w-full flex-col bg-background",
				className,
			)}
		>
			{/* Page stays mounted across tab switches so the preview iframe
			    keeps its state. */}
			<div
				className={cn(
					"h-full min-h-0 flex-col",
					tab === "page" ? "flex" : "hidden",
				)}
			>
				<PageTab />
			</div>
			{tab === "assets" ? (
				<div className="min-h-0 flex-1 overflow-y-auto">
					<AssetsTab />
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
	return (
		<div className="grid h-svh place-items-center bg-background">
			<div className="flex flex-col items-center gap-3 text-center">
				<span className="grid size-11 place-items-center rounded-full border border-primary/25 bg-card">
					<Spark className="size-4 text-primary/60" />
				</span>
				<h1 className="font-display font-semibold text-xl">
					{WORKSPACE_COPY.notFound.title}
				</h1>
				<p className="text-muted-foreground text-sm">
					{WORKSPACE_COPY.notFound.body}
				</p>
				<Button asChild variant="secondary" className="mt-2">
					<Link to="/dashboard">{WORKSPACE_COPY.notFound.cta}</Link>
				</Button>
			</div>
		</div>
	);
}
