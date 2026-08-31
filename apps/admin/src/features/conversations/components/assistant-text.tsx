import { Fragment, type ReactNode } from "react";

type MarkdownBlock =
	| { type: "code"; key: string; code: string; language: string | null }
	| { type: "paragraph"; key: string; lines: string[] }
	| { type: "unordered-list"; key: string; items: string[] }
	| { type: "ordered-list"; key: string; items: string[] };

const FENCE_PATTERN = /^```([\w.+-]*)\s*$/;
const UNORDERED_ITEM_PATTERN = /^\s*[-*]\s+(.+)$/;
const ORDERED_ITEM_PATTERN = /^\s*\d+[.)]\s+(.+)$/;
const INLINE_PATTERN = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g;

export function AssistantText({ text }: { text: string }) {
	return (
		<div
			dir="auto"
			className="max-w-[72ch] space-y-4 break-words text-sm leading-7"
		>
			{parseMarkdownBlocks(text).map((block) => (
				<MarkdownBlockView key={block.key} block={block} />
			))}
		</div>
	);
}

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
	if (block.type === "code") {
		return (
			<div className="max-w-full overflow-hidden rounded-lg border bg-muted/45">
				{block.language ? (
					<div className="border-b px-3 py-1.5 font-mono text-muted-foreground text-xs">
						{block.language}
					</div>
				) : null}
				<pre className="max-h-[28rem] overflow-auto p-3 text-xs leading-5">
					<code>{block.code}</code>
				</pre>
			</div>
		);
	}

	if (block.type === "unordered-list" || block.type === "ordered-list") {
		const List = block.type === "unordered-list" ? "ul" : "ol";
		return (
			<List
				className={
					block.type === "unordered-list"
						? "ms-5 list-disc space-y-1.5"
						: "ms-5 list-decimal space-y-1.5"
				}
			>
				{keyedValues(block.items).map(({ key, value }) => (
					<li key={key}>{renderInline(value, `${block.key}-${key}`)}</li>
				))}
			</List>
		);
	}

	return (
		<p>
			{keyedValues(block.lines).map(({ key, value }, lineIndex) => (
				<Fragment key={key}>
					{lineIndex > 0 ? <br /> : null}
					{renderInline(value, `${block.key}-${key}`)}
				</Fragment>
			))}
		</p>
	);
}

function renderInline(value: string, keyPrefix: string): ReactNode[] {
	const nodes: ReactNode[] = [];
	let cursor = 0;

	for (const match of value.matchAll(INLINE_PATTERN)) {
		const offset = match.index ?? 0;
		if (offset > cursor) {
			nodes.push(value.slice(cursor, offset));
		}

		const token = match[0];
		if (token.startsWith("`")) {
			nodes.push(
				<code
					key={`${keyPrefix}-${offset}`}
					className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
				>
					{token.slice(1, -1)}
				</code>,
			);
		} else {
			nodes.push(
				<strong key={`${keyPrefix}-${offset}`} className="font-semibold">
					{token.slice(2, -2)}
				</strong>,
			);
		}

		cursor = offset + token.length;
	}

	if (cursor < value.length) {
		nodes.push(value.slice(cursor));
	}

	return nodes;
}

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
	const lines = text.replaceAll("\r\n", "\n").split("\n");
	const blocks: MarkdownBlock[] = [];
	let index = 0;

	while (index < lines.length) {
		const line = lines[index] ?? "";
		if (line.trim().length === 0) {
			index += 1;
			continue;
		}

		const fence = line.match(FENCE_PATTERN);
		if (fence) {
			const code: string[] = [];
			index += 1;
			while (index < lines.length && !FENCE_PATTERN.test(lines[index] ?? "")) {
				code.push(lines[index] ?? "");
				index += 1;
			}
			if (index < lines.length) {
				index += 1;
			}
			blocks.push({
				type: "code",
				key: `code-${index}-${code.join("\n").slice(0, 32)}`,
				code: code.join("\n"),
				language: fence[1] || null,
			});
			continue;
		}

		const unordered = line.match(UNORDERED_ITEM_PATTERN);
		if (unordered) {
			const items: string[] = [];
			while (index < lines.length) {
				const item = (lines[index] ?? "").match(UNORDERED_ITEM_PATTERN);
				if (!item) break;
				items.push(item[1] ?? "");
				index += 1;
			}
			blocks.push({
				type: "unordered-list",
				key: `unordered-${index}-${items[0] ?? "empty"}`,
				items,
			});
			continue;
		}

		const ordered = line.match(ORDERED_ITEM_PATTERN);
		if (ordered) {
			const items: string[] = [];
			while (index < lines.length) {
				const item = (lines[index] ?? "").match(ORDERED_ITEM_PATTERN);
				if (!item) break;
				items.push(item[1] ?? "");
				index += 1;
			}
			blocks.push({
				type: "ordered-list",
				key: `ordered-${index}-${items[0] ?? "empty"}`,
				items,
			});
			continue;
		}

		const paragraph: string[] = [];
		while (index < lines.length) {
			const paragraphLine = lines[index] ?? "";
			if (
				paragraphLine.trim().length === 0 ||
				FENCE_PATTERN.test(paragraphLine) ||
				UNORDERED_ITEM_PATTERN.test(paragraphLine) ||
				ORDERED_ITEM_PATTERN.test(paragraphLine)
			) {
				break;
			}
			paragraph.push(paragraphLine);
			index += 1;
		}
		blocks.push({
			type: "paragraph",
			key: `paragraph-${index}-${paragraph[0] ?? "empty"}`,
			lines: paragraph,
		});
	}

	return blocks;
}

function keyedValues(values: string[]): Array<{ key: string; value: string }> {
	const occurrences = new Map<string, number>();
	return values.map((value) => {
		const occurrence = (occurrences.get(value) ?? 0) + 1;
		occurrences.set(value, occurrence);
		return { key: `${value}-${occurrence}`, value };
	});
}
