/**
 * Web preview of a web project. pages/app-builder-page.tsx renders it.
 * A stage bar holds one address capsule: viewport toggle, page picker, reload, and open in a new tab.
 * Below it, the app shows at full width or in a phone of iPhone shape. The toggle animates the change.
 * It gets the preview URL from usePreviewToken and gives it to PreviewPanel, which shows the iframe.
 * RoutePicker lists the pages of the app.
 */

import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/ArrowSquareOut";
import { DeviceMobileIcon } from "@phosphor-icons/react/DeviceMobile";
import { MonitorIcon } from "@phosphor-icons/react/Monitor";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { useState } from "react";

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
	type PreviewTokenDeps,
	usePreviewToken,
} from "../../lib/use-preview-token";
import { IconAction, TOOLBAR_ICON_BUTTON_CLASS } from "../shell/top-bar";
import { PreviewPanel } from "./preview-panel";
import { RoutePicker } from "./route-picker";

// The capsule buttons are one step smaller than the bar buttons, so they fit the 36 px capsule.
const CAPSULE_BUTTON_CLASS = cn(TOOLBAR_ICON_BUTTON_CLASS, "size-7");

// The stage padding, the dots, and the frame move together on a toggle. So the frame stays centered.
// The ease is the quick start and long settle of an iOS sheet.
const VIEWPORT_MOTION_CLASS =
	"duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

// The phone gets narrower on a short stage to keep the iPhone shape. 320 px is the
// smallest phone in use (iPhone SE), so the app never lays out narrower than that.
const MOBILE_FRAME_WIDTH = `clamp(320px, calc(100cqh * ${MOBILE_VIEWPORT_WIDTH_PX} / ${MOBILE_VIEWPORT_HEIGHT_PX}), ${MOBILE_VIEWPORT_WIDTH_PX}px)`;

/** Props of the web preview. The page reads them from the URL and the project query. */
export type WebPreviewProps = {
	/** The open project. `name` fills the iframe title, `id` mints the preview token and lists the routes. */
	project: AppProject;
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
	viewport,
	onChangeViewport,
	reloadKey,
	onReload,
	bootContext,
	deps,
}: WebPreviewProps) {
	const { t } = useTranslation();
	const preview = usePreviewToken(project.id, reloadKey, deps);
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

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex h-12 shrink-0 items-center justify-center border-night/[0.07] border-b px-3 dark:border-white/[0.07]">
				<div className="flex h-9 w-full max-w-[680px] items-center gap-0.5 rounded-full bg-night/[0.045] px-1 dark:bg-white/[0.06]">
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
			</div>
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
					preview={preview}
					path={framePath}
					onRouteChange={setCurrentPath}
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
				/>
			</div>
		</div>
	);
}
