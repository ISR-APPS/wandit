/**
 * The one iframe both previews render. It mints the signed sandbox URL
 * through usePreviewToken. PreviewBootScreen covers the frame until the
 * app page loads, and while the project holds only the template; the
 * error state has its own alert. WebPreview and
 * PhonePreview wrap it in their chrome. The page keeps it mounted across
 * the views. The Vite HMR WebSocket of the app inside then survives a
 * view switch. It tells the dev bridge of the app when the select mode
 * starts or stops, and passes the bridge messages to `onBridgeMessage`.
 */

import type { PreviewBridgeMessage } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
	type CSSProperties,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";

import { useTranslation } from "@/lib/i18n";
import type { BootContext } from "../../lib/boot-state";
import { BOOT_EASE } from "../../lib/constants";
import { usePreviewMessages } from "../../lib/use-preview-messages";
import {
	type PreviewTokenDeps,
	usePreviewToken,
} from "../../lib/use-preview-token";
import { PreviewBootScreen } from "./preview-boot-screen";

// The generated app must not navigate the builder: no allow-top-navigation.
// The frame is on the `wanditpreview.app` origin, not the builder origin.
// So allow-same-origin with allow-scripts gives the app its own cookies only.
const PREVIEW_IFRAME_SANDBOX =
	"allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

/** Props of the preview iframe panel. */
export type PreviewPanelProps = {
	/** The open project. The hook mints its preview token; the boot screen wakes its sandbox. */
	projectId: string;
	/** Accessible name of the iframe. The parent builds it from the project name. */
	title: string;
	/** Bump from the reload button. A change mints a new token; the new src reloads the frame. */
	reloadKey: number;
	/** Classes of the panel box that holds the iframe. The web preview draws the side borders of the narrow viewports here. */
	className: string;
	/** Inline styles of the panel box. The web preview sets the viewport width here; a width change never touches src. */
	style?: CSSProperties;
	/**
	 * Layout width of the app in CSS px, and the scale that fits it into the
	 * box. The phone preview passes the device width; the web preview leaves
	 * it out and the iframe fills the box.
	 */
	frameViewport?: { widthPx: number; scale: number };
	/** The running turn and the backend state. The boot screen shows the real start-up steps from them. */
	bootContext: BootContext;
	/** True while the user picks elements in the app. Only the web preview turns it on. */
	isSelecting?: boolean;
	/** Gets each valid message of the dev bridge in the app: ready, a runtime error, a pick, or Escape. */
	onBridgeMessage?: (message: PreviewBridgeMessage) => void;
	/** Runs on each `load` of the iframe. WebPreview then shows the kept errors when no bridge said ready. */
	onFrameLoad?: () => void;
	/** Spec seam: a fake getPreviewToken. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * Renders the preview iframe once the token mint answers, under the boot
 * screen until its first `load` and a first version exists. No
 * `key={reloadKey}` on the iframe: the reload mints a new token and the new
 * src reloads the frame.
 */
export function PreviewPanel({
	projectId,
	title,
	reloadKey,
	className,
	style,
	frameViewport,
	bootContext,
	isSelecting = false,
	onBridgeMessage,
	onFrameLoad,
	deps,
}: PreviewPanelProps) {
	const { t } = useTranslation();
	const { status, previewUrl, errorText, refresh, markNotRunning } =
		usePreviewToken(projectId, reloadKey, deps);
	const frameRef = useRef<HTMLIFrameElement>(null);
	// True after the iframe fired `load`. A token swap keeps the same frame, so the boot screen does not come back.
	const [isFrameLoaded, setIsFrameLoaded] = useState(false);
	// A dropped frame (not-running, error) must show the boot screen again when the next frame mounts.
	if (previewUrl === null && isFrameLoaded) setIsFrameLoaded(false);
	// The template is not the user's app, so a loaded frame stays covered until a turn changes a file.
	// The frame still loads under the cover, so the first version shows at once when the flag flips.
	const isAppShown = isFrameLoaded && bootContext.hasCodeChanges;

	// Tells the bridge in the app to start or stop the select mode.
	const postSelectMode = useEffectEvent((active: boolean) => {
		const frameWindow = frameRef.current?.contentWindow;
		if (previewUrl === null || !frameWindow) return;
		// The exact preview origin, never "*": no other page may get the message.
		frameWindow.postMessage(
			{ type: "wandit:select-mode", active },
			new URL(previewUrl).origin,
		);
	});
	useEffect(() => {
		postSelectMode(isSelecting);
	}, [isSelecting]);

	// The proxy error pages report a dead token or a stopped sandbox. The
	// bridge in the app reports its start, errors, and picks.
	usePreviewMessages({
		previewUrl,
		frameRef,
		onTokenExpired: refresh,
		onNotRunning: markNotRunning,
		onBridgeMessage: (message) => {
			// A page load resets the bridge, so it gets the select mode again.
			if (message.type === "wandit:bridge-ready" && isSelecting) {
				postSelectMode(true);
			}
			onBridgeMessage?.(message);
		},
	});

	if (status === "error") {
		return (
			<div
				role="alert"
				className={cn(
					// The alert sits on the void stage, so it takes the dark tokens.
					"dark flex flex-col items-center justify-center gap-3 px-4",
					className,
				)}
				style={style}
			>
				<p className="text-center text-muted-foreground text-sm">{errorText}</p>
				<Button variant="outline" size="sm" onClick={refresh}>
					{t("appBuilder.preview.retry")}
				</Button>
			</div>
		);
	}

	return (
		// Motion drops its transforms for users who ask for reduced motion; the fades stay.
		<MotionConfig reducedMotion="user">
			<div className={cn("relative overflow-hidden", className)} style={style}>
				{status === "ready" && previewUrl !== null ? (
					<motion.iframe
						ref={frameRef}
						src={previewUrl}
						title={title}
						sandbox={PREVIEW_IFRAME_SANDBOX}
						onLoad={() => {
							setIsFrameLoaded(true);
							onFrameLoad?.();
						}}
						// The boot screen covers the frame until the app shows, so keyboard focus and screen readers skip it.
						inert={!isAppShown}
						className="block size-full border-0 bg-transparent"
						// The iframe keeps the device width and a height that fills the
						// box after the scale. Physical top and left: the scale origin
						// is the top-left corner in RTL too.
						style={
							frameViewport === undefined
								? undefined
								: {
										position: "absolute",
										top: 0,
										left: 0,
										width: frameViewport.widthPx,
										height: `${100 / frameViewport.scale}%`,
										originX: 0,
										originY: 0,
									}
						}
						initial={false}
						animate={{
							scale: (isAppShown ? 1 : 0.985) * (frameViewport?.scale ?? 1),
						}}
						transition={{ duration: 0.38, delay: 0.04, ease: BOOT_EASE }}
					/>
				) : null}
				{/* No initial={false} here: motion keeps it in context and would skip the first fade of every later child, like the ember buttons of the drawing. */}
				<AnimatePresence>
					{isAppShown ? null : (
						<motion.div
							key="boot"
							className="absolute inset-0"
							exit="leave"
							variants={{ leave: { opacity: 0 } }}
							transition={{ duration: 0.26, ease: BOOT_EASE }}
						>
							<PreviewBootScreen
								projectId={projectId}
								tokenStatus={status}
								bootContext={bootContext}
							/>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MotionConfig>
	);
}
