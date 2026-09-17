/**
 * Web preview: a browser bar with the app URL, then the sandbox app in an
 * iframe at full, tablet, or phone width. Rendered by
 * pages/app-builder-page.tsx for web projects. PreviewPanel loads the real
 * preview URL through the preview-token route.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import {
	MOBILE_VIEWPORT_WIDTH_PX,
	TABLET_VIEWPORT_WIDTH_PX,
	type WebViewport,
} from "../../lib/constants";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PreviewPanel } from "./preview-panel";

/** Iframe width per viewport, CSS px. `desktop` keeps the full card width; `tablet` is the iPad portrait logical width. */
const VIEWPORT_WIDTH_PX: Record<WebViewport, number | null> = {
	desktop: null,
	tablet: TABLET_VIEWPORT_WIDTH_PX,
	mobile: MOBILE_VIEWPORT_WIDTH_PX,
};

/** Props of the web preview. The page reads them from the URL and the project query. */
export type WebPreviewProps = {
	/** The open project. `slug` fills the URL pill, `name` the iframe title, `id` mints the preview token. */
	project: AppProject;
	/** `desktop`, `tablet`, or `mobile`, from the viewport toggle of the top bar. The narrow widths shrink the iframe. */
	viewport: WebViewport;
	/** Changes when the user presses reload. The panel mints a new token for it. */
	reloadKey: number;
	/** Spec seam: a fake getPreviewToken passed to the panel. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/** The narrow viewports shrink the same document; they do not change the app. */
export function WebPreview({
	project,
	viewport,
	reloadKey,
	deps,
}: WebPreviewProps) {
	const { t } = useTranslation();
	const frameWidth = VIEWPORT_WIDTH_PX[viewport];

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
				{/* The iframe history is not wired yet, so both buttons stay disabled. */}
				<Button
					variant="ghost"
					size="icon-xs"
					disabled
					aria-label={t("appBuilder.preview.back")}
				>
					<ChevronLeft className="rtl:rotate-180" />
				</Button>
				<Button
					variant="ghost"
					size="icon-xs"
					disabled
					aria-label={t("appBuilder.preview.forward")}
				>
					<ChevronRight className="rtl:rotate-180" />
				</Button>
				{/* The pill keeps the public app URL; the real sandbox host is in the iframe. */}
				<div className="flex h-7 flex-1 items-center gap-2 rounded-full border bg-muted/50 px-3 text-xs">
					<Lock className="size-3 text-muted-foreground" />
					<span className="text-foreground">{project.slug}.wandit.app</span>
				</div>
				<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
					<span className="size-1.5 rounded-full bg-success" />
					{t("appBuilder.preview.liveReload")}
				</span>
			</div>
			<div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-void">
				<PreviewPanel
					projectId={project.id}
					title={t("appBuilder.preview.frameTitle", { name: project.name })}
					reloadKey={reloadKey}
					className={cn(
						"h-full w-full bg-transparent",
						frameWidth === null ? "border-0" : "border-x border-y-0",
					)}
					// The inline width wins over `w-full`; the max keeps it inside a narrow card.
					style={
						frameWidth === null
							? undefined
							: { width: frameWidth, maxWidth: "100%" }
					}
					deps={deps}
				/>
			</div>
		</div>
	);
}
