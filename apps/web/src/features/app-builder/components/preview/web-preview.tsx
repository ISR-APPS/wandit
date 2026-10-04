/**
 * Web preview: a bar with the host of the live app, or "Not published yet",
 * then the sandbox app in an iframe at full, tablet, or phone width.
 * Rendered by pages/app-builder-page.tsx for web projects, which reads the
 * live URL from the publish status. PreviewPanel loads the real preview URL
 * through the preview-token route.
 */

import { cn } from "@wandit/ui/lib/utils";
import { Lock } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
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
	/** The open project. `name` fills the iframe title, `id` mints the preview token. */
	project: AppProject;
	/**
	 * `https://{slug}.{SITES_DOMAIN}` of the live app, from the publish status. Null before the
	 * first publish. Undefined while the status loads or after it failed: the pill then stays empty.
	 */
	liveUrl: string | null | undefined;
	/** `desktop`, `tablet`, or `mobile`, from the viewport toggle of the top bar. The narrow widths shrink the iframe. */
	viewport: WebViewport;
	/** Changes when the user presses reload. The panel mints a new token for it. */
	reloadKey: number;
	/** The running turn and the backend state, from the page. The panel shows the start-up steps from them. */
	bootContext: BootContext;
	/** Spec seam: a fake getPreviewToken passed to the panel. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/** The narrow viewports shrink the same document; they do not change the app. */
export function WebPreview({
	project,
	liveUrl,
	viewport,
	reloadKey,
	bootContext,
	deps,
}: WebPreviewProps) {
	const { t } = useTranslation();
	const frameWidth = VIEWPORT_WIDTH_PX[viewport];

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* No Back or Forward: the page cannot read the history of the cross-origin preview frame. */}
			<div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
				{/* The pill shows the public app host; the real sandbox host is in the iframe. */}
				<div className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-full border bg-muted/50 px-3 text-xs">
					{liveUrl === undefined ? null : liveUrl === null ? (
						<span className="truncate text-muted-foreground">
							{t("appBuilder.publish.notLive")}
						</span>
					) : (
						<>
							<Lock className="size-3 shrink-0 text-muted-foreground" />
							{/* A host reads left to right in every locale. */}
							<span dir="ltr" className="truncate text-foreground">
								{new URL(liveUrl).host}
							</span>
						</>
					)}
				</div>
			</div>
			<div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-void">
				<PreviewPanel
					projectId={project.id}
					title={t("appBuilder.preview.frameTitle", { name: project.name })}
					reloadKey={reloadKey}
					className={cn(
						"h-full w-full bg-transparent",
						// The side borders sit on the void, so they are a faint white line in both themes.
						frameWidth === null
							? "border-0"
							: "border-white/10 border-x border-y-0",
					)}
					// The inline width wins over `w-full`; the max keeps it inside a narrow card.
					style={
						frameWidth === null
							? undefined
							: { width: frameWidth, maxWidth: "100%" }
					}
					bootContext={bootContext}
					deps={deps}
				/>
			</div>
		</div>
	);
}
