/**
 * Builds src/styles/theme.json of one starter template from "theme" in its starter.json.
 * Run from apps/server: `npx tsx scripts/build-starter-theme.ts <id> [<workDir>]`.
 * A starter author runs it after a change of the theme selection. Nobody writes theme.json by hand.
 * It calls buildAppThemeFile and appThemeFileText, the builder and the text format of the host,
 * and writes templates/starters/<id>/files/src/styles/theme.json, plus the copy in <workDir>.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { starterTemplateIdSchema } from "@wandit/contracts";
import {
	appThemeNameSchema,
	appThemeSelectionSchema,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { z } from "zod";

import { worldCardOf } from "../src/modules/ai-chat/agent/worlds/index";
import {
	APP_THEME_FILE_PATH,
	appThemeFileText,
} from "../src/modules/app-builder/infrastructure/sandbox/app-theme-file";

/** The part of starter.json that this script reads. The other keys belong to the starter scripts. */
const starterThemeSchema = z.object({
	theme: z.object({
		/** The theme name that the Theme sheet of the builder shows. */
		name: appThemeNameSchema,
		/** The choices of the author. The host computes the palettes and the fonts from them. */
		selection: appThemeSelectionSchema,
	}),
});

const [id, workDirArg] = process.argv.slice(2);
// The id rule of the API. It also keeps the path inside templates/starters.
if (id === undefined || !starterTemplateIdSchema.safeParse(id).success) {
	console.error(
		"usage: npx tsx scripts/build-starter-theme.ts <id> [<workDir>]",
	);
	process.exit(1);
}

// scripts/ -> server/ -> apps/ -> repo root.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const starterDir = join(repoRoot, "templates", "starters", id);
const starterJsonPath = join(starterDir, "starter.json");
if (!existsSync(starterJsonPath)) {
	console.error(`error: ${starterJsonPath} does not exist.`);
	process.exit(1);
}
const workDir = workDirArg === undefined ? undefined : resolve(workDirArg);
if (workDir !== undefined && !existsSync(join(workDir, "src", "styles"))) {
	console.error(
		`error: ${workDir} is not a project. Run materialize.mjs first.`,
	);
	process.exit(1);
}

const parsed = starterThemeSchema.safeParse(
	JSON.parse(readFileSync(starterJsonPath, "utf8")),
);
if (!parsed.success) {
	console.error(
		`error: "theme" of ${starterJsonPath} is not valid.\n${z.prettifyError(parsed.error)}`,
	);
	process.exit(1);
}
const { name, selection } = parsed.data.theme;

// The world registry lives in the server. The set_theme host tool resolves a world id the same way.
const world =
	selection.source.kind === "world"
		? worldCardOf(selection.source.world)
		: undefined;
if (selection.source.kind === "world" && world === undefined) {
	console.error(
		`error: "${selection.source.world}" is not a design world with a preview.`,
	);
	process.exit(1);
}

// Origin "host": the first chat turn replaces a file with origin "template" (ensureThemeFile).
const text = appThemeFileText(
	buildAppThemeFile({ name, origin: "host", selection, world }),
);
const targets = [
	join(starterDir, "files", APP_THEME_FILE_PATH),
	...(workDir === undefined ? [] : [join(workDir, APP_THEME_FILE_PATH)]),
];
for (const target of targets) {
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, text);
	console.log(`wrote ${target}`);
}
