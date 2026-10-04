/**
 * Web preview: a bar with the host of the live app, or "Not published yet",
 * and the Select toggle, the error banner with "Try to fix", then the sandbox
 * app in an iframe at full, tablet, or phone width. Rendered by
 * pages/app-builder-page.tsx for web projects, which reads the live URL from
 * the publish status. PreviewPanel loads the real preview URL through the
 * preview-token route and passes the messages of the dev bridge in the app.
 */

import type { PreviewBridgeMessage, PreviewTarget } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { Crosshair, Lock, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import {
	MOBILE_VIEWPORT_WIDTH_PX,
	TABLET_VIEWPORT_WIDTH_PX,
	type WebViewport,
} from "../../lib/constants";
import {
	tryToFixMessage,
	usePreviewRuntimeErrors,
} from "../../lib/use-preview-runtime-errors";
import type { PreviewTokenDeps } from "../../lib/use-preview-token";
import { PreviewPanel } from "./preview-panel";

/** Iframe width per viewport, CSS px. `desktop` keeps the full card width; `tablet` is the iPad portrait logical width. */
const VIEWPORT_WIDTH_PX: Record<WebViewport, number | null> = {
	desktop: null,
	tablet: TABLET_VIEWPORT_WIDTH_PX,
	mobile: MOBILE_VIEWPORT_WIDTH_PX,
};

/** Props of the web preview. The page reads them from the URL, the project query, and the chat. */
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
	/** False while a turn runs or the chat loads. Then Select and "Try to fix" are disabled. */
	canStartTurn: boolean;
	/** True while the select mode is on. The page owns it, because the composer shows the picks. */
	isSelecting: boolean;
	/** Turns the select mode on or off: the toggle, and Escape in the app. */
	onSelectingChange: (isSelecting: boolean) => void;
	/** Gets each element the user clicks in select mode. */
	onPickTarget: (target: PreviewTarget) => void;
	/** Sends the "Try to fix" text as one chat message. */
	onTryToFix: (message: string) => void;
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
	canStartTurn,
	isSelecting,
	onSelectingChange,
	onPickTarget,
	onTryToFix,
	deps,
}: WebPreviewProps) {
	const { t } = useTranslation();
	const frameWidth = VIEWPORT_WIDTH_PX[viewport];
	// Reloads that this preview asks for itself. They add to the reload key of the page.
	const [ownReloads, setOwnReloads] = useState(0);
	// True from an own reload until the new page loads. Then the banner shows only the
	// errors of the final code, or the kept ones when the new page cannot start.
	const [isReloadPending, setIsReloadPending] = useState(false);
	const runtimeErrors = usePreviewRuntimeErrors(
		bootContext.isTurnRunning,
		() => {
			setOwnReloads((count) => count + 1);
			setIsReloadPending(true);
		},
	);
	// The errors of a running turn are not final, so the banner waits for the turn end.
	const firstError =
		bootContext.isTurnRunning || isReloadPending
			? undefined
			: runtimeErrors.errors[0];
	const frameReloadKey = reloadKey + ownReloads;
	// The reload key of the page whose bridge said ready. An app from an older
	// template has no bridge, and a page with a compile error starts none, so
	// Select stays off until the current page says ready.
	const [readyReloadKey, setReadyReloadKey] = useState<number | null>(null);
	const hasBridge = readyReloadKey === frameReloadKey;

	// A click in select mode does not move the focus into the frame, so
	// Escape mostly reaches this page and not the bridge in the app.
	useEffect(() => {
		if (!isSelecting) return;
		const onKeyDown = (event: KeyboardEvent) => {
			// A menu or a dialog that closes on this Escape already handled it.
			if (event.key === "Escape" && !event.defaultPrevented) {
				onSelectingChange(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [isSelecting, onSelectingChange]);

	function onBridgeMessage(message: PreviewBridgeMessage) {
		switch (message.type) {
			case "wandit:bridge-ready":
				setReadyReloadKey(frameReloadKey);
				// The app loaded again, so the errors of the old page no longer apply.
				runtimeErrors.clear();
				return;
			case "wandit:runtime-error":
				runtimeErrors.add({ message: message.message, stack: message.stack });
				return;
			case "wandit:select-source":
				// The app code can post a pick too. Only a pick in select mode counts.
				if (isSelecting) {
					onPickTarget({
						src: message.src,
						tag: message.tag,
						label: message.label,
					});
				}
				return;
			case "wandit:deselect":
				onSelectingChange(false);
				return;
		}
	}

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
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant={isSelecting ? "secondary" : "ghost"}
							size="xs"
							aria-pressed={isSelecting}
							disabled={!canStartTurn || !hasBridge}
							onClick={() => onSelectingChange(!isSelecting)}
						>
							<Crosshair />
							{t("appBuilder.preview.select")}
						</Button>
					</TooltipTrigger>
					<TooltipContent side="bottom">
						{t("appBuilder.preview.selectHint")}
					</TooltipContent>
				</Tooltip>
			</div>
			{firstError === undefined ? null : (
				<div
					role="alert"
					className="flex shrink-0 items-center gap-2 border-b bg-destructive/5 px-3 py-2"
				>
					<TriangleAlert className="size-4 shrink-0 text-destructive" />
					<div className="min-w-0 flex-1">
						<p className="font-medium text-sm">
							{t("appBuilder.preview.errors.title")}
						</p>
						<p dir="auto" className="truncate text-muted-foreground text-xs">
							{firstError.message}
						</p>
					</div>
					{runtimeErrors.count > 1 ? (
						<span className="shrink-0 text-muted-foreground text-xs">
							{t("appBuilder.preview.errors.count", {
								count: runtimeErrors.count,
							})}
						</span>
					) : null}
					<Button
						variant="outline"
						size="sm"
						disabled={!canStartTurn}
						onClick={() =>
							onTryToFix(
								tryToFixMessage(
									t("appBuilder.preview.errors.fixPrompt"),
									runtimeErrors.errors,
								),
							)
						}
					>
						{t("appBuilder.preview.errors.tryToFix")}
					</Button>
				</div>
			)}
			<div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-void">
				<PreviewPanel
					projectId={project.id}
					title={t("appBuilder.preview.frameTitle", { name: project.name })}
					reloadKey={frameReloadKey}
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
					isSelecting={isSelecting}
					onBridgeMessage={onBridgeMessage}
					onFrameLoad={() => setIsReloadPending(false)}
					deps={deps}
				/>
			</div>
		</div>
	);
}
