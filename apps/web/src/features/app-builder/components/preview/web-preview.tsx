/**
 * Web preview: a browser bar with the app URL, then the app in an iframe at
 * full width or at phone width. Rendered by pages/app-builder-page.tsx for
 * web projects. Shows MOCK_WEB_PREVIEW_HTML until the sandbox preview URL lands.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import {
	MOBILE_VIEWPORT_WIDTH_PX,
	type WebViewport,
} from "../../lib/constants";
import { MOCK_WEB_PREVIEW_HTML } from "../../lib/mock-preview";

/** Props of the web preview. The page reads them from the URL and the project query. */
export type WebPreviewProps = {
	/** The open project. Only `slug` (URL pill) and `name` (iframe title) are read. */
	project: AppProject;
	/** `desktop` or `mobile`, from the viewport toggle of the top bar. `mobile` narrows the iframe to a phone width. */
	viewport: WebViewport;
	/** Changes when the user presses reload. A new value remounts the iframe. */
	reloadKey: number;
};

/** The mobile viewport narrows the same document to a phone width; it does not change the app. */
export function WebPreview({ project, viewport, reloadKey }: WebPreviewProps) {
	const { t } = useTranslation();
	const isPhoneWidth = viewport === "mobile";

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
				{/* The mock document is the front-desk dashboard, which lives at /admin. */}
				<div className="flex h-7 flex-1 items-center gap-2 rounded-full border bg-muted/50 px-3 text-xs">
					<Lock className="size-3 text-muted-foreground" />
					<span className="text-foreground">{project.slug}.wandit.app</span>
					<span className="text-muted-foreground">/admin</span>
				</div>
				<span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
					<span className="size-1.5 rounded-full bg-success" />
					{t("appBuilder.preview.liveReload")}
				</span>
			</div>
			<div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-void">
				<iframe
					key={reloadKey}
					srcDoc={MOCK_WEB_PREVIEW_HTML}
					title={t("appBuilder.preview.frameTitle", { name: project.name })}
					// An empty sandbox blocks scripts and navigation. The mock document needs neither.
					sandbox=""
					className={cn(
						"h-full w-full bg-transparent",
						isPhoneWidth ? "border-x border-y-0" : "border-0",
					)}
					// The inline width wins over `w-full`; the max keeps it inside a narrow card.
					style={
						isPhoneWidth
							? { width: MOBILE_VIEWPORT_WIDTH_PX, maxWidth: "100%" }
							: undefined
					}
				/>
			</div>
		</div>
	);
}
