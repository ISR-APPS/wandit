import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { APP_RECIPE_OPTIONS } from "../../domain/app-recipe";

const specDir = dirname(fileURLToPath(import.meta.url));
const templateRoot = resolve(
	specDir,
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"..",
	"templates",
	"web-app",
);
const skillDir = join(templateRoot, ".claude", "skills", "app-dashboard");

// Axes with one skill file per option id. accent and fonts are indexes inside a style file.
// mode, shell, and density are "### <axis>=<id>" sections of frame.md.
const OPTION_FOLDERS = new Map<string, string>([
	["style", "styles"],
	["home", "homes"],
	["kpi", "kpis"],
	["chart", "charts"],
]);

// Level-2 heading lines of each option file, in file order. The test puts the "# <title> <id>" line first.
const STYLE_HEADINGS = [
	"## Identity",
	"## Fonts",
	"## Palette",
	"## Accents",
	"## Knobs",
	"## Anatomy",
	"## Signature",
	"## Empty state",
	"## Do not",
	"## Check",
];
const HOME_HEADINGS = [
	"## Needs",
	"## Silhouette",
	"## Slots",
	"## Behavior",
	"## Empty state",
	"## Rules",
];
// A KPI or chart form can add "## Messages" at the end.
const FORM_HEADINGS = ["## Data", "## Anatomy", "## Rules", "## Fallback"];

// The palette blocks of a style can leave these to one block, because they do not change with the mode.
// --control-radius has no template value: tokens.css reads it with a pill fallback.
const SHAPE_TOKENS = ["--radius", "--control-radius"];

// The palette sections that a style file has, from the mode policy of its "Mode: ..." line.
// The check finds that line at any position in the file.
const PALETTE_HEADINGS = new Map<string, string[]>([
	["light only", ["### Light"]],
	["dark only", ["### Dark"]],
	["light or dark", ["### Light", "### Dark"]],
]);

/** Names of the custom properties that a CSS text declares, for example `--sidebar` of `--sidebar: ...;`. */
function declaredProperties(css: string): string[] {
	return [...css.matchAll(/^\s*(--[\w-]+):/gm)].flatMap(
		(match) => match[1] ?? [],
	);
}

/** Body of the CSS block whose selector line is exactly `<selector> {`. Throws when the block is missing. */
function cssBlock(css: string, selector: string): string {
	const start = css.indexOf(`\n${selector} {\n`);
	if (start === -1) {
		throw new Error(`tokens.css has no "${selector} {" block`);
	}
	return css.slice(start, css.indexOf("\n}\n", start));
}

/** Names that the "Style knobs" block of tokens.css declares. Throws when the comment is missing. */
function styleKnobNames(css: string): string[] {
	const start = css.indexOf("/* Style knobs");
	if (start === -1) {
		throw new Error('tokens.css has no "/* Style knobs" comment');
	}
	return declaredProperties(css.slice(start, css.indexOf("\n}\n", start)));
}

/** Level of a Markdown heading line, for example 2 for "## Fonts". Undefined for any other line. */
function headingLevel(line: string): number | undefined {
	return /^(#+) /.exec(line)?.[1]?.length;
}

/** Heading lines up to `maxLevel`, in file order. A `#` line in a fenced code block is not a heading. */
function headingsOf(markdown: string, maxLevel: number): string[] {
	let inFence = false;
	return markdown.split("\n").filter((line) => {
		if (line.trimStart().startsWith("```")) {
			inFence = !inFence;
			return false;
		}
		const level = headingLevel(line);
		return !inFence && level !== undefined && level <= maxLevel;
	});
}

/**
 * Text under one heading line, for example "## Palette", up to the next heading of the same or a higher level.
 * Empty when the heading is missing.
 */
function markdownSection(markdown: string, heading: string): string {
	const level = headingLevel(heading) ?? 0;
	const lines = markdown.split("\n");
	const start = lines.indexOf(heading);
	if (start === -1) {
		return "";
	}
	const body: string[] = [];
	let inFence = false;
	for (const line of lines.slice(start + 1)) {
		if (line.trimStart().startsWith("```")) {
			inFence = !inFence;
		}
		const lineLevel = headingLevel(line);
		if (!inFence && lineLevel !== undefined && lineLevel <= level) {
			break;
		}
		body.push(line);
	}
	return body.join("\n");
}

/** One gap text when `actual` differs from `expected`, so the report shows both lists. */
function headingGap(
	file: string,
	actual: string[],
	expected: string[],
): string[] {
	return actual.join(" / ") === expected.join(" / ")
		? []
		: [
				`${file}: headings "${actual.join(" / ")}", expected "${expected.join(" / ")}"`,
			];
}

/** Text of a skill file, or undefined when the file does not exist. The first case reports a missing file. */
function readSkillFile(path: string): string | undefined {
	const fullPath = join(skillDir, path);
	return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
}

describe("app-dashboard skill", () => {
	it("documents every recipe option", () => {
		const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
		const frameLines = new Set(
			readFileSync(join(skillDir, "frame.md"), "utf8").split("\n"),
		);
		const gaps: string[] = [];

		for (const [axis, ids] of Object.entries(APP_RECIPE_OPTIONS)) {
			// The style file test below checks the accent and fonts indexes.
			if (axis === "accent" || axis === "fonts") {
				continue;
			}
			const folder = OPTION_FOLDERS.get(axis);
			for (const id of ids) {
				if (folder === undefined) {
					if (!frameLines.has(`### ${axis}=${id}`)) {
						gaps.push(`frame.md: no "### ${axis}=${id}" heading`);
					}
				} else if (!existsSync(join(skillDir, folder, `${id}.md`))) {
					gaps.push(`${folder}/${id}.md: missing`);
				}
			}
		}

		// The agent picks a style and a home from these table rows of SKILL.md.
		for (const id of [
			...APP_RECIPE_OPTIONS.style,
			...APP_RECIPE_OPTIONS.home,
		]) {
			if (!skill.includes(`| ${id} |`)) {
				gaps.push(`SKILL.md: no table row for ${id}`);
			}
		}

		expect(gaps).toEqual([]);
	});

	it("gives every style file its sections, accents, fonts, palette tokens, and knobs", () => {
		const tokens = readFileSync(
			join(templateRoot, "src", "styles", "tokens.css"),
			"utf8",
		);
		// A style replaces the palette part of tokens.css. No color may fall back to the template.
		// So each palette block sets the colors of that part, the derived sidebar colors, and the status colors.
		const colorNames = [
			...declaredProperties(cssBlock(tokens, ".dark")),
			...declaredProperties(cssBlock(tokens, ":where(:root, .dark)")).filter(
				(name) => name.startsWith("--sidebar"),
			),
			...declaredProperties(cssBlock(tokens, ":where(.dark)")),
		];
		const knobNames = new Set(styleKnobNames(tokens));
		const gaps: string[] = [];

		for (const id of APP_RECIPE_OPTIONS.style) {
			const file = `styles/${id}.md`;
			const style = readSkillFile(file);
			if (style === undefined) {
				continue;
			}
			gaps.push(
				...headingGap(file, headingsOf(style, 2), [
					`# Style ${id}`,
					...STYLE_HEADINGS,
				]),
			);
			gaps.push(
				...headingGap(
					`${file} ## Fonts`,
					headingsOf(markdownSection(style, "## Fonts"), 3),
					APP_RECIPE_OPTIONS.fonts.map((fonts) => `### fonts=${fonts}`),
				),
			);

			// The recipe gives accent=<id>. The agent looks up the row of that id.
			const accentRows = markdownSection(style, "## Accents").split("\n");
			for (const accent of APP_RECIPE_OPTIONS.accent) {
				const rowStart = new RegExp(`^\\|\\s*\`?accent=${accent}\`?\\s*\\|`);
				if (!accentRows.some((row) => rowStart.test(row))) {
					gaps.push(`${file} ## Accents: no row for accent=${accent}`);
				}
			}

			const mode = /^Mode: (light only|dark only|light or dark)\./m.exec(
				style,
			)?.[1];
			const paletteHeadings = PALETTE_HEADINGS.get(mode ?? "");
			if (paletteHeadings === undefined) {
				gaps.push(
					`${file}: no "Mode: light only|dark only|light or dark." line`,
				);
			} else {
				const palette = markdownSection(style, "## Palette");
				gaps.push(
					...headingGap(
						`${file} ## Palette`,
						headingsOf(palette, 3),
						paletteHeadings,
					),
				);
				for (const heading of paletteHeadings) {
					const defined = new Set(
						declaredProperties(markdownSection(palette, heading)),
					);
					for (const name of colorNames) {
						if (!defined.has(name)) {
							gaps.push(`${file} ${heading}: no ${name}`);
						}
					}
				}
				const paletteNames = new Set(declaredProperties(palette));
				for (const name of SHAPE_TOKENS) {
					if (!paletteNames.has(name)) {
						gaps.push(`${file} ## Palette: no ${name}`);
					}
				}
			}

			// The Knobs section sets every knob of tokens.css and invents none, because the kit reads only those.
			const knobsSet = new Set(
				declaredProperties(markdownSection(style, "## Knobs")),
			);
			for (const name of knobNames) {
				if (!knobsSet.has(name)) {
					gaps.push(`${file} ## Knobs: no ${name}`);
				}
			}
			for (const name of knobsSet) {
				if (!knobNames.has(name)) {
					gaps.push(`${file} ## Knobs: ${name} is not a knob of tokens.css`);
				}
			}
		}

		expect(gaps).toEqual([]);
	});

	it("gives every home, KPI, and chart file its headings and no full source file", () => {
		const gaps: string[] = [];
		const files = [
			...APP_RECIPE_OPTIONS.home.map((id) => ({
				file: `homes/${id}.md`,
				headings: [`# Home ${id}`, ...HOME_HEADINGS],
			})),
			...APP_RECIPE_OPTIONS.kpi.map((id) => ({
				file: `kpis/${id}.md`,
				headings: [`# KPI form ${id}`, ...FORM_HEADINGS],
			})),
			...APP_RECIPE_OPTIONS.chart.map((id) => ({
				file: `charts/${id}.md`,
				headings: [`# Chart form ${id}`, ...FORM_HEADINGS],
			})),
		];

		for (const { file, headings } of files) {
			const markdown = readSkillFile(file);
			if (markdown === undefined) {
				continue;
			}
			const actual = headingsOf(markdown, 2);
			// A KPI or chart form ends with "## Messages" only when it needs message keys. A home never has it.
			const expected =
				!file.startsWith("homes/") && actual.at(-1) === "## Messages"
					? [...headings, "## Messages"]
					: headings;
			gaps.push(...headingGap(file, actual, expected));
			// These files give specs. A "### File:" block makes the agent copy a page.
			if (/^#+ File:/m.test(markdown)) {
				gaps.push(`${file}: has a "File:" block`);
			}
		}

		expect(gaps).toEqual([]);
	});
});
