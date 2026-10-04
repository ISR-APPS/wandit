/**
 * One element the user picked in the preview (WANDIT-203): the file name and
 * the line in mono, then the text of the element. composer.tsx shows it with
 * a remove button; the user bubble in chat-message.tsx shows it without one.
 */

import type { PreviewTarget } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { Crosshair, X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

/** Props of one target chip. composer.tsx passes `onRemove`; the user bubble does not. */
export type TargetChipProps = {
	/** The picked element. `src` is `file:line:col`; `label` can be "". */
	target: PreviewTarget;
	/** Removes the chip from the next turn. Absent on a sent message. */
	onRemove?: () => void;
};

/** One chip: `index.tsx:42` in mono, then the label, or the tag when the label is "". */
export function TargetChip({ target, onRemove }: TargetChipProps) {
	const { t } = useTranslation();
	// `previewTargetSchema` checked the `file:line:col` form, so the match holds.
	const [, file = target.src, line = ""] =
		/^(.*):(\d+):\d+$/.exec(target.src) ?? [];
	const fileName = file.split("/").pop();
	// An element with no text, like an icon, shows its tag.
	const name = target.label || target.tag;

	return (
		<span
			title={target.src}
			className={cn(
				"flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 ps-2.5 text-primary text-xs",
				onRemove ? "pe-1" : "pe-2.5",
			)}
		>
			<Crosshair className="size-3 shrink-0" aria-hidden />
			<bdi dir="ltr" className="shrink-0 font-mono">
				{fileName}:{line}
			</bdi>
			<span dir="auto" className="min-w-0 truncate">
				{name}
			</span>
			{onRemove ? (
				<button
					type="button"
					aria-label={t("appBuilder.chat.removeTarget", { label: name })}
					onClick={onRemove}
					className="grid size-4 shrink-0 place-items-center rounded-full outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50"
				>
					<X className="size-3" />
				</button>
			) : null}
		</span>
	);
}
