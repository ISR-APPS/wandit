/**
 * Row of three small actions under an assistant message that saved a
 * version: revert, like, and copy the message text.
 * Rendered by chat-message.tsx. Copy writes to the clipboard through
 * lib/helpers.ts; the other two actions belong to the caller.
 */

import { Button } from "@wandit/ui/components/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@wandit/ui/components/tooltip";
import { Copy, ThumbsUp, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { copyToClipboard } from "../../lib/helpers";

export type MessageActionsProps = {
	onRevert: () => void;
	onLike: () => void;
	/** Text the copy action writes to the clipboard: the text parts of the message. */
	text: string;
};

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
		<div className="flex items-center gap-1">
			<ActionButton label={t("appBuilder.chat.revert")} onClick={onRevert}>
				<Undo2 className="rtl:rotate-180" />
			</ActionButton>
			<ActionButton label={t("appBuilder.chat.like")} onClick={onLike}>
				<ThumbsUp />
			</ActionButton>
			<ActionButton
				label={t("appBuilder.chat.copy")}
				onClick={() => void copyText()}
			>
				<Copy />
			</ActionButton>
		</div>
	);
}

/** One ghost icon button with its tooltip. The label is also the accessible name. */
function ActionButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground"
					aria-label={label}
					onClick={onClick}
				>
					{children}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom">{label}</TooltipContent>
		</Tooltip>
	);
}
