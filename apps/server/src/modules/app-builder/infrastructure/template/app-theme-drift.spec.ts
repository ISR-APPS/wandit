import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	APP_THEME_OPTIONS,
	APP_THEME_TEMPLATE_SELECTION,
	type AppThemeFile,
	appThemeFileSchema,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { appThemeFileText } from "../sandbox/app-theme-file";

// CI installs only the workspace packages, so the template files find no "react".
// theme.ts calls only useSyncExternalStore, and only inside useAppTheme.
vi.mock("react", () => ({ useSyncExternalStore: () => undefined }));

const specDir = dirname(fileURLToPath(import.meta.url));
const templateStyles = resolve(
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
	"src",
	"styles",
);

/** The template zod schema of theme.json, the guard of the inline style on <html>. */
type TemplateThemeSchema = {
	safeParse(input: unknown): { success: boolean };
};

// tsc does not see the template files, so zod checks the shape of each loaded module.
const templateThemeModuleSchema = z.object({
	appThemeFileSchema: z.custom<TemplateThemeSchema>(
		(value) =>
			typeof value === "object" && value !== null && "safeParse" in value,
	),
});
const templateOptionsModuleSchema = z.object({
	APP_THEME_OPTIONS: z.record(
		z.string(),
		z.array(z.union([z.string(), z.number()])),
	),
});

/** The schema of templates/web-app/src/styles/theme.ts, loaded through vitest. */
async function templateThemeSchema(): Promise<TemplateThemeSchema> {
	const loaded = templateThemeModuleSchema.parse(
		await import(/* @vite-ignore */ join(templateStyles, "theme.ts")),
	);
	return loaded.appThemeFileSchema;
}

/** The template theme.json, parsed with the host schema. */
function templateThemeFile(): { text: string; file: AppThemeFile } {
	const text = readFileSync(join(templateStyles, "theme.json"), "utf8");
	return { file: appThemeFileSchema.parse(JSON.parse(text)), text };
}

/** Each edit puts one value in the file that could break out of the inline style or load a foreign font. */
const HOSTILE_EDITS: [string, (file: AppThemeFile) => void][] = [
	[
		"a ; that ends the color declaration",
		(file) => {
			file.resolved.light.background = "#ffffff;color:red";
		},
	],
	[
		"a } in the name",
		(file) => {
			file.name = "Ardoise}";
		},
	],
	[
		"a < in the name",
		(file) => {
			file.name = "<script>";
		},
	],
	[
		"a url( in a color",
		(file) => {
			file.resolved.dark.primary = "url(https://evil.test/x.png)";
		},
	],
	[
		"a quote in a font family",
		(file) => {
			file.resolved.fonts.sans.family = 'Geist"; color: red';
		},
	],
	[
		"a font stylesheet on a foreign host",
		(file) => {
			file.resolved.fonts.sans.href = "https://evil.test/css2?family=Inter";
		},
	],
	[
		"an uppercase hex color",
		(file) => {
			file.resolved.light.primary = "#FF0000";
		},
	],
];

describe("template theme files", () => {
	it("keeps the option lists of theme-options.ts equal to APP_THEME_OPTIONS", async () => {
		const loaded = templateOptionsModuleSchema.parse(
			await import(/* @vite-ignore */ join(templateStyles, "theme-options.ts")),
		);
		expect(loaded.APP_THEME_OPTIONS).toEqual(APP_THEME_OPTIONS);
	});

	it("keeps theme.json equal to the host build of APP_THEME_TEMPLATE_SELECTION, in the format of the host", async () => {
		const { file, text } = templateThemeFile();
		expect(text).toBe(
			appThemeFileText(
				buildAppThemeFile({
					origin: "template",
					selection: APP_THEME_TEMPLATE_SELECTION,
				}),
			),
		);
		// Every hostile case below needs a file that the template accepts as it is.
		expect((await templateThemeSchema()).safeParse(file).success).toBe(true);
	});

	it.each(HOSTILE_EDITS)("refuses %s", async (_label, edit) => {
		const hostile = structuredClone(templateThemeFile().file);
		edit(hostile);
		expect((await templateThemeSchema()).safeParse(hostile).success).toBe(
			false,
		);
	});
});
