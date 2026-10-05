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

// Axes with one skill file per option id. Every other axis is a "### <axis>=<id>" section of frame.md.
const OPTION_FOLDERS = new Map<string, string>([
	["theme", "themes"],
	["home", "homes"],
	["kpi", "kpis"],
	["chart", "charts"],
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

/** Text of one "## <heading>" section of a Markdown file. Empty when the heading is missing. */
function markdownSection(markdown: string, heading: string): string {
	const start = markdown.indexOf(`\n## ${heading}\n`);
	if (start === -1) {
		return "";
	}
	const end = markdown.indexOf("\n## ", start + 1);
	return markdown.slice(start, end === -1 ? undefined : end);
}

describe("app-dashboard skill", () => {
	it("documents every recipe option", () => {
		const skill = readFileSync(join(skillDir, "SKILL.md"), "utf8");
		const frameLines = new Set(
			readFileSync(join(skillDir, "frame.md"), "utf8").split("\n"),
		);
		const tokens = readFileSync(
			join(templateRoot, "src", "styles", "tokens.css"),
			"utf8",
		);
		const derived = declaredProperties(
			cssBlock(tokens, ":where(:root, .dark)"),
		);
		const lightNames = [
			...declaredProperties(cssBlock(tokens, ":root")),
			...derived,
		];
		const darkNames = [
			...declaredProperties(cssBlock(tokens, ".dark")),
			...derived,
		];
		const gaps: string[] = [];

		for (const [axis, ids] of Object.entries(APP_RECIPE_OPTIONS)) {
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

		// The agent picks a theme and a home from these table rows of SKILL.md.
		for (const id of [
			...APP_RECIPE_OPTIONS.theme,
			...APP_RECIPE_OPTIONS.home,
		]) {
			if (!skill.includes(`| ${id} |`)) {
				gaps.push(`SKILL.md: no table row for ${id}`);
			}
		}

		// A theme replaces the palette part of tokens.css. It must set every name of that part
		// and of the derived defaults, so no token falls back to the template palette.
		for (const id of APP_RECIPE_OPTIONS.theme) {
			const themePath = join(skillDir, "themes", `${id}.md`);
			if (!existsSync(themePath)) {
				continue;
			}
			const theme = readFileSync(themePath, "utf8");
			for (const [heading, required] of [
				["Light", lightNames],
				["Dark", darkNames],
			] as const) {
				const defined = new Set(
					declaredProperties(markdownSection(theme, heading)),
				);
				for (const name of required) {
					if (!defined.has(name)) {
						gaps.push(`themes/${id}.md, ${heading}: no ${name}`);
					}
				}
			}
		}

		expect(gaps).toEqual([]);
	});
});
