/**
 * Read-only file viewer of the Code view: the path breadcrumb, the sync
 * state, the GitHub and Edit code controls, then the file lines with a
 * number gutter and colored tokens from lib/code-highlight.ts.
 * Rendered by components/code/code-view.tsx with the file it loaded.
 */

import { Button } from "@wandit/ui/components/button";
import { Switch } from "@wandit/ui/components/switch";
import { useId } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import type { CodeFile } from "../../api/dto";
import { type CodeToken, tokenizeLine } from "../../lib/code-highlight";

export type CodeViewerProps = {
	/** The open file, or null when the path is not in the repository. */
	file: CodeFile | null;
	/** Git branch of the snapshot, shown next to the sync dot. */
	branch: string;
	/** Path of the breadcrumb. Also set when the file is null. */
	selectedPath: string;
};

/** Text color of each token kind. Plain tokens keep the color of the `pre`. */
const TOKEN_CLASS: Record<CodeToken["kind"], string | undefined> = {
	keyword: "text-ember-strong",
	string: "text-ember-text",
	comment: "text-muted-foreground italic",
	number: "text-success-text",
	plain: undefined,
};

/** Lines of a file with their 1-based number. A trailing newline makes no empty last line. */
function fileLines(content: string): { number: number; text: string }[] {
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines.map((text, index) => ({ number: index + 1, text }));
}

/** Spans of one line. The start column of a token is its key, unique inside the line. */
function renderTokens(line: string) {
	let column = 0;
	return tokenizeLine(line).map((token) => {
		const start = column;
		column += token.text.length;
		return (
			<span key={start} className={TOKEN_CLASS[token.kind]}>
				{token.text}
			</span>
		);
	});
}

export function CodeViewer({ file, branch, selectedPath }: CodeViewerProps) {
	const { t } = useTranslation();
	const editSwitchId = useId();
	const segments = selectedPath.split("/");

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			<header className="flex h-11 shrink-0 items-center gap-3 border-b px-4 text-[13px]">
				{/* A path and code read left to right in every locale, so both blocks force ltr. */}
				<nav
					dir="ltr"
					className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap text-muted-foreground"
				>
					{segments.map((segment, index) => {
						const isLast = index === segments.length - 1;
						// The path prefix is unique per segment, so it is the key.
						const key = segments.slice(0, index + 1).join("/");
						return (
							<span key={key} className="flex items-center gap-1.5">
								{index > 0 ? <span aria-hidden="true">/</span> : null}
								<span className={isLast ? "text-foreground" : undefined}>
									{segment}
								</span>
							</span>
						);
					})}
				</nav>
				<span className="hidden shrink-0 items-center gap-1.5 text-muted-foreground sm:flex">
					<span className="size-1.5 rounded-full bg-success" />
					{t("appBuilder.code.synced", { branch })}
				</span>
				<Button
					variant="outline"
					size="sm"
					onClick={() => toast(t("appBuilder.mock.notWired"))}
				>
					{t("appBuilder.code.github")}
				</Button>
				{/* Editing has no backend yet. The switch stays off and only explains that. */}
				<label
					htmlFor={editSwitchId}
					className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3"
				>
					<span>{t("appBuilder.code.editCode")}</span>
					<Switch
						id={editSwitchId}
						size="sm"
						checked={false}
						onCheckedChange={() => toast(t("appBuilder.code.readOnly"))}
					/>
				</label>
			</header>
			<div className="min-h-0 flex-1 overflow-auto bg-background/40">
				{file === null ? (
					<p className="flex h-full items-center justify-center text-muted-foreground text-sm">
						{t("appBuilder.code.fileMissing")}
					</p>
				) : (
					<pre dir="ltr" className="m-0 p-4 font-mono text-[13px] leading-6">
						{fileLines(file.content).map((line) => (
							<div key={line.number} className="flex">
								<span className="w-10 shrink-0 select-none pe-4 text-end text-muted-foreground/60 tabular-nums">
									{line.number}
								</span>
								<span>{renderTokens(line.text)}</span>
							</div>
						))}
					</pre>
				)}
			</div>
		</div>
	);
}
