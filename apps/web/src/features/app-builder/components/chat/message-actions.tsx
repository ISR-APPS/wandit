/**
 * The Copy action under an assistant message: it copies the final answer.
 * Rendered by chat-message.tsx. Copy writes to the clipboard through
 * lib/helpers.ts and confirms with a toast. The button gets its tooltip and
 * its accessible name from IconAction of the top bar.
 */

import { CopyIcon } from "@phosphor-icons/react/Copy";
import { Button } from "@wandit/ui/components/button";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { copyToClipboard } from "../../lib/helpers";
import { IconAction } from "../shell/top-bar";

/** Props of the Copy action, as chat-message.tsx passes them. */
export type MessageActionsProps = {
	/** Text the copy action writes to the clipboard: the text parts of the message. */
	text: string;
};

// Quieter and smaller than the bar buttons: the button sits under the prose and must not compete with it.
const ACTION_BUTTON_CLASS =
	"-my-1 -ms-1.5 size-7 self-start text-night/40 hover:bg-night/[0.05] hover:text-night dark:text-foreground/40 dark:hover:bg-white/[0.06] dark:hover:text-foreground [&_svg:not([class*='size-'])]:size-[15px]";

/** One quiet ghost Copy button with its tooltip. The label is also the accessible name. */
export function MessageActions({ text }: MessageActionsProps) {
	const { t } = useTranslation();

	async function copyText() {
		if (await copyToClipboard(text)) toast(t("appBuilder.chat.copied"));
	}

	return (
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
	);
}
