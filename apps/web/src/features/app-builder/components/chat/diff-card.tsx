/**
 * Unified diff of one file of a saved version. The header shows the path,
 * the added and removed counts, and a copy button. One tinted row per line.
 * Rendered by shell/versions-popover.tsx for each file of a version diff.
 * Copy writes the signed diff text through copyToClipboard in lib/helpers.
 */

import { CopyIcon } from "@phosphor-icons/react/Copy";
import { FileCodeIcon } from "@phosphor-icons/react/FileCode";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { BuilderDiffLine } from "../../api/dto";
import { copyToClipboard } from "../../lib/helpers";
import { IconAction } from "../shell/top-bar";
import { CARD_ICON_BUTTON_CLASS, MessageCard } from "./message-card";

/** Props of one file of a version diff, as versions-popover.tsx passes them. */
export type DiffCardProps = {
	/** Path of the changed file from the repository root, for example `app/(tabs)/pass.tsx`. */
	path: string;
	/** Lines of the diff in file order, without a leading sign. The card adds the sign. */
	lines: BuilderDiffLine[];
};

/** Sign of each line kind, as a unified diff prints it in front of the text. */
const LINE_SIGN = { add: "+", remove: "-", context: " " } as const;

/** The counts come from the line kinds, so they always match the rows. */
export function DiffCard({ path, lines }: DiffCardProps) {
	const { t } = useTranslation();
	const added = lines.filter((line) => line.kind === "add").length;
	const removed = lines.filter((line) => line.kind === "remove").length;

	async function copyDiff() {
		// The sign sits in front of the text with no space, like `git diff` output.
		const text = lines
			.map((line) => `${LINE_SIGN[line.kind]}${line.text}`)
			.join("\n");
		if (await copyToClipboard(text)) toast(t("appBuilder.chat.copied"));
	}

	return (
		<MessageCard className="overflow-hidden p-0">
			<div className="flex h-10 items-center gap-2 border-night/[0.07] border-b ps-3.5 pe-2 dark:border-white/[0.07]">
				<FileCodeIcon
					weight="duotone"
					className="size-4 shrink-0 text-night/50 dark:text-foreground/50"
					aria-hidden
				/>
				<span
					dir="ltr"
					className="min-w-0 flex-1 truncate font-mono text-[12px] text-night dark:text-foreground"
				>
					{path}
				</span>
				{added > 0 ? (
					<span className="font-mono text-[12px] text-success-text tabular-nums">
						+{added}
					</span>
				) : null}
				{removed > 0 ? (
					<span className="font-mono text-[12px] text-destructive tabular-nums">
						-{removed}
					</span>
				) : null}
				<IconAction label={t("appBuilder.chat.copy")}>
					<Button
						variant="ghost"
						size="icon-sm"
						className={CARD_ICON_BUTTON_CLASS}
						onClick={() => void copyDiff()}
					>
						<CopyIcon weight="bold" aria-hidden />
					</Button>
				</IconAction>
			</div>
			<pre
				dir="ltr"
				className="scroll-warm m-0 overflow-x-auto bg-night/[0.015] py-2 font-mono text-[12px] text-night/80 leading-5 dark:bg-transparent dark:text-foreground/80"
			>
				{lines.map((line, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no id and never reorder
						key={index}
						data-line-kind={line.kind}
						className={cn(
							"flex px-3.5",
							line.kind === "add" && "bg-success/10",
							line.kind === "remove" && "bg-destructive/10",
						)}
					>
						<span className="w-4 shrink-0 select-none text-night/35 dark:text-foreground/35">
							{LINE_SIGN[line.kind]}
						</span>
						<span className="whitespace-pre">{line.text}</span>
					</div>
				))}
			</pre>
		</MessageCard>
	);
}
