import { existsSync, readdirSync, readFileSync } from "node:fs";
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
// The two CSS files of the template that declare the tokens a page can read.
const TOKEN_FILES = [
	join(templateRoot, "src", "styles", "engine.css"),
	join(templateRoot, "src", "styles", "tokens.css"),
];

// Level-2 heading lines of each option file, in file order. The test puts the "# <title> <id>" line first.
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

/** Level of a Markdown heading line, for example 2 for "## Data". Undefined for any other line. */
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

/** Text of a skill file, or undefined when the file does not exist. */
function readSkillFile(path: string): string | undefined {
	const fullPath = join(skillDir, path);
	return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : undefined;
}

describe("app-dashboard skill", () => {
	it("documents every home, KPI, and chart id in a file with its headings", () => {
		const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
		const gaps: string[] = [];
		// The agent picks a home from these table rows of SKILL.md.
		for (const id of APP_RECIPE_OPTIONS.home) {
			if (!skill.includes(`| ${id} |`)) {
				gaps.push(`SKILL.md: no table row for ${id}`);
			}
		}
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
				gaps.push(`${file}: missing`);
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

	// A theme engine change removed --chart-stroke and --main-padding while the skill still named them.
	// The agent then writes code that reads an undefined variable, and the browser drops it with no error.
	it("names only CSS variables that engine.css or tokens.css declares", () => {
		const declared = new Set(
			TOKEN_FILES.flatMap((path) =>
				[...readFileSync(path, "utf8").matchAll(/(--[\w-]+)\s*:/g)].flatMap(
					(match) => match[1] ?? [],
				),
			),
		);
		const gaps: string[] = [];

		for (const path of readdirSync(skillDir, {
			encoding: "utf8",
			recursive: true,
		})) {
			if (!path.endsWith(".md")) {
				continue;
			}
			const markdown = readFileSync(join(skillDir, path), "utf8");
			// The lookahead skips a name that a template string or a "<key>" slot completes, such as `--chart-${n}`.
			for (const match of markdown.matchAll(
				/(?<![\w-])(--[a-z][a-z0-9-]*[a-z0-9])(?![\w$<-])/g,
			)) {
				const name = match[1] ?? "";
				// ChartContainer sets --color-<key> for each key of the chart config, so no CSS file declares it.
				if (!declared.has(name) && !name.startsWith("--color-")) {
					gaps.push(`${path}: ${name}`);
				}
			}
		}

		expect(gaps).toEqual([]);
	});
});
