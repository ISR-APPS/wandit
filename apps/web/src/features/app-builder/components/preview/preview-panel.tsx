/**
 * The one iframe both previews render. It mints the signed sandbox URL
 * through usePreviewToken. PreviewBootScreen covers the frame until the
 * app page loads; the error state has its own alert. WebPreview and
 * PhonePreview wrap it in their chrome. The page keeps it mounted across
 * the views. The Vite HMR WebSocket of the app inside then survives a
 * view switch.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { type CSSProperties, useState } from "react";

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
	/** The open project. The hook mints its preview token. */
	projectId: string;
	/** Accessible name of the iframe. The parent builds it from the project name. */
	title: string;
	/** Bump from the reload button. A change mints a new token; the new src reloads the frame. */
	reloadKey: number;
	/** Classes of the panel box that holds the iframe. The web preview draws the side borders of the narrow viewports here. */
	className: string;
	/** Inline styles of the panel box. The web preview sets the viewport width here; a width change never touches src. */
	style?: CSSProperties;
	/** The running turn and the backend state. The boot screen shows the real start-up steps from them. */
	bootContext: BootContext;
	/** Spec seam: a fake getPreviewToken. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * Renders the preview iframe once the token mint answers, under the boot
 * screen until its first `load`. No `key={reloadKey}` on the iframe: the
 * reload mints a new token and the new src reloads the frame.
 */
export function PreviewPanel({
	projectId,
	title,
	reloadKey,
	className,
	style,
	bootContext,
	deps,
}: PreviewPanelProps) {
	const { t } = useTranslation();
	const { status, previewUrl, errorText, refresh, markNotRunning } =
		usePreviewToken(projectId, reloadKey, deps);
	// True after the iframe fired `load`. A token swap keeps the same frame, so the boot screen does not come back.
	const [isFrameLoaded, setIsFrameLoaded] = useState(false);
	// A dropped frame (not-running, error) must show the boot screen again when the next frame mounts.
	if (previewUrl === null && isFrameLoaded) setIsFrameLoaded(false);

	// The proxy error pages report a dead token or a stopped sandbox.
	usePreviewMessages({
		previewUrl,
		onTokenExpired: refresh,
		onNotRunning: markNotRunning,
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
						src={previewUrl}
						title={title}
						sandbox={PREVIEW_IFRAME_SANDBOX}
						onLoad={() => setIsFrameLoaded(true)}
						// The boot screen covers the frame until load, so keyboard focus and screen readers skip it.
						inert={!isFrameLoaded}
						className="block size-full border-0 bg-transparent"
						initial={false}
						animate={{ scale: isFrameLoaded ? 1 : 0.985 }}
						transition={{ duration: 0.38, delay: 0.04, ease: BOOT_EASE }}
					/>
				) : null}
				{/* No initial={false} here: motion keeps it in context and would skip the first fade of every later child, like the ember buttons of the drawing. */}
				<AnimatePresence>
					{isFrameLoaded ? null : (
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
