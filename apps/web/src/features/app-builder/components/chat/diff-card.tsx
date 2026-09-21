/**
 * Unified diff of one file the turn changed. The header shows the path, the
 * added and removed counts, and a copy button. One tinted row per line.
 * Rendered by chat-message.tsx for each `data-diff` part.
 * Copy writes the signed diff text through copyToClipboard in lib/helpers.
 */

import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { Code, Copy } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { BuilderDiffLine } from "../../api/dto";
import { copyToClipboard } from "../../lib/helpers";
import { MessageCard } from "./message-card";

/** Props of one `data-diff` part, as chat-message.tsx passes them. */
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
		<MessageCard className="overflow-hidden">
			<div className="flex h-9 items-center gap-2 border-b px-3">
				<Code className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
				<span
					dir="ltr"
					className="min-w-0 flex-1 truncate font-mono text-[12px]"
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
				<Button
					variant="ghost"
					size="icon-xs"
					className="text-muted-foreground"
					aria-label={t("appBuilder.chat.copy")}
					onClick={() => void copyDiff()}
				>
					<Copy />
				</Button>
			</div>
			<pre
				dir="ltr"
				className="scroll-warm m-0 overflow-x-auto py-2 font-mono text-[12px] leading-5"
			>
				{lines.map((line, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: diff lines have no id and never reorder
						key={index}
						data-line-kind={line.kind}
						className={cn(
							"flex px-3",
							line.kind === "add" && "bg-success/10",
							line.kind === "remove" && "bg-destructive/10",
						)}
					>
						<span className="w-4 shrink-0 select-none text-muted-foreground">
							{LINE_SIGN[line.kind]}
						</span>
						<span className="whitespace-pre">{line.text}</span>
					</div>
				))}
			</pre>
		</MessageCard>
	);
}
