/**
 * Row of three small actions under an assistant message that saved a
 * version: revert, like, and copy the message text.
 * Rendered by chat-message.tsx. Copy writes to the clipboard through
 * lib/helpers.ts; the other two actions belong to the caller. Each button
 * gets its tooltip and its accessible name from IconAction of the top bar.
 */

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/ArrowCounterClockwise";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { ThumbsUpIcon } from "@phosphor-icons/react/ThumbsUp";
import { Button } from "@wandit/ui/components/button";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { copyToClipboard } from "../../lib/helpers";
import { IconAction } from "../shell/top-bar";

export type MessageActionsProps = {
	/** Reverts to the version of the message. chat-message.tsx passes the notWired toast. */
	onRevert: () => void;
	/** Rates the reply. chat-message.tsx passes the notWired toast. */
	onLike: () => void;
	/** Text the copy action writes to the clipboard: the text parts of the message. */
	text: string;
};

// Quieter and smaller than the bar buttons: the row sits under the prose and must not compete with it.
const ACTION_BUTTON_CLASS =
	"size-7 text-night/40 hover:bg-night/[0.05] hover:text-night dark:text-foreground/40 dark:hover:bg-white/[0.06] dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-[15px]";

/** Three quiet icon buttons under a reply that saved a version; each has a tooltip. */
export function MessageActions({
	onRevert,
	onLike,
	text,
}: MessageActionsProps) {
	const { t } = useTranslation();

	async function copyText() {
		if (await copyToClipboard(text)) toast(t("appBuilder.chat.copied"));
	}

	return (
		<div className="-my-1 -ms-1.5 flex items-center gap-0.5">
			<IconAction label={t("appBuilder.chat.revert")}>
				<Button
					variant="ghost"
					size="icon-sm"
					className={ACTION_BUTTON_CLASS}
					onClick={onRevert}
				>
					{/* The arrow turns back against the reading direction, so it mirrors in RTL. */}
					<ArrowCounterClockwiseIcon
						weight="bold"
						className="rtl:-scale-x-100"
						aria-hidden
					/>
				</Button>
			</IconAction>
			<IconAction label={t("appBuilder.chat.like")}>
				<Button
					variant="ghost"
					size="icon-sm"
					className={ACTION_BUTTON_CLASS}
					onClick={onLike}
				>
					<ThumbsUpIcon weight="bold" aria-hidden />
				</Button>
			</IconAction>
			<IconAction label={t("appBuilder.chat.copy")}>
				<Button
					variant="ghost"
					size="icon-sm"
					className={ACTION_BUTTON_CLASS}
					onClick={() => void copyText()}
				>
					<CopyIcon weight="bold" aria-hidden />
				</Button>
			</IconAction>
		</div>
	);
}
