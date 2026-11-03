// Fails when a page draws its own look instead of the theme of src/styles/theme.json. `pnpm run typecheck` runs it.
// It reads every .ts, .tsx, and .css file of src, and src/styles/engine.css. Plain Node, no dependency.
// Color rules (features, routes, and the app area): palette, literal, shadow, emoji. An ignore line can skip one.
// Strict rules (app area): caps, radius, ink, font. Icon rules (all files): icons. Root rule (src/routes/__root.tsx): root.
// CSS rules: tokens, literal, caps. No ignore line skips the strict, icon, root, or CSS rules.
// Usage: node scripts/check-theme.mjs. Each finding is one "file:line: rule: text" line, and the exit code is 1.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const ENGINE_PATH = "src/styles/engine.css";

// The class rules: the Tailwind default palette, black and white, an arbitrary color, a fixed shadow.
// (?<![\w./-]) keeps "--shadow-lg", "data-text-red-500", and the path "/images/bg-white.png" out.
// (?![\w.-]) keeps "bg-white.png" out. A variant such as "hover:" and an opacity such as "/50" stay in.
const PALETTE_COLORS =
	"slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOR_PREFIXES =
	"bg|text|border(?:-[xytrblse])?|ring|ring-offset|fill|stroke|from|to|via|outline|decoration|shadow|divide|placeholder|caret|accent";
const PALETTE_CLASS = new RegExp(
	`(?<![\\w./-])(?:${COLOR_PREFIXES})-(?:(?:${PALETTE_COLORS})-\\d{2,3}|black|white)(?![\\w.-])`,
	"g",
);
const ARBITRARY_COLOR =
	/[^\s"'`{}]*-\[(?:color:)?(?:#[0-9a-f]{3}|(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\()[^\]\s"'`]*\]?/gi;
const FIXED_SHADOW =
	/(?<![\w./-])shadow-(?:2xs|xs|sm|md|lg|xl|2xl|\[[^\]\s"'`]*\]?)(?![\w.-])/g;
const STYLE_COLOR =
	/#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\([^)\n]*\)?/gi;
// An emoji glyph, not a text symbol: "©", "™", and "↗" are Extended_Pictographic too, but draw as text.
const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}️/gu;

/**
 * The strict rules of the app area, one reason each. They name the looks that theme.json owns:
 * capital labels, fixed corners, ink edges and bands, and fonts. The builder Thème sheet changes them, so a page must not.
 */
const STRICT_RULES = [
	{
		rule: "caps",
		pattern:
			/(?<![\w-])uppercase(?![\w-])|\[text-transform:|\btextTransform\b/g,
		reason:
			"capital text. The app area writes titles and labels in sentence case.",
	},
	{
		rule: "caps",
		pattern: /(?<![\w-])tracking-(?:wide|wider|widest)(?![\w-])/g,
		reason:
			"wide tracking. It goes with capital labels; the theme voice sets the tracking.",
	},
	{
		rule: "radius",
		pattern: /(?<![\w./-])rounded(?:-[a-z]{1,2})?-(?:none(?![\w-])|\[)/g,
		reason:
			"a fixed corner. The radius axis of theme.json sets the corners: use the kit parts, or rounded-md and the other steps.",
	},
	{
		rule: "ink",
		pattern:
			/(?<![\w./-])border(?:-[xytrblse])?-(?:(?:[2-9]|\d{2,})(?![\w.-])|\[(?:length:)?[\d.]+(?:px|rem|em)\])/g,
		reason:
			"a thick border. The border axis of theme.json sets every edge width: use border.",
	},
	{
		rule: "ink",
		pattern:
			/(?<![\w./-])(?:bg-(?:foreground|contrast)|text-background)(?![\w-])|(?<![\w./-])bg-[([](?:color:)?(?:var\()?--[\w-]*foreground\b/g,
		reason:
			"an ink band: a fill in a text color. Use bg-card, bg-muted, bg-accent, or bg-primary.",
	},
	{
		rule: "font",
		pattern: /(?<![\w./-])font-\[/g,
		reason:
			"an arbitrary font. theme.json sets the faces: use font-sans, font-display, or font-numeric, and font-medium or font-semibold.",
	},
];

/**
 * The icon rules of every source file, one reason each. They read the whole file, so a tag over several lines counts.
 * The IconContext of routes/__root.tsx gives the weight of the icons axis to the Phosphor icons below it.
 * The SSR icons of Phosphor (the "/ssr" path, the SSR namespace) and the other Phosphor packages never read that context.
 */
// LIMIT: the list names the common icon packages only. Upgrade: an allow list of icon imports.
const ICON_RULES = [
	{
		pattern:
			/\b(?:from|import)\s*\(?\s*["'](?:lucide(?:-react)?|@lucide\/[\w-]+|phosphor-react|@phosphor-icons\/react\/(?:dist\/)?ssr|@phosphor-icons\/(?!react(?![\w-]))[\w-]+|@radix-ui\/react-icons|react-feather|@iconify\/react|@fortawesome\/[\w-]+|@mui\/icons-material|react-icons|@tabler\/icons-react|@heroicons\/react|@remixicon\/react|@hugeicons\/react)(?:\/[^"']*)?["']|\bSSR\.[A-Z]\w*|\bimport\s*\{[^}]*\bSSR\b[^}]*\}\s*from\s*["']@phosphor-icons\/react["']/g,
		reason:
			"an icon that ignores the theme weight: another icon package, or a Phosphor SSR icon. Import from @phosphor-icons/react.",
	},
	{
		// A read of the context is fine: the kit controls of shared/ui/icons read the theme weight.
		// React 19 also accepts the context itself as a provider: <IconContext value={...}>.
		pattern: /\bIconContext\.Provider\b|<IconContext(?![\w.])/g,
		reason:
			"a second IconContext provider. It hides the theme weight of routes/__root.tsx from the icons below it.",
		// The root route holds the one provider of the theme weight.
		ownerPath: "routes/__root.tsx",
	},
];

/**
 * The weight rule: a weight attribute after a space, with a quoted or a braced value.
 * "?weight=2" in a URL, data-weight, and the text "weight=bold" stay out.
 * It fails on a Phosphor weight other than fill in the value, on any tag. A weight in kg passes.
 * On a tag whose name ends in "Icon", it also fails on a value with no "fill" literal, such as weight={w}.
 */
// LIMIT: the check misses a weight in a spread or in createElement, and on an alias without the Icon suffix with a braced value.
// It also misses a weight variable next to a "fill" literal, and a tag after a "<" in an earlier attribute.
// Upgrade: parse the JSX with the TypeScript compiler API.
const WEIGHT_ATTRIBUTE = /(?<=\s)weight=(?:"[^"\n]*"|'[^'\n]*'|\{)/g;
const NON_FILL_WEIGHT = /["'`](?:thin|light|regular|bold|duotone)["'`]/;
const FILL_WEIGHT = /["'`]fill["'`]/;
// The name of the last JSX tag that opens before an offset.
const OPEN_TAG_NAME = /<([\w.]+)[^<]*$/;
const WEIGHT_REASON =
	'a weight on an icon. The icons axis of theme.json sets it. Only an on state may fill: weight="fill" or weight={isOn ? "fill" : undefined}. On a component that is not an icon, rename the prop, for example fontWeight.';

// The agent edits the root route for pixels and providers. Without these parts, a theme change stops at the root.
// LIMIT: a text check. A part that stays in the file but leaves <html> or the provider value passes.
// Upgrade: parse the JSX with the TypeScript compiler API.
const ROOT_ROUTE = "src/routes/__root.tsx";
const ROOT_THEME_PARTS = [
	"themeAttributesOf(",
	"themeStyleOf(",
	"fontLinksOf(",
	"<IconContext.Provider",
	"selection.icons",
];

// The opening tag of a CardHeader, over several lines. A fill on it turns the card head into a band.
const CARD_HEADER_TAG = /<CardHeader\b[^>]*>/g;
const FILL_CLASS = /(?<![\w./-])bg-(?!transparent(?![\w-]))[\w([]/;

// The skip line: "// theme-check: ignore <rule> <reason>". In JSX children it is "{/* theme-check: ... */}".
const IGNORE_LINE =
	/^\s*(?:\/\/|\{\s*\/\*|\/\*)\s*theme-check:\s*ignore\s+([a-z]+)\s+(.*?)\s*(?:\*\/\s*\}?)?\s*$/;
const MIN_REASON_LENGTH = 10;

/** Every finding as one "file:line: rule: text" line. A Set drops a finding that two scans both find. */
const findings = new Set();

function addFinding(file, line, rule, text) {
	findings.add(`${file}:${line}: ${rule}: ${text}`);
}

/** The 0-based line of a character offset. */
function lineIndexOf(text, offset) {
	return text.slice(0, offset).split("\n").length - 1;
}

// A comment starts only after one of these characters or at the file start. Biome formats every real comment so.
// So "image/*" and "https://x" in JSX text stay code.
const COMMENT_START_AFTER = /[\s{([,;=]/;

/**
 * Replaces each comment with spaces and keeps each newline, so the line numbers stay true.
 * It follows strings and template literals, so "https://x" in a string stays code.
 */
// LIMIT: a regex literal that holds a quote, "//", or "/*", and JSX text with "//" or "/*" after a space, can move a comment edge. Upgrade: parse with the TypeScript compiler API.
function blankComments(source) {
	const output = [];
	// The open contexts. A template literal holds text; its ${ } holds code with its own "{" depth.
	const contexts = [{ kind: "code", braces: 0 }];
	let index = 0;
	while (index < source.length) {
		const context = contexts.at(-1);
		const char = source[index];
		const pair = source.slice(index, index + 2);
		let end = index + 1;
		if (context.kind === "template") {
			if (char === "\\") {
				end = index + 2;
			} else if (char === "`") {
				contexts.pop();
			} else if (pair === "${") {
				contexts.push({ kind: "code", braces: 0 });
				end = index + 2;
			}
			output.push(source.slice(index, end));
		} else if (
			(pair === "//" || pair === "/*") &&
			(index === 0 || COMMENT_START_AFTER.test(source[index - 1]))
		) {
			const close =
				pair === "//"
					? source.indexOf("\n", index)
					: source.indexOf("*/", index + 2);
			end = close === -1 ? source.length : close + (pair === "/*" ? 2 : 0);
			output.push(source.slice(index, end).replace(/[^\n]/g, " "));
		} else if (char === '"' || char === "'") {
			// A quote string ends at its quote or at the line end. So the apostrophe of JSX text such as "Don't" stops there.
			while (
				end < source.length &&
				source[end] !== char &&
				source[end] !== "\n"
			) {
				end += source[end] === "\\" ? 2 : 1;
			}
			end += 1;
			output.push(source.slice(index, end));
		} else {
			if (char === "`") {
				contexts.push({ kind: "template" });
			} else if (char === "{") {
				context.braces += 1;
			} else if (char === "}") {
				// The "}" of a ${ } goes back to the template text.
				if (context.braces === 0 && contexts.length > 1) {
					contexts.pop();
				} else {
					context.braces -= 1;
				}
			}
			output.push(char);
		}
		index = end;
	}
	return output.join("");
}

/** The text from the "{" at offset open to its matching "}", or to the file end. */
function braceSpanAt(code, open) {
	let depth = 0;
	let close = open;
	for (; close < code.length; close += 1) {
		if (code[close] === "{") {
			depth += 1;
		} else if (code[close] === "}") {
			depth -= 1;
			if (depth === 0) {
				break;
			}
		}
	}
	return code.slice(open, close + 1);
}

/** Each style={...} value of a file, with its start offset. */
function styleRegionsOf(code) {
	return [...code.matchAll(/\bstyle=\{/g)].map((match) => {
		const open = match.index + match[0].length - 1;
		return { start: open, text: braceSpanAt(code, open) };
	});
}

/** True when the raw line above holds "theme-check: ignore <rule> <reason of 10+ chars>". */
function isIgnored(lineAbove, rule) {
	const match = IGNORE_LINE.exec(lineAbove ?? "");
	return (
		match !== null && match[1] === rule && match[2].length >= MIN_REASON_LENGTH
	);
}

/** The color rules read features and routes, the public pages too, and the strict scope. The kit and src/styles are the token source. */
function isColorScope(path) {
	return path.startsWith("features/") || path.startsWith("routes/");
}

/**
 * The strict rules read the app area: all of src except the kit, src/styles, the public page features
 * (landing, site), and the route files outside routes/app/. A world can give caps and ink to public pages.
 */
function isStrictScope(path) {
	return (
		!path.startsWith("shared/ui/") &&
		!path.startsWith("styles/") &&
		!path.startsWith("features/landing/") &&
		!path.startsWith("features/site/") &&
		(!path.startsWith("routes/") || path.startsWith("routes/app/"))
	);
}

/** Checks one .ts or .tsx file. path is relative to src, with "/" separators. */
function checkSource(path) {
	const file = `src/${path}`;
	const source = readFileSync(join(root, file), "utf8");
	const rawLines = source.split("\n");
	const code = blankComments(source);
	// The findings of this file. They print in line order after the scans.
	const found = [];
	const report = (lineIndex, rule, text) => {
		found.push({ lineIndex, rule, text });
	};
	const reportUnlessIgnored = (lineIndex, rule, text) => {
		if (!isIgnored(rawLines[lineIndex - 1], rule)) {
			report(lineIndex, rule, text);
		}
	};
	const isColorFile = isColorScope(path);
	const isStrictFile = isStrictScope(path);

	for (const { pattern, reason, ownerPath } of ICON_RULES) {
		if (path === ownerPath) {
			continue;
		}
		for (const match of code.matchAll(pattern)) {
			report(lineIndexOf(code, match.index), "icons", `${match[0]}: ${reason}`);
		}
	}
	// A weight prop beats the IconContext of the root, so that icon loses the theme weight.
	for (const match of code.matchAll(WEIGHT_ATTRIBUTE)) {
		const value = match[0].endsWith("{")
			? braceSpanAt(code, match.index + match[0].length - 1)
			: match[0].slice("weight=".length);
		const tagName = OPEN_TAG_NAME.exec(code.slice(0, match.index))?.[1] ?? "";
		const isIconTag = /icon$/i.test(tagName);
		if (
			NON_FILL_WEIGHT.test(value) ||
			(isIconTag && !FILL_WEIGHT.test(value))
		) {
			report(
				lineIndexOf(code, match.index),
				"icons",
				`weight=${value.replace(/\s+/g, " ")}: ${WEIGHT_REASON}`,
			);
		}
	}

	code.split("\n").forEach((line, lineIndex) => {
		if (isColorFile || isStrictFile) {
			const colors = line.match(PALETTE_CLASS);
			if (colors !== null) {
				reportUnlessIgnored(
					lineIndex,
					"palette",
					`fixed color ${colors.join(", ")}. Use a semantic token: bg-primary, text-foreground, text-muted-foreground, border-border, text-success.`,
				);
			}
			const literals = line.match(ARBITRARY_COLOR);
			if (literals !== null) {
				reportUnlessIgnored(
					lineIndex,
					"literal",
					`arbitrary color ${literals.join(", ")}. Use a semantic token, such as bg-primary or text-foreground.`,
				);
			}
			const shadows = line.match(FIXED_SHADOW);
			if (shadows !== null) {
				reportUnlessIgnored(
					lineIndex,
					"shadow",
					`fixed shadow ${shadows.join(", ")}. Use shadow-surface: the shadow axes of theme.json set it.`,
				);
			}
			const emoji = line.match(EMOJI);
			if (emoji !== null) {
				reportUnlessIgnored(
					lineIndex,
					"emoji",
					`${emoji.join(" ")} is an emoji. Use a Phosphor icon of ~/shared/ui/icons or @phosphor-icons/react.`,
				);
			}
		}
		if (isStrictFile) {
			for (const { rule, pattern, reason } of STRICT_RULES) {
				const matches = line.match(pattern);
				if (matches !== null) {
					report(lineIndex, rule, `${matches.join(", ")}: ${reason}`);
				}
			}
		}
	});

	if (isColorFile || isStrictFile) {
		for (const region of styleRegionsOf(code)) {
			// One finding for each line of the style value, with all its colors.
			const colorsByLine = new Map();
			for (const match of region.text.matchAll(STYLE_COLOR)) {
				const lineIndex = lineIndexOf(code, region.start + match.index);
				colorsByLine.set(lineIndex, [
					...(colorsByLine.get(lineIndex) ?? []),
					match[0],
				]);
			}
			for (const [lineIndex, colors] of colorsByLine) {
				reportUnlessIgnored(
					lineIndex,
					"literal",
					`fixed color ${colors.join(", ")} in a style prop. Use a semantic class, or var(--primary) and the other tokens.`,
				);
			}
		}
	}

	if (isStrictFile) {
		for (const match of code.matchAll(CARD_HEADER_TAG)) {
			if (FILL_CLASS.test(match[0])) {
				report(
					lineIndexOf(code, match.index),
					"ink",
					"a fill on CardHeader: the card head becomes a band. Keep the head on the card color.",
				);
			}
		}
	}

	found.sort((first, second) => first.lineIndex - second.lineIndex);
	for (const { lineIndex, rule, text } of found) {
		addFinding(file, lineIndex + 1, rule, text);
	}
}

/** A CSS text with each comment replaced by spaces. Each newline stays, so the line numbers stay true. */
function blankCssComments(css) {
	return css.replace(/\/\*[\s\S]*?\*\//g, (comment) =>
		comment.replace(/[^\n]/g, " "),
	);
}

/** The custom properties that a CSS text declares, each with its value and the 0-based line of its name. */
function declarationsOf(code) {
	return [...code.matchAll(/(?<![\w-])(--[\w-]+)\s*:\s*([^;}]*)/g)].map(
		(match) => ({
			name: match[1],
			value: match[2].trim().replace(/\s+/g, " "),
			lineIndex: lineIndexOf(code, match.index),
		}),
	);
}

// The Tailwind names that the kit classes read: bg-primary, rounded-lg, shadow-surface, font-sans.
// Each one must read a token, so that theme.json still reaches the class.
const TAILWIND_TOKEN_NAME = /^--(?:color|radius|shadow|font)-/;
const TOKEN_REFERENCE = /^(?:calc\()?var\(--/;
// Capital text in CSS: the property, or the uppercase value of @apply.
const CSS_CAPS = /(?<![\w-])(?:text-transform|uppercase)(?![\w-])/g;

/**
 * The CSS rules for every CSS file of src except engine.css. A theme token, a --theme-* source variable,
 * a raw color, capital text, or a Tailwind name with a fixed value hides a theme change of the builder.
 * A CSS class reaches every page, so these rules also cover the public pages. No ignore line skips them.
 */
function checkCss(path, themeTokens) {
	const file = `src/${path}`;
	const code = blankCssComments(readFileSync(join(root, file), "utf8"));
	code.split("\n").forEach((line, lineIndex) => {
		const colors = line.match(STYLE_COLOR);
		if (colors !== null) {
			addFinding(
				file,
				lineIndex + 1,
				"literal",
				`fixed color ${colors.join(", ")}. Use var(--primary) and the other tokens of src/styles/engine.css.`,
			);
		}
		const caps = line.match(CSS_CAPS);
		if (caps !== null) {
			addFinding(
				file,
				lineIndex + 1,
				"caps",
				`${caps.join(", ")}: capital text in CSS. A CSS class reaches the app area; on a public page, put the uppercase class in the page file.`,
			);
		}
	});
	for (const { name, value, lineIndex } of declarationsOf(code)) {
		if (themeTokens.has(name) || name.startsWith("--theme-")) {
			addFinding(
				file,
				lineIndex + 1,
				"tokens",
				`${name} is a theme token of src/styles/engine.css. theme.json sets it; declare a new name for an app utility.`,
			);
		} else if (TAILWIND_TOKEN_NAME.test(name) && !TOKEN_REFERENCE.test(value)) {
			addFinding(
				file,
				lineIndex + 1,
				"tokens",
				`${name}: ${value} is a fixed value. A color, radius, shadow, or font name reads a token, such as var(--primary) or calc(var(--radius) * 2).`,
			);
		}
	}
}

const themeTokens = new Set(
	declarationsOf(
		blankCssComments(readFileSync(join(root, ENGINE_PATH), "utf8")),
	).map(({ name }) => name),
);
const files = readdirSync(join(root, "src"), { recursive: true })
	.map((path) => path.replaceAll("\\", "/"))
	.filter(
		(path) =>
			/\.(?:tsx?|css)$/.test(path) &&
			!path.endsWith("routeTree.gen.ts") &&
			`src/${path}` !== ENGINE_PATH,
	)
	.sort();
for (const path of files) {
	if (path.endsWith(".css")) {
		checkCss(path, themeTokens);
	} else {
		checkSource(path);
	}
}
// Without the root route the build fails on its own, so a tree without it has nothing to check here.
if (existsSync(join(root, ROOT_ROUTE))) {
	const rootCode = blankComments(readFileSync(join(root, ROOT_ROUTE), "utf8"));
	for (const part of ROOT_THEME_PARTS) {
		if (!rootCode.includes(part)) {
			addFinding(
				ROOT_ROUTE,
				1,
				"root",
				`${part} is missing. Keep the theme attributes, the theme style, the font links, and the IconContext provider of the icons axis.`,
			);
		}
	}
}

if (findings.size > 0) {
	console.error(
		`check-theme: ${findings.size} finding(s):\n` +
			[...findings].map((finding) => `  ${finding}`).join("\n") +
			"\nsrc/styles/theme.json gives the look. Use the kit parts and the semantic tokens of src/styles/tokens.css. " +
			'For a deliberate palette, literal, shadow, or emoji exception, put "// theme-check: ignore <rule> <reason of 10+ chars>" on the line above.',
	);
	process.exit(1);
}
console.log(`check-theme: ok, ${files.length} file(s)`);
