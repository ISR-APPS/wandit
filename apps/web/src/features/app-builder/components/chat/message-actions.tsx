/**
 * The Copy action under an assistant message: it copies the final answer.
 * Rendered by chat-message.tsx. Copy writes to the clipboard through
 * lib/helpers.ts and confirms with a toast.
 */

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { copyToClipboard } from "../../lib/helpers";

/** Props of the Copy action, as chat-message.tsx passes them. */
export type MessageActionsProps = {
	/** Text the copy action writes to the clipboard: the text parts of the message. */
	text: string;
};

/** One ghost Copy button with its tooltip. The label is also the accessible name. */
export function MessageActions({ text }: MessageActionsProps) {
	const { t } = useTranslation();
	const label = t("appBuilder.chat.copy");

	async function copyText() {
		if (await copyToClipboard(text)) toast(t("appBuilder.chat.copied"));
	}

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					className="self-start text-muted-foreground"
					aria-label={label}
					onClick={() => void copyText()}
				>
					<Copy />
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
