/**
 * Web preview of a web project. pages/app-builder-page.tsx renders it and passes the live URL of the publish status.
 * A stage bar holds the address capsule (viewport toggle, page picker, live app link, reload, new tab) and the Select toggle.
 * The "Try to fix" error banner sits under the bar. Below it, the app shows at full width or in a phone of iPhone shape.
 * usePreviewToken mints the preview URL. PreviewPanel shows the iframe and passes the bridge messages. RoutePicker lists the pages.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { CrosshairIcon } from "@phosphor-icons/react/Crosshair";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { GlobeSimpleIcon } from "@phosphor-icons/react/GlobeSimple";
import { MonitorIcon } from "@phosphor-icons/react/Monitor";
import { WarningIcon } from "@phosphor-icons/react/Warning";
import type { PreviewBridgeMessage, PreviewTarget } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { cn } from "@wandit/ui/lib/utils";
import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { AppProject } from "../../api/dto";
import type { BootContext } from "../../lib/boot-state";
import {
	MOBILE_VIEWPORT_HEIGHT_PX,
	MOBILE_VIEWPORT_WIDTH_PX,
	type WebViewport,
} from "../../lib/constants";
import { previewSrcFor } from "../../lib/helpers";
import {
	tryToFixMessage,
	usePreviewRuntimeErrors,
} from "../../lib/use-preview-runtime-errors";
import {
	type PreviewTokenDeps,
	usePreviewToken,
} from "../../lib/use-preview-token";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";
import { PreviewPanel } from "./preview-panel";
import { RoutePicker } from "./route-picker";

// The capsule buttons are one step smaller than the bar buttons, so they fit the 36 px capsule.
const CAPSULE_BUTTON_CLASS = cn(TOOLBAR_ICON_BUTTON_CLASS, "size-7");

// The amber pill of the retry button in preview-panel.tsx. "Try to fix" is the one action of the banner.
const FIX_BUTTON_CLASS =
	"shrink-0 bg-spark px-4 font-grotesk font-semibold text-night hover:bg-spark/90";

// The stage padding, the dots, and the frame move together on a toggle. So the frame stays centered.
// The ease is the quick start and long settle of an iOS sheet.
const VIEWPORT_MOTION_CLASS =
	"duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

// The phone gets narrower on a short stage to keep the iPhone shape. 320 px is the
// smallest phone in use (iPhone SE), so the app never lays out narrower than that.
const MOBILE_FRAME_WIDTH = `clamp(320px, calc(100cqh * ${MOBILE_VIEWPORT_WIDTH_PX} / ${MOBILE_VIEWPORT_HEIGHT_PX}), ${MOBILE_VIEWPORT_WIDTH_PX}px)`;

/** Props of the web preview. The page reads them from the URL, the project query, and the chat. */
export type WebPreviewProps = {
	/** The open project. `name` fills the iframe title, `id` mints the preview token and lists the routes. */
	project: AppProject;
	/**
	 * `https://{slug}.{SITES_DOMAIN}` of the live app, from the publish status. Null before the
	 * first publish. Undefined while the status loads or after it failed: the capsule then shows no host.
	 */
	liveUrl: string | null | undefined;
	/** `desktop` or `mobile`, from `?viewport=`. `mobile` shrinks the iframe. */
	viewport: WebViewport;
	/** Stores the new viewport in the URL. The viewport button of the bar calls it. */
	onChangeViewport: (viewport: WebViewport) => void;
	/** Changes when the user presses reload or restores a version. Each change mints a new token. */
	reloadKey: number;
	/** Bumps `reloadKey` in the page. The reload button of the bar calls it. */
	onReload: () => void;
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
	/** Spec seam: a fake getPreviewToken for usePreviewToken. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * The mobile viewport shrinks the same document; it does not change the
 * app. A pick in the route picker loads that page. A page change inside the
 * app only updates the capsule.
 */
export function WebPreview({
	project,
	liveUrl,
	viewport,
	onChangeViewport,
	reloadKey,
	onReload,
	bootContext,
	canStartTurn,
	isSelecting,
	onSelectingChange,
	onPickTarget,
	onTryToFix,
	deps,
}: WebPreviewProps) {
	const { t } = useTranslation();
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
	const preview = usePreviewToken(project.id, frameReloadKey, deps);
	// The reload key of the page whose bridge said ready. An app from an older
	// template has no bridge, and a page with a compile error starts none, so
	// Select stays off until the current page says ready.
	const [readyReloadKey, setReadyReloadKey] = useState<number | null>(null);
	const hasBridge = readyReloadKey === frameReloadKey;

	// The page the iframe loads. It changes only on a pick or a new preview URL.
	const [framePath, setFramePath] = useState("/");
	// The page the capsule shows. The app reports each page change through the bridge.
	// LIMIT: projects made before the route bridge post no route, so the capsule shows the last picked path. Upgrade: inject the bridge script from the preview proxy.
	const [currentPath, setCurrentPath] = useState("/");
	// A new preview URL (reload, token renewal, restore) loads the page the app shows now, not the first page.
	// The reload button only mints a token. A path change before the new URL arrives loads the page two times.
	const [shownPreviewUrl, setShownPreviewUrl] = useState(preview.previewUrl);
	if (preview.previewUrl !== shownPreviewUrl) {
		setShownPreviewUrl(preview.previewUrl);
		setFramePath(currentPath);
	}

	const isMobileViewport = viewport === "mobile";
	// The button shows the icon of the next view, not of the current view.
	// Users read a phone icon on the desktop view as "now on mobile".
	const nextViewport: WebViewport = isMobileViewport ? "desktop" : "mobile";
	const ViewportIcon = isMobileViewport ? MonitorIcon : DeviceMobileIcon;

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

	function navigateTo(path: string) {
		setCurrentPath(path);
		// The same src does not reload the iframe, so a pick of the frame page mints a new URL instead.
		if (path === framePath) onReload();
		else setFramePath(path);
	}

	function openInNewTab() {
		if (preview.previewUrl === null) return;
		window.open(
			previewSrcFor(preview.previewUrl, currentPath),
			"_blank",
			"noopener,noreferrer",
		);
	}

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
			case "wandit:route":
				// Only the capsule follows the app. A new src would reload the page the app shows already.
				setCurrentPath(message.path);
				return;
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* No Back or Forward: the page cannot read the history of the cross-origin preview frame. */}
			<div className="flex h-12 shrink-0 items-center justify-center gap-2 border-night/[0.07] border-b px-3 dark:border-white/[0.07]">
				<div className="flex h-9 min-w-0 max-w-[680px] flex-1 items-center gap-0.5 rounded-full bg-night/[0.045] px-1 dark:bg-white/[0.06]">
					<IconAction
						label={t(
							nextViewport === "mobile"
								? "appBuilder.viewport.switchToMobile"
								: "appBuilder.viewport.switchToDesktop",
						)}
					>
						<Button
							variant="ghost"
							size="icon-sm"
							className={CAPSULE_BUTTON_CLASS}
							onClick={() => onChangeViewport(nextViewport)}
						>
							<ViewportIcon aria-hidden weight="bold" className="size-4" />
						</Button>
					</IconAction>
					<span
						aria-hidden
						className="mx-0.5 h-4 w-px shrink-0 bg-night/[0.1] dark:bg-white/[0.1]"
					/>
					<RoutePicker
						projectId={project.id}
						currentPath={currentPath}
						onNavigate={navigateTo}
					/>
					{/* The public host of the app links to the live app. The real sandbox host stays inside the iframe. */}
					{liveUrl === undefined ? null : liveUrl === null ? (
						<span className="min-w-0 max-w-[40%] truncate px-2 text-[12.5px] text-night/50 dark:text-foreground/50">
							{t("appBuilder.publish.notLive")}
						</span>
					) : (
						<Tooltip>
							<TooltipTrigger asChild>
								<a
									href={liveUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="flex min-w-0 max-w-[40%] items-center gap-1.5 rounded-full px-2 text-[12.5px] text-night/50 outline-none transition-colors hover:text-night focus-visible:ring-2 focus-visible:ring-ember/30 dark:text-foreground/50 dark:hover:text-foreground"
								>
									<GlobeSimpleIcon
										aria-hidden
										weight="bold"
										className="size-3.5 shrink-0"
									/>
									{/* A host reads left to right in every locale. */}
									<span dir="ltr" className="truncate">
										{new URL(liveUrl).host}
									</span>
								</a>
							</TooltipTrigger>
							<TooltipContent side="bottom">
								{t("appBuilder.publish.open")}
							</TooltipContent>
						</Tooltip>
					)}
					<IconAction label={t("appBuilder.topBar.reload")}>
						<Button
							variant="ghost"
							size="icon-sm"
							className={CAPSULE_BUTTON_CLASS}
							onClick={onReload}
						>
							<ArrowClockwiseIcon
								aria-hidden
								weight="bold"
								className="size-4"
							/>
						</Button>
					</IconAction>
					<IconAction label={t("appBuilder.topBar.openExternal")}>
						<Button
							variant="ghost"
							size="icon-sm"
							className={CAPSULE_BUTTON_CLASS}
							disabled={preview.previewUrl === null}
							onClick={openInNewTab}
						>
							<ArrowSquareOutIcon
								aria-hidden
								weight="bold"
								className="size-4 rtl:-scale-x-100"
							/>
						</Button>
					</IconAction>
				</div>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-pressed={isSelecting}
							disabled={!canStartTurn || !hasBridge}
							onClick={() => onSelectingChange(!isSelecting)}
							// The spark tint of a picked kit row marks the active mode.
							className={cn(
								"h-9 shrink-0 gap-1.5 rounded-full px-3 font-grotesk font-medium text-[13px] text-night/70 hover:bg-night/[0.06] hover:text-night disabled:opacity-40 dark:text-foreground/70 dark:hover:bg-white/[0.08] dark:hover:text-foreground",
								isSelecting &&
									"bg-spark/[0.14] text-night hover:bg-spark/20 dark:text-foreground dark:hover:bg-spark/20",
							)}
						>
							<CrosshairIcon aria-hidden weight="bold" className="size-4" />
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
					className="flex shrink-0 items-center gap-3 border-night/[0.07] border-b bg-destructive/[0.06] px-4 py-2.5 dark:border-white/[0.07]"
				>
					<WarningIcon
						aria-hidden
						weight="fill"
						className="size-[18px] shrink-0 text-destructive"
					/>
					<div className="min-w-0 flex-1">
						<p className="font-grotesk font-semibold text-[13.5px] text-night dark:text-foreground">
							{t("appBuilder.preview.errors.title")}
						</p>
						<p
							dir="auto"
							className="truncate text-[12.5px] text-night/60 dark:text-foreground/60"
						>
							{firstError.message}
						</p>
					</div>
					{runtimeErrors.count > 1 ? (
						<span className="shrink-0 text-[12.5px] text-night/50 dark:text-foreground/50">
							{t("appBuilder.preview.errors.count", {
								count: runtimeErrors.count,
							})}
						</span>
					) : null}
					<Button
						size="sm"
						className={FIX_BUTTON_CLASS}
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
			<div
				className={cn(
					// A size container: the phone width reads the stage height in `cqh`.
					"relative flex min-h-0 flex-1 items-center justify-center overflow-hidden transition-[padding] [container-type:size]",
					VIEWPORT_MOTION_CLASS,
					// The padding leaves room for the 11 px bezel and the drop shadow of the phone.
					isMobileViewport && "px-4 py-8",
				)}
			>
				{/* The dots get their own layer. The mask of `bg-dots` fades the element and all its children. */}
				<div
					aria-hidden
					className={cn(
						"pointer-events-none absolute inset-0 bg-dots transition-opacity",
						VIEWPORT_MOTION_CLASS,
						isMobileViewport ? "opacity-100" : "opacity-0",
					)}
				/>
				<PreviewPanel
					projectId={project.id}
					preview={preview}
					path={framePath}
					title={t("appBuilder.preview.frameTitle", { name: project.name })}
					className={cn(
						"bg-night transition-[width,height,border-radius,box-shadow]",
						VIEWPORT_MOTION_CLASS,
						// The mobile view is a phone on the dotted stage: a black bezel, a thin rim, and a soft drop.
						// Shadows draw the body, so the panel needs no wrapper and the iframe never reloads on a switch.
						// The desktop view fills the stage, and the card clips the corners.
						isMobileViewport
							? "rounded-[48px] shadow-[0_0_0_10px_#000,0_0_0_11px_rgb(11_16_51/0.3),0_16px_32px_-20px_rgb(11_16_51/0.5)] dark:shadow-[0_0_0_10px_#000,0_0_0_11px_rgb(255_255_255/0.14)]"
							: "rounded-none",
					)}
					// CSS animates a size from 100 % to px and back, so the app reflows during the move.
					// The max values keep the phone inside a small card: it gets narrower or shorter, never cut.
					style={{
						width: isMobileViewport ? MOBILE_FRAME_WIDTH : "100%",
						height: isMobileViewport ? MOBILE_VIEWPORT_HEIGHT_PX : "100%",
						maxWidth: "100%",
						maxHeight: "100%",
					}}
					bootContext={bootContext}
					isSelecting={isSelecting}
					onBridgeMessage={onBridgeMessage}
					onFrameLoad={() => setIsReloadPending(false)}
				/>
			</div>
		</div>
	);
}
