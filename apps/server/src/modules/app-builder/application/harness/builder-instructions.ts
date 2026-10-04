/**
 * Builds session rules for the builder-turn runtime.
 * Uses the project ID to keep first-build web defaults stable across chats.
 * Calls Node crypto and leaves the detailed design rules in template files.
 */
import { createHash } from "node:crypto";

// Each palette supplies readable text and primary-action colors on its listed surfaces.
const DASHBOARD_PALETTES = [
	"graphite: --background=#fafafa, --foreground=#18181b, --card=#ffffff, --muted-foreground=#52525b, --primary=#27272a, --primary-foreground=#ffffff",
	"ocean: --background=#f8fafc, --foreground=#0f172a, --card=#ffffff, --muted-foreground=#475569, --primary=#1d4ed8, --primary-foreground=#ffffff",
	"forest: --background=#f7faf8, --foreground=#14251c, --card=#ffffff, --muted-foreground=#4b6355, --primary=#166534, --primary-foreground=#ffffff",
	"violet: --background=#faf9ff, --foreground=#24153a, --card=#ffffff, --muted-foreground=#645575, --primary=#6d28d9, --primary-foreground=#ffffff",
	"amber: --background=#fffbeb, --foreground=#292016, --card=#ffffff, --muted-foreground=#715c44, --primary=#92400e, --primary-foreground=#ffffff",
] as const;

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
}): string {
	// The interface locale does not select the generated app's language.
	const base =
		`The language of the user's wandit interface is ${input.languages.join(", ")}: a hint for the app language, not a decision. ` +
		"Ask the user with the ask_user tool only when you cannot decide yourself, and for the app language on the first build (CLAUDE.md): put every question of one step in ONE call. " +
		"Write the Bash and Agent description in the user's language: the chat shows it to the user. " +
		"Follow CLAUDE.md: plan before you code, run its checks before you say that you are done, and end with a short answer in plain words.";
	// Other template families keep their own design rules.
	if (input.framework !== "web-app") return base;

	// LIMIT: 180 first-build combinations. Upgrade: expand independent choices after design review.
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
	const palette = pickProjectDefault(
		input.projectId,
		"palette",
		DASHBOARD_PALETTES,
	);
	// These rem values vary corners without turning dashboard panels into pills.
	const radius = pickProjectDefault(input.projectId, "radius", [
		"0.375rem",
		"0.625rem",
		"0.875rem",
	]);

	return `${base}
Choose application or marketing intent from the requested workflow before style. For SaaS, CRM, admin, or internal tools, build a useful workspace with working task screens. A landing page plus login is not the app. Preserve auth guards and access control. For an explicit website or landing page, use the matching design-world skill.
Respect explicit user constraints first. For an existing app, reuse its routes, design, and chosen literals on edits or new chats. Do not move existing routes unless requested. For a first application build, make / enter the workspace through existing auth. Starter scaffolding is not an established user design. Use these defaults only for unspecified first-build choices:
variant=${variant}
density=${density}
contentWidth=${contentWidth}
palette=${palette}
radius=${radius}
Select analytics, operations, or workbench from the actual workflow, not the seed. Save final choices as literals in app code. Do not add a theme customizer.
For application builds, read .claude/skills/dashboard/SKILL.md if present. If the dashboard kit exists, inspect its API and import ~/shared/ui/dashboard-shell and ~/shared/ui/dashboard-content. Older templates can lack these files. In that case, apply this guidance with existing components. Keep skill and component source on disk.`;
}
