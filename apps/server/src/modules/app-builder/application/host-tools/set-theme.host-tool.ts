/**
 * The `set_theme` host tool of the builder turn: the agent changes the app theme on the user's words.
 * `BuilderHostToolRegistry` builds it once per build turn of a web-app@1.1.0+ project.
 * It parses the input with parseThemePatch and applies it with applyThemePatch to the theme that the
 * runtime trusts. It writes src/styles/theme.json through app-theme-file.ts. A world source reads the V1 world registry.
 */
import {
	type SetThemeHostToolInput,
	setThemeHostToolInputSchema,
} from "@wandit/contracts";
import {
	APP_LOOK_IDS,
	APP_THEME_OPTIONS,
	type AppThemeFile,
	buildAppThemeFile,
} from "@wandit/contracts/v2/app-theme";
import { APP_THEME_CATEGORIES } from "@wandit/contracts/v2/app-theme-catalog";
import { type Tool, tool } from "ai";

import { worldCardOf } from "../../../ai-chat/agent/worlds";
import { applyThemePatch, parseThemePatch } from "../../domain/app-theme-deal";
import type { HostToolContext } from "../../domain/ports/host-tools";
import {
	readAppThemeFile,
	writeAppThemeFile,
} from "../../infrastructure/sandbox/app-theme-file";

/** The tool name the registry and the template CLAUDE.md share. */
export const SET_THEME_TOOL_NAME = "set_theme";

/** What the registry hands the set_theme tool factory. */
export type SetThemeHostToolDeps = {
	/** Gets one warning per failed sandbox read or write. The registry passes its own logger. */
	logger: Pick<Console, "warn">;
};

/** The allowed values of one option list, for the tool description. */
const optionsOf = (values: readonly string[]) => values.join("|");

/**
 * The one-line result the agent reads: the theme name and the shell choices it can tell the user.
 * It names icons and navIcon because coherentSelection can change them, for example color on the brand tone.
 * The last sentence repeats the rule of the template CLAUDE.md.
 */
function themeLineOf({ name, selection }: AppThemeFile): string {
	const userMenu =
		selection.userMenu === "header"
			? "top bar"
			: selection.userMenu.replace("-", " ");
	return (
		`Theme set: ${name} · ${selection.mode} · radius ${selection.radius} · ` +
		`${selection.sidebarStyle} sidebar · ${selection.activeItem} item · ` +
		`${selection.icons} icons · ${selection.navIcon} nav icons · user menu in ${userMenu}. Do not edit src/styles/theme.json.`
	);
}

/**
 * Builds the AI SDK tool the harness sees. A bad value never fails the call: the result text names
 * the allowed values and nothing changes. A sandbox failure answers a text and logs a warning.
 */
export function createSetThemeTool(
	deps: SetThemeHostToolDeps,
	context: HostToolContext,
): Tool<SetThemeHostToolInput, string> {
	return tool({
		description:
			"Change the theme of the app: colors, fonts, corners, shadows, and the app shell. The host " +
			"writes src/styles/theme.json; never edit it, engine.css, or theme.ts yourself. Name only " +
			"the fields to change: the other fields stay. " +
			`business (${optionsOf(APP_THEME_CATEGORIES)}) deals a whole theme for the business; ` +
			`look (${optionsOf(APP_LOOK_IDS)}); world: a design world id, for its palette and fonts; ` +
			"reroll: true deals another look; " +
			`mode (${optionsOf(APP_THEME_OPTIONS.mode)}); primary: look, a hue ` +
			`(${optionsOf(APP_THEME_OPTIONS.hue)}), or a #rrggbb brand color; background, foreground, ` +
			"and a hex primary together: three brand colors; font and displayFont: a font id such as " +
			`geist or fraunces, or look; scale (${optionsOf(APP_THEME_OPTIONS.scale)}); ` +
			`radius (${optionsOf(APP_THEME_OPTIONS.radius)}); border in px ` +
			`(${optionsOf(APP_THEME_OPTIONS.border)}); shadow (${optionsOf(APP_THEME_OPTIONS.shadow)}); ` +
			`shadowStyle (${optionsOf(APP_THEME_OPTIONS.shadowStyle)}); ` +
			`content (${optionsOf(APP_THEME_OPTIONS.content)}); ` +
			`sidebarStyle (${optionsOf(APP_THEME_OPTIONS.sidebarStyle)}); ` +
			`sidebarCollapse (${optionsOf(APP_THEME_OPTIONS.sidebarCollapse)}); ` +
			`sidebarStart (${optionsOf(APP_THEME_OPTIONS.sidebarStart)}); ` +
			`sidebarTone (${optionsOf(APP_THEME_OPTIONS.sidebarTone)}); ` +
			`activeItem (${optionsOf(APP_THEME_OPTIONS.activeItem)}); ` +
			`header (${optionsOf(APP_THEME_OPTIONS.header)}); ` +
			`userMenu (${optionsOf(APP_THEME_OPTIONS.userMenu)}); ` +
			`frame (${optionsOf(APP_THEME_OPTIONS.frame)}); ` +
			`icons (${optionsOf(APP_THEME_OPTIONS.icons)}): the Phosphor weight of every icon, thin is faint at small sizes; ` +
			`navIcon (${optionsOf(APP_THEME_OPTIONS.navIcon)}): the tile behind each nav icon, color gives each item its own hue. ` +
			"color needs a sidebarTone other than brand. On brand it becomes soft. " +
			"On a solid or color navIcon, thin and light icons become regular. " +
			"The result names the theme. A bad value changes nothing and lists the allowed values.",
		inputSchema: setThemeHostToolInputSchema,
		execute: async (input): Promise<string> => {
			const parsed = parseThemePatch(input);
			if (!parsed.ok) {
				return `Theme not changed. ${parsed.errors.join(" ")}`;
			}
			try {
				// An agent script can break the disk file, so the patch starts from the file the host trusts.
				// The disk file gives the base only when the pre-turn fallback failed.
				const current =
					context.knownThemeFile() ??
					(await readAppThemeFile(context.sandbox))?.file ??
					null;
				const next = applyThemePatch({
					current,
					patch: parsed.patch,
					projectId: context.projectId,
				});
				if (next === null) {
					return parsed.patch.business === undefined
						? "Theme not changed: name at least one field."
						: "Theme not changed: the user picked the current theme, and a business never replaces it. Name the fields to change.";
				}
				const { source } = next.selection;
				// The registry lives in the server, so the resolver gets the world card from here.
				const world =
					source.kind === "world" ? worldCardOf(source.world) : undefined;
				if (source.kind === "world" && world === undefined) {
					return `Theme not changed. world "${source.world}" is not a design world with a preview. Use the folder name of a design world skill.`;
				}
				const file = buildAppThemeFile({
					origin: next.origin,
					selection: next.selection,
					world,
				});
				await writeAppThemeFile(context.sandbox, file);
				context.onThemeFileWritten(file);
				return themeLineOf(file);
			} catch (error) {
				// The file stays as it was. The agent hears it and can try once more.
				deps.logger.warn("host-tool.set_theme.failed", {
					message: error instanceof Error ? error.message : String(error),
					projectId: context.projectId,
				});
				return "Theme not changed: the theme file could not be written. Try once more.";
			}
		},
	});
}
