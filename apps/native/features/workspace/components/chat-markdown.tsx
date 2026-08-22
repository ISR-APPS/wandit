import { useThemeColor } from "heroui-native";
import { Children, type ReactNode, useMemo } from "react";
import Markdown, { MarkdownIt } from "react-native-markdown-display";

import { MarkdownImage } from "./chat-markdown-image";
import { MarkdownTable } from "./chat-markdown-table";

/**
 * chat-markdown.tsx — the native twin of the web's Streamdown usage in
 * real-message.tsx. Assistant text arrives as GFM markdown (history rows can
 * be plain text with single newlines, which is why the web adds
 * remark-breaks); markdown-it's `breaks` + `linkify` options reproduce that
 * remark-gfm + remark-breaks pairing, and tables/strikethrough are core
 * markdown-it features.
 *
 * Re-parsing the whole string per streamed chunk is fine at chat sizes — the
 * server already word-chunks with smoothStream, so renders stay small.
 */

// markdown-it is instantiated once at module scope; it is stateless across
// renders and safe to share between every message in the thread.
const markdownIt = MarkdownIt({
	breaks: true,
	linkify: true,
	typographer: true,
});

// Markdown images never load eagerly: assistant media arrives through tool
// cards, so an inline ![](url) in model output is a prompt-injection vector
// (tracking pixels, blind LAN GETs, oversized decodes). The URL is never
// fetched here — the rule renders a disclosed stand-in and the real image
// mounts only after an explicit tap (chat-markdown-image.tsx).
const SAFE_RULES = {
	image: (node: { key: string; attributes: { src?: string; alt?: string } }) =>
		node.attributes.src ? (
			<MarkdownImage
				key={node.key}
				src={node.attributes.src}
				alt={node.attributes.alt ?? ""}
			/>
		) : null,
	// Wide GFM tables scroll sideways inside their own container instead of
	// clamping — a clamped table silently truncates data; long tables cap at
	// 420 with the header pinned and a fullscreen modal (web parity with the
	// table treatment in real-message.tsx).
	table: (
		node: { key: string; children: { type: string; children: unknown[] }[] },
		children: ReactNode,
		_parent: unknown,
		styles: { table: object },
	) => {
		// AST order is [thead, tbody]; children arrive pre-rendered in the same
		// order, and the row count comes from the AST so the cap needs no
		// measuring.
		const rendered = Children.toArray(children);
		const bodyRowCount =
			node.children.find((child) => child.type === "tbody")?.children.length ??
			0;
		return (
			<MarkdownTable
				key={node.key}
				header={rendered[0] ?? null}
				body={rendered.slice(1)}
				bodyRowCount={bodyRowCount}
				tableStyle={styles.table}
			/>
		);
	},
};

const SANS = "InstrumentSans_400Regular";
const SANS_MEDIUM = "InstrumentSans_500Medium";
const SANS_SEMIBOLD = "InstrumentSans_600SemiBold";
const MONO = "GeistMono_400Regular";

export function ChatMarkdown({ text }: { text: string }) {
	const foreground = useThemeColor("foreground");
	const muted = useThemeColor("muted");
	const accent = useThemeColor("accent");
	const border = useThemeColor("border");
	const surfaceSecondary = useThemeColor("surface-secondary");

	const styles = useMemo(
		() =>
			({
				body: {
					color: foreground,
					fontFamily: SANS,
					fontSize: 14.5,
					lineHeight: 22,
				},
				// textgroup is the <Text> wrapper the library puts around every
				// prose run (paragraphs, headings, list items, blockquote and
				// table-cell text) — per-block base direction from the first strong
				// character, the native twin of Streamdown's dir="auto"
				// (real-message.tsx). Fences render outside textgroup and keep
				// their own LTR pin.
				textgroup: { writingDirection: "auto" },
				paragraph: {
					marginTop: 0,
					marginBottom: 10,
				},
				heading1: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 18,
					lineHeight: 25,
					marginTop: 6,
					marginBottom: 8,
				},
				heading2: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 16.5,
					lineHeight: 23,
					marginTop: 6,
					marginBottom: 7,
				},
				heading3: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 15.5,
					lineHeight: 22,
					marginTop: 4,
					marginBottom: 6,
				},
				heading4: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 14.5,
					lineHeight: 21,
					marginTop: 4,
					marginBottom: 5,
				},
				heading5: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 14,
					lineHeight: 20,
					marginBottom: 4,
				},
				heading6: {
					fontFamily: SANS_SEMIBOLD,
					fontSize: 13.5,
					lineHeight: 19,
					marginBottom: 4,
				},
				strong: { fontFamily: SANS_SEMIBOLD },
				em: { fontStyle: "italic" },
				s: { textDecorationLine: "line-through" },
				link: {
					color: accent,
					textDecorationLine: "underline",
				},
				blockquote: {
					backgroundColor: "transparent",
					borderColor: accent,
					borderLeftWidth: 2.5,
					paddingLeft: 12,
					paddingRight: 0,
					marginLeft: 0,
					marginBottom: 10,
					opacity: 0.85,
				},
				bullet_list: { marginBottom: 10 },
				ordered_list: { marginBottom: 10 },
				list_item: {
					flexDirection: "row",
					marginBottom: 4,
				},
				bullet_list_icon: {
					color: muted,
					marginLeft: 2,
					marginRight: 8,
				},
				ordered_list_icon: {
					color: muted,
					fontFamily: SANS_MEDIUM,
					marginLeft: 2,
					marginRight: 8,
				},
				code_inline: {
					backgroundColor: surfaceSecondary,
					borderRadius: 5,
					color: foreground,
					fontFamily: MONO,
					fontSize: 12.5,
					paddingHorizontal: 5,
					paddingVertical: 1,
				},
				code_block: {
					backgroundColor: surfaceSecondary,
					borderColor: border,
					borderRadius: 12,
					borderWidth: 1,
					color: foreground,
					fontFamily: MONO,
					fontSize: 12,
					lineHeight: 18,
					marginBottom: 10,
					padding: 12,
					writingDirection: "ltr",
				},
				fence: {
					backgroundColor: surfaceSecondary,
					borderColor: border,
					borderRadius: 12,
					borderWidth: 1,
					color: foreground,
					fontFamily: MONO,
					fontSize: 12,
					lineHeight: 18,
					marginBottom: 10,
					padding: 12,
					writingDirection: "ltr",
				},
				hr: {
					backgroundColor: border,
					height: 1,
					marginVertical: 12,
				},
				table: {
					borderColor: border,
					borderRadius: 10,
					borderWidth: 1,
					marginBottom: 10,
					// Sized by content: the custom table rule wraps this in its own
					// horizontal scroller, so a wide table pans instead of truncating.
					overflow: "hidden",
				},
				thead: {},
				th: {
					backgroundColor: surfaceSecondary,
					fontFamily: SANS_SEMIBOLD,
					fontSize: 12.5,
					padding: 8,
				},
				tr: {
					borderBottomWidth: 1,
					borderColor: border,
					flexDirection: "row",
				},
				td: {
					fontSize: 12.5,
					padding: 8,
				},
			}) as const,
		[accent, border, foreground, muted, surfaceSecondary],
	);

	return (
		<Markdown markdownit={markdownIt} style={styles} rules={SAFE_RULES}>
			{text}
		</Markdown>
	);
}
