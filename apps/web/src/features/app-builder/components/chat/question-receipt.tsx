/**
 * One question of the agent in the thread. The answer happens in the
 * request tray on the composer, so the thread keeps one short line: the
 * question in the tray gets a chip that points down, an answered one gets
 * a check (the user bubble below holds the answer). Rendered by
 * chat-message.tsx for each `data-question` part.
 */

import { CircleCheck } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { TrayPointerChip } from "./request-tray/tray-signals";

/** Props of one `data-question` part, as chat-message.tsx passes them. */
export type QuestionReceiptProps = {
	/** Question text as the agent wrote it. */
	question: string;
	/** True once a later reply exists (lib/turn-parts.ts). */
	isAnswered: boolean;
	/** True while the tray on the composer shows this question. */
	isInTray: boolean;
};

/** One thread line per question: a check once answered, a pointer chip while in the tray. */
export function QuestionReceipt({
	question,
	isAnswered,
	isInTray,
}: QuestionReceiptProps) {
	const { t } = useTranslation();
	// The harness sends "" for an ask_user call it cannot read (claude-code.harness.ts).
	const text =
		question === "" ? t("appBuilder.chat.askUser.untitled") : question;

	if (isAnswered) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground text-sm">
				<CircleCheck className="size-4 shrink-0" aria-hidden />
				<span className="sr-only">{t("appBuilder.chat.askUser.answered")}</span>
				<span dir="auto" className="min-w-0">
					{text}
				</span>
			</div>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-2 text-sm">
			<span dir="auto" className="min-w-0 font-medium">
				{text}
			</span>
			{/* The chip only points at a tray that shows; after the skip X it hides. */}
			{isInTray ? (
				<TrayPointerChip label={t("appBuilder.chat.askUser.answerBelow")} />
			) : null}
		</div>
	);
}
