/**
 * The one iframe both previews render. WebPreview and PhonePreview mint the
 * signed sandbox URL with usePreviewToken and pass the result here, so their
 * bars can read the URL too. PreviewBootScreen covers the frame until the
 * app page loads, and while the project holds only the template; the error
 * state has its own alert. The page keeps it mounted across the views. The
 * Vite HMR WebSocket of the app inside then survives a view switch.
 * usePreviewMessages reports the page the app shows through `onRouteChange`.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type CSSProperties, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type { BootContext } from "../../lib/boot-state";
import { BOOT_EASE } from "../../lib/constants";
import { previewSrcFor } from "../../lib/helpers";
import { usePreviewMessages } from "../../lib/use-preview-messages";
import type { UsePreviewToken } from "../../lib/use-preview-token";
import { PreviewBootScreen } from "./preview-boot-screen";

// The generated app must not navigate the builder: no allow-top-navigation.
// The frame is on the `wanditpreview.app` origin, not the builder origin.
// So allow-same-origin with allow-scripts gives the app its own cookies only.
const PREVIEW_IFRAME_SANDBOX =
	"allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

/** Props of the preview iframe panel. */
export type PreviewPanelProps = {
	/** The token state and its commands, from usePreviewToken in the parent. A new URL reloads the frame. */
	preview: UsePreviewToken;
	/** Page of the app to load, like `/` or `/login?next=%2F`. A change loads that page. Default `/`. */
	path?: string;
	/** Accessible name of the iframe. The parent builds it from the project name. */
	title: string;
	/** Classes of the panel box that holds the iframe. The web preview draws the rounded sheet of the mobile viewport here. */
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
	/** Gets the pathname and query of each page the app shows. Only apps with the route bridge of the web template report it. */
	onRouteChange?: (path: string) => void;
};

/**
 * Renders the preview iframe once the token mint answers, under the boot
 * screen until its first `load` and a first version exists. No key on the
 * iframe: a reload mints a new token, and the new src reloads the frame.
 */
export function PreviewPanel({
	preview,
	path = "/",
	title,
	className,
	style,
	frameViewport,
	bootContext,
	onRouteChange,
}: PreviewPanelProps) {
	const { t } = useTranslation();
	const { status, previewUrl, errorText, refresh, markNotRunning } = preview;
	// True after the iframe fired `load`. A token swap keeps the same frame, so the boot screen does not come back.
	const [isFrameLoaded, setIsFrameLoaded] = useState(false);
	// A dropped frame (not-running, error) must show the boot screen again when the next frame mounts.
	if (previewUrl === null && isFrameLoaded) setIsFrameLoaded(false);
	// The template is not the user's app, so a loaded frame stays covered until a turn changes a file.
	// The frame still loads under the cover, so the first version shows at once when the flag flips.
	const isAppShown = isFrameLoaded && bootContext.hasCodeChanges;

	// The proxy error pages report a dead token or a stopped sandbox. The app reports its page.
	usePreviewMessages({
		previewUrl,
		onTokenExpired: refresh,
		onNotRunning: markNotRunning,
		onRoute: onRouteChange,
	});

	if (status === "error") {
		return (
			<div
				role="alert"
				className={cn(
					// Both callers draw the panel on a night ground, so the alert takes the dark tokens.
					// `relative` paints it over the dotted layer of the web stage, like the normal root.
					"dark relative flex flex-col items-center justify-center gap-3 px-4",
					className,
				)}
				style={style}
			>
				<p className="text-center text-sm text-white/70">{errorText}</p>
				{/* The amber pill of the device card in device-panel.tsx. It reads on the night ground in both themes. */}
				<Button
					size="sm"
					className="bg-spark px-4 font-grotesk font-semibold text-night hover:bg-spark/90"
					onClick={refresh}
				>
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
						src={previewSrcFor(previewUrl, path)}
						title={title}
						sandbox={PREVIEW_IFRAME_SANDBOX}
						onLoad={() => setIsFrameLoaded(true)}
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
				{/* No initial={false} here: motion keeps it in context and would skip the first fade of every later child, like the amber buttons of the drawing. */}
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
