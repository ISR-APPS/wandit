// Left-pane edit panel — replaces the chat in the left pane while the editor
// is in "edit" (Modifier) mode; workspace-page.tsx CSS-toggles the two so both
// stay mounted (composer draft, chat scroll and streams survive). Content is
// the former inspector rail, stretched to the pane's full width: element panel
// on top when something is targeted, then a [Thème | Données] tab switcher.
// Tokens are parsed from the CANONICAL html once per version — pending edits
// overlay in the panels. The header X hands back to browse mode through
// requestMode, so the dirty-state discard confirm comes free from the
// provider.

import { Button } from "@wandit/ui/components/button";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@wandit/ui/components/tabs";
import { useIsMobile } from "@wandit/ui/hooks/use-mobile";
import { cn } from "@wandit/ui/lib/utils";
import { Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useVersionHtmlQuery } from "../../api/pages.queries";
import { parsePageTheme } from "../../lib/preview-editor/parse-tokens";
import { useWorkspace } from "../../lib/store";
import { usePageEditor } from "../../lib/use-page-editor";
import { DataPanel } from "./data-panel";
import { ElementPanel } from "./element-panel";
import { ThemePanel } from "./theme-panel";

export function EditPanel({ className }: { className?: string }) {
	const { t } = useTranslation();
	const { previewVersion } = useWorkspace();
	const editor = usePageEditor();
	const isMobile = useIsMobile();
	const [tab, setTab] = useState<"theme" | "data">("theme");

	// This is a cache hit — PreviewStage already fetched the resolved canvas.
	const htmlQuery = useVersionHtmlQuery(previewVersion?.id);
	const html = htmlQuery.data?.html ?? "";

	const pageTheme = useMemo(
		() =>
			html
				? parsePageTheme(html)
				: ({ tokens: {}, colorScheme: null } as const),
		[html],
	);

	return (
		<aside
			className={cn(
				"flex h-full min-h-0 w-full flex-col overflow-hidden bg-card",
				className,
			)}
		>
			{/* Header — mirrors ChatPane's h-12 border-b px-4 pattern. */}
			<div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
				<span className="font-medium text-[15px]">
					{t("workspace.page.editor.panelTitle")}
				</span>
				<Button
					variant="ghost"
					size="icon-sm"
					className="text-muted-foreground"
					aria-label={t("workspace.page.editor.closePanel")}
					onClick={() => editor.requestMode("browse")}
				>
					<X className="size-4" />
				</Button>
			</div>
			<div className="scroll-warm min-h-0 flex-1 overflow-y-auto">
				{editor.selection ? <ElementPanel /> : null}
				<Tabs
					value={tab}
					onValueChange={(next) => setTab(next === "data" ? "data" : "theme")}
					className="gap-0"
				>
					<div className="px-3.5 pt-3.5">
						<TabsList className="w-full">
							<TabsTrigger value="theme" className="text-xs">
								{t("workspace.page.editor.theme")}
							</TabsTrigger>
							<TabsTrigger value="data" className="text-xs">
								{t("workspace.page.editor.data")}
							</TabsTrigger>
						</TabsList>
					</div>
					<TabsContent value="theme">
						<ThemePanel
							baseTokens={pageTheme.tokens}
							colorScheme={pageTheme.colorScheme}
						/>
					</TabsContent>
					<TabsContent value="data">
						<DataPanel html={html} />
					</TabsContent>
				</Tabs>
			</div>
			{/* Mobile-only save strip — the full-screen overlay covers PageTab's
			    SaveBar (the desktop Save affordance), so dirty edits need their
			    own way to persist here. Mirrors SaveBar byte-for-byte; the
			    discard confirm dialog portals from PageTab, which stays mounted
			    under the overlay. */}
			{isMobile && editor.dirtyCount > 0 ? (
				<div className="flex shrink-0 items-center justify-between gap-3 border-t bg-card px-3.5 py-2">
					<span className="text-muted-foreground text-xs">
						{t("workspace.page.editor.changesCount", {
							count: editor.dirtyCount,
						})}
					</span>
					<div className="flex items-center gap-1.5">
						<Button
							variant="ghost"
							size="sm"
							className="h-7"
							disabled={editor.isSaving}
							onClick={() => editor.openDiscardPrompt(null)}
						>
							{t("workspace.page.editor.discard")}
						</Button>
						<Button
							size="sm"
							className="h-7"
							disabled={editor.isSaving}
							onClick={() => void editor.save()}
						>
							{editor.isSaving ? (
								<Loader2 className="size-3.5 animate-spin" aria-hidden />
							) : null}
							{t("workspace.page.editor.save")}
						</Button>
					</div>
				</div>
			) : null}
		</aside>
	);
}
