/**
 * The "Try to fix" error banner under the bar of both previews. WebPreview and
 * PhonePreview render it with the errors of usePreviewRuntimeErrors, after the
 * turn ends. Its button sends one chat message that tryToFixMessage builds.
 */

import { WarningIcon } from "@phosphor-icons/react/Warning";
import { Button } from "@wandit/ui/components/button";

import { useTranslation } from "@/lib/i18n";
import {
	type PreviewRuntimeError,
	tryToFixMessage,
} from "../../lib/use-preview-runtime-errors";

// The amber pill of the retry button in preview-panel.tsx. "Try to fix" is the one action of the banner.
const FIX_BUTTON_CLASS =
	"shrink-0 bg-spark px-4 font-grotesk font-semibold text-night hover:bg-spark/90";

/** Props of the error banner. Both previews pass the state of usePreviewRuntimeErrors. */
export type PreviewErrorBannerProps = {
	/** The kept errors, oldest first, from usePreviewRuntimeErrors. The first one shows. An empty list renders nothing. */
	errors: PreviewRuntimeError[];
	/** New errors since the last clear. Above 1, the banner shows the count. */
	count: number;
	/** False while a turn runs or the chat loads. Then "Try to fix" is disabled. */
	canStartTurn: boolean;
	/** Sends the "Try to fix" text as one chat message. */
	onTryToFix: (message: string) => void;
};

/** One alert row: the first error, the count, and the "Try to fix" button. */
export function PreviewErrorBanner({
	errors,
	count,
	canStartTurn,
	onTryToFix,
}: PreviewErrorBannerProps) {
	const { t } = useTranslation();
	const firstError = errors[0];
	if (firstError === undefined) {
		return null;
	}
	return (
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
			{count > 1 ? (
				<span className="shrink-0 text-[12.5px] text-night/50 dark:text-foreground/50">
					{t("appBuilder.preview.errors.count", { count })}
				</span>
			) : null}
			<Button
				size="sm"
				className={FIX_BUTTON_CLASS}
				disabled={!canStartTurn}
				onClick={() =>
					onTryToFix(
						tryToFixMessage(t("appBuilder.preview.errors.fixPrompt"), errors),
					)
				}
			>
				{t("appBuilder.preview.errors.tryToFix")}
			</Button>
		</div>
	);
}
