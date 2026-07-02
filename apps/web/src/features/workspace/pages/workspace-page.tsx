// The /p/$projectId workspace: header chrome, collapsible chat pane on the
// left, polymorphic canvas (Canvas | Assets | Leads | Settings) on the right.
// All workspace-level state lives in WorkspaceProvider (lib/store.tsx).

import { Button } from "@my-better-t-app/ui/components/button";
import { TooltipProvider } from "@my-better-t-app/ui/components/tooltip";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { Link } from "@tanstack/react-router";

import { Spark } from "@/components/logo";
import type { WorkspaceTab } from "../api/dto";
import { AssetsTab } from "../components/assets/assets-tab";
import { CanvasTab } from "../components/canvas/canvas-tab";
import { ChatPane } from "../components/chat/chat-pane";
import { LeadsTab } from "../components/leads/leads-tab";
import { SettingsTab } from "../components/settings/settings-tab";
import { WorkspaceHeader } from "../components/shell/workspace-header";
import { WorkspaceTabs } from "../components/shell/workspace-tabs";
import { WORKSPACE_COPY } from "../lib/constants";
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

	if (projectMissing) return <ProjectNotFound />;

	return (
		<TooltipProvider>
			<div className="flex h-svh flex-col overflow-hidden bg-background">
				<WorkspaceHeader />

				{/* Tabs move to their own row below the header on small screens. */}
				<div className="flex h-11 shrink-0 items-center justify-center border-b px-3 md:hidden">
					<WorkspaceTabs />
				</div>

				<div className="relative flex min-h-0 flex-1">
					<ChatPane />
					<main className="relative flex min-w-0 flex-1 flex-col">
						{/* Canvas stays mounted across tab switches so the preview
					    iframe keeps its state. */}
						<div
							className={cn(
								"h-full min-h-0 flex-col",
								tab === "canvas" ? "flex" : "hidden",
							)}
						>
							<CanvasTab />
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
				</div>
			</div>
		</TooltipProvider>
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
