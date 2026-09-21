/**
 * The one iframe both previews render. It mints the signed sandbox URL
 * through usePreviewToken. It shows the loading, waking, and error
 * states until the first URL lands. WebPreview and PhonePreview wrap it
 * in their chrome. The page keeps it mounted across the views. The Vite
 * HMR WebSocket of the app inside then survives a view switch.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { LoaderCircle } from "lucide-react";
import type { CSSProperties } from "react";

import { useTranslation } from "@/lib/i18n";
import { usePreviewMessages } from "../../lib/use-preview-messages";
import {
	type PreviewTokenDeps,
	usePreviewToken,
} from "../../lib/use-preview-token";

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
	/** Classes of the panel box. The web preview draws the side borders of the narrow viewports here. */
	className: string;
	/** Inline box styles. The web preview sets the viewport width here; a width change never touches src. */
	style?: CSSProperties;
	/** Spec seam: a fake getPreviewToken. Production callers leave it out. */
	deps?: PreviewTokenDeps;
};

/**
 * Renders the real preview iframe once the token mint answers, and the
 * state columns before it. No `key={reloadKey}` on the iframe: the
 * reload mints a new token and the new src reloads the frame.
 */
export function PreviewPanel({
	projectId,
	title,
	reloadKey,
	className,
	style,
	deps,
}: PreviewPanelProps) {
	const { t } = useTranslation();
	const { status, previewUrl, errorText, refresh, markNotRunning } =
		usePreviewToken(projectId, reloadKey, deps);

	// The proxy error pages report a dead token or a stopped sandbox.
	usePreviewMessages({
		previewUrl,
		onTokenExpired: refresh,
		onNotRunning: markNotRunning,
	});

	if (status === "ready" && previewUrl !== null) {
		return (
			<iframe
				src={previewUrl}
				title={title}
				sandbox={PREVIEW_IFRAME_SANDBOX}
				className={className}
				style={style}
			/>
		);
	}

	if (status === "error") {
		return (
			<div
				role="alert"
				className={cn(
					"flex flex-col items-center justify-center gap-3 px-4",
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
		<div
			role="status"
			className={cn(
				"flex flex-col items-center justify-center gap-3",
				className,
			)}
			style={style}
		>
			<LoaderCircle className="size-5 animate-spin text-muted-foreground" />
			{status === "waking" ? (
				<p className="text-muted-foreground text-sm">
					{t("appBuilder.preview.waking")}
				</p>
			) : null}
		</div>
	);
}
