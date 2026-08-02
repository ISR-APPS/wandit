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
import { EditPanel } from "../components/page/edit-panel";
import { PageTab } from "../components/page/page-tab";
import { PublishConfirmDialog } from "../components/publish/publish-confirm-dialog";
import { SettingsTab } from "../components/settings/settings-tab";
import { MainPaneHeader } from "../components/shell/main-pane-header";
import { WorkspaceHeader } from "../components/shell/workspace-header";
import { AiChatProvider } from "../lib/ai-chat-context";
import {
	readWorkspacePanelLayout,
	writeWorkspacePanelLayout,
} from "../lib/helpers";
import { useWorkspace, WorkspaceProvider } from "../lib/store";
import { PageEditorProvider, usePageEditor } from "../lib/use-page-editor";

export default function WorkspacePage({
	projectId,
	tab,
}: {
	projectId: string;
	tab: WorkspaceTab;
}) {
	return (
		<WorkspaceProvider key={projectId} projectId={projectId} tab={tab}>
			{/* The editor and ONE AI SDK chat instance wrap both left panes. Their
			    CSS swap must never remount the live stream or inspector state. */}
			<PageEditorProvider>
				<AiChatProvider projectId={projectId}>
					<WorkspaceLayout />
				</AiChatProvider>
			</PageEditorProvider>
		</WorkspaceProvider>
	);
}

function WorkspaceLayout() {
	const { tab, projectMissing } = useWorkspace();
	const { mode, requestMode } = usePageEditor();
	const isMobile = useIsMobile();

	// Leaving the Page tab while targeting/editing hands the mode back to
	// browse — otherwise the left pane would keep the edit panel (chat
	// unreachable) steering a now-hidden preview. The dirty guard inside
	// requestMode turns this into the discard confirm when unsaved edits
	// exist; cancelling it keeps editing (the user can return to the Page
	// tab), confirming discards and restores the chat.
	useEffect(() => {
		if (tab !== "page" && mode !== "browse") requestMode("browse");
	}, [tab, mode, requestMode]);

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
				<PublishConfirmDialog />
			</div>
		</TooltipProvider>
	);
}

function MobileSplit({ tab }: { tab: WorkspaceTab }) {
	const { chatOpen } = useWorkspace();
	const editor = usePageEditor();
	const editing = editor.mode === "edit";
	return (
		<div className="relative h-full min-h-0">
			{/* One overlay slot, edit wins over chat: the edit panel mirrors the
			    chat's full-screen behavior; both stay mounted (CSS toggle) so the
			    composer draft, chat scroll and streams survive the swap. Closing
			    via the panel's X reveals the preview (browse mode). */}
			<div
				className={cn(
					"absolute inset-0 z-30",
					!(chatOpen || editing) && "hidden",
				)}
			>
				<div className={cn("h-full", editing && "hidden")}>
					<ChatPane />
				</div>
				<div className={cn("h-full", !editing && "hidden")}>
					<EditPanel />
				</div>
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
	const editor = usePageEditor();
	const editing = editor.mode === "edit";
	// Edit (Modifier) swaps the LEFT pane's content from chat to the edit
	// panel — so the pane must be open whenever editing, even if the chat was
	// collapsed; leaving edit falls back to the persisted chatOpen state.
	const paneOpen = chatOpen || editing;
	const chatPanelRef = useRef<ResizablePanelHandle>(null);

	// Button-driven open/close (from the store) imperatively drives the panel;
	// drag-driven collapse/expand is synced back via onLayoutChanged below.
	useEffect(() => {
		const panel = chatPanelRef.current;
		if (!panel) return;
		if (paneOpen && panel.isCollapsed()) panel.expand();
		if (!paneOpen && !panel.isCollapsed()) panel.collapse();
	}, [paneOpen]);

	return (
		<ResizablePanelGroup
			orientation="horizontal"
			defaultLayout={readWorkspacePanelLayout()}
			onLayoutChanged={(layout, meta) => {
				// isUserInteraction is only true for a real pointer/keyboard drag —
				// unlike onResize, it never fires for programmatic collapse/expand
				// or the animation frames those produce, so it's safe to trust here.
				if (!meta.isUserInteraction) return;
				// While editing, paneOpen never transitions, so the expand effect
				// above could not recover from a drag-collapse: edit mode would be
				// stranded with a zero-width panel (and chatOpen would desync from
				// the physical pane on exit). Snap the pane back open instead and
				// skip persisting the transient collapsed layout.
				if (editing && (layout.chat ?? 0) === 0) {
					chatPanelRef.current?.expand();
					return;
				}
				writeWorkspacePanelLayout(layout);
				// While editing, the pane shows the edit panel — a drag-resize
				// must not rewrite the user's persisted chat preference.
				if (editing) return;
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
				{/* Chat and edit panel both stay MOUNTED (CSS toggle) so the
				    composer draft, chat scroll and streams survive the swap. */}
				<div className="h-full py-3 ps-3 pe-1">
					<div className={cn("h-full", editing && "hidden")}>
						<ChatPane className="rounded-2xl border bg-secondary" />
					</div>
					<div className={cn("h-full", !editing && "hidden")}>
						<EditPanel className="rounded-2xl border bg-secondary" />
					</div>
				</div>
			</ResizablePanel>
			{/* The handle sits invisibly in the gap between the two cards — no
			    drawn divider, just a wider hit area that tints while hovered. */}
			<ResizableHandle
				className={cn(
					"bg-transparent after:rounded-full after:transition-colors data-[separator=active]:after:bg-foreground/20 data-[separator=hover]:after:bg-foreground/15 data-[separator=keyboard]:after:bg-foreground/20",
					!paneOpen && "hidden",
				)}
			/>
			<ResizablePanel id="main" minSize="40%">
				<div className={cn("h-full py-3 pe-3", paneOpen ? "ps-1" : "ps-3")}>
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
					<AssetsTab />
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
