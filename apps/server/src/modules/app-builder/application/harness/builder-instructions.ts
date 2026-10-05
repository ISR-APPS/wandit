/**
 * Builds session rules for the builder-turn runtime.
 * Uses the project ID to keep first-build web shell defaults stable across chats.
 * The runtime passes the design world order of the project; the template files hold the worlds.
 */
import { createHash } from "node:crypto";

function pickProjectDefault(
	projectId: string,
	axis: string,
	choices: readonly [string, ...string[]],
): string {
	// Separate hashes let each design choice vary without coupling it to another choice.
	const hash = createHash("sha256").update(`${projectId}:${axis}`).digest();
	const index = hash.readUInt32BE(0) % choices.length;
	// SAFETY: choices is nonempty, and the modulo keeps index inside the array.
	return choices[index] as string;
}

/** Supplies the same rules to new and resumed sessions without storing another project setting. */
export function buildBuilderInstructions(input: {
	/** Project row ID, not a chat or turn ID. */
	projectId: string;
	/** Template family from the project row, such as web-app. */
	framework: string;
	/** Interface locale codes copied into the project row at creation. */
	languages: readonly string[];
	/**
	 * Design world ids of the template, in the fixed order of this project
	 * (`worldOrder` of the worlds module). Empty for a template with no app worlds.
	 */
	designWorldOrder: readonly string[];
}): string {
	// The interface locale does not select the generated app's language.
	const base =
		`The language of the user's wandit interface is ${input.languages.join(", ")}: a hint for the app language, not a decision. ` +
		"Ask the user with the ask_user tool only when you cannot decide yourself, and for the app language on the first build (CLAUDE.md): put every question of one step in ONE call. " +
		"Write the Bash and Agent description in the user's language: the chat shows it to the user. " +
		"Follow CLAUDE.md: plan before you code, run its checks before you say that you are done, and end with a short answer in plain words.";
	const worlds = input.designWorldOrder.join(", ");
	// A project from an older template has no world skill, so the sentence says to skip it.
	if (input.framework === "mobile-app" && worlds !== "") {
		return `${base} The design world order of this project is: ${worlds}. On the first build, ask for the design world with the app language, as the design-worlds-mobile skill says; without that skill, ignore it.`;
	}
	// Other template families keep their own design rules.
	if (input.framework !== "web-app") return base;

	// Shell defaults vary per project. The design world sets the look and can override them.
	const variant = pickProjectDefault(input.projectId, "variant", [
		"sidebar",
		"inset",
		"rail",
	]);
	const density = pickProjectDefault(input.projectId, "density", [
		"compact",
		"comfortable",
	]);
	const contentWidth = pickProjectDefault(input.projectId, "contentWidth", [
		"full",
		"centered",
	]);

	return `${base}
Choose application or marketing intent from the requested workflow before style. For SaaS, CRM, admin, or internal tools, build a useful workspace with working task screens. A landing page plus login is not the app. Preserve auth guards and access control. For an explicit website or landing page, use the matching design-world skill.
Respect explicit user constraints first. For an existing app, reuse its routes, design, and chosen literals on edits or new chats. Do not move existing routes unless requested. For a first application build, make / enter the workspace through existing auth. Starter scaffolding is not an established user design. Use these defaults only for unspecified first-build choices:
variant=${variant}
density=${density}
contentWidth=${contentWidth}
designWorlds=${worlds}
For a first application build, the look comes from an app design world: ask for it with the app language, as the design-worlds-app skill says. The world wins over variant and density. Without that skill, keep the current tokens.
Select analytics, operations, or workbench from the actual workflow, not the seed. Save final choices as literals in app code. Do not add a theme customizer.
For application builds, read .claude/skills/dashboard/SKILL.md if present. If the dashboard kit exists, inspect its API and import ~/shared/ui/dashboard-shell and ~/shared/ui/dashboard-content. Older templates can lack these files. In that case, apply this guidance with existing components. Keep skill and component source on disk.`;
}
