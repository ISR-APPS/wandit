/**
 * One element the user picked in the preview (WANDIT-203): the file name and
 * the line in mono, then the text of the element, on a soft spark pill.
 * composer.tsx shows it with a remove button; the user bubble in
 * chat-message.tsx shows it without one.
 */

import { CrosshairIcon } from "@phosphor-icons/react/Crosshair";
import { XIcon } from "@phosphor-icons/react/X";
import type { PreviewTarget } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";

import { useTranslation } from "@/lib/i18n";
import { IconAction } from "../shell/top-bar";

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
				"flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-full bg-spark/[0.16] ps-2.5 font-grotesk font-medium text-[12px] text-night dark:bg-spark/[0.14] dark:text-foreground",
				onRemove ? "pe-1" : "pe-2.5",
			)}
		>
			<CrosshairIcon
				weight="bold"
				className="size-3.5 shrink-0 text-spark-deep dark:text-spark"
				aria-hidden
			/>
			<bdi
				dir="ltr"
				className="shrink-0 font-mono font-normal text-night/70 dark:text-foreground/70"
			>
				{fileName}:{line}
			</bdi>
			<span dir="auto" className="min-w-0 truncate">
				{name}
			</span>
			{onRemove ? (
				<IconAction label={t("appBuilder.chat.removeTarget", { label: name })}>
					<button
						type="button"
						onClick={onRemove}
						className="grid size-5 shrink-0 place-items-center rounded-full text-night/50 outline-none transition-colors hover:bg-night/[0.08] hover:text-night focus-visible:ring-2 focus-visible:ring-ember/40 dark:text-foreground/50 dark:hover:bg-white/[0.1] dark:hover:text-foreground"
					>
						<XIcon weight="bold" className="size-3" aria-hidden />
					</button>
				</IconAction>
			) : null}
		</span>
	);
}
