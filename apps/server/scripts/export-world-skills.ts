/**
 * Exports design-world and ads skills into templates/web-app/.claude/skills.
 * Run from apps/server: `npx tsx scripts/export-world-skills.ts`.
 * Reads designWorlds and ADS_SKILLS from the ai-chat agent module.
 * The output is deterministic: a second run writes no changes.
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ADS_SKILLS } from "../src/modules/ai-chat/agent/ads/index";
import type { DesignWorld } from "../src/modules/ai-chat/agent/worlds/index";
import { designWorlds } from "../src/modules/ai-chat/agent/worlds/index";

const scriptDir = dirname(fileURLToPath(import.meta.url));
// scripts/ -> server/ -> apps/ -> repo root.
const repoRoot = resolve(scriptDir, "..", "..", "..");
const agentDir = join(
	repoRoot,
	"apps",
	"server",
	"src",
	"modules",
	"ai-chat",
	"agent",
);
const defaultSkillsDir = join(
	repoRoot,
	"templates",
	"web-app",
	".claude",
	"skills",
);
const taxonomyPath = join(agentDir, "worlds", "landing", "taxonomy.md");

// Claude Code skill front matter caps description near 1 KB. 8 KB total keeps
// the index readable; past it the index splits into three kind groups.
const INDEX_DESCRIPTION_LIMIT_BYTES = 8 * 1024;

interface SkillFile {
	/** Folder name under .claude/skills. */
	slug: string;
	/** One-line summary used in the YAML front matter. */
	description: string;
	/** Full SKILL.md body after the front matter. */
	body: string;
}

function yamlQuote(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function firstLine(text: string): string {
	return text.split("\n")[0]?.trim() ?? "";
}

/** Renders one SKILL.md: YAML front matter plus the body verbatim. */
export function renderSkillMd(skill: SkillFile): string {
	return (
		`---\nname: ${yamlQuote(skill.slug)}\n` +
		`description: ${yamlQuote(skill.description)}\n---\n\n` +
		`${skill.body.trim()}\n`
	);
}

function worldSkill(world: DesignWorld): SkillFile {
	return {
		slug: world.id,
		description: world.tagline || firstLine(world.doc),
		body: world.doc,
	};
}

function worldRow(world: DesignWorld): string {
	return `| ${world.id} | ${world.name} | ${world.kind} | ${world.mood.join(", ")} | ${world.energy} | ${world.tagline} |`;
}

function worldTable(worlds: DesignWorld[]): string {
	const sorted = [...worlds].sort((a, b) => a.id.localeCompare(b.id));
	const header =
		"| id | name | kind | mood | energy | tagline |\n| --- | --- | --- | --- | --- | --- |";
	return `${header}\n${sorted.map(worldRow).join("\n")}`;
}

function taxonomySection(): string {
	if (!existsSync(taxonomyPath)) {
		return "";
	}
	const taxonomy = readFileSync(taxonomyPath, "utf8").trim();
	return `\n\n## Business taxonomy reference\n\n${taxonomy}`;
}

interface IndexGroup {
	slug: string;
	title: string;
	worlds: DesignWorld[];
}

function indexGroups(): IndexGroup[] {
	const totalDescriptionBytes = designWorlds.reduce(
		(sum, world) =>
			sum + Buffer.byteLength(world.tagline || firstLine(world.doc)),
		0,
	);
	if (totalDescriptionBytes <= INDEX_DESCRIPTION_LIMIT_BYTES) {
		return [
			{
				slug: "design-worlds",
				title: "All design worlds",
				worlds: designWorlds,
			},
		];
	}
	// Past the limit: one index per build kind. "both" worlds join both lists.
	return [
		{
			slug: "design-worlds-website",
			title: "Website design worlds",
			worlds: designWorlds.filter(
				(world) => world.kind === "website" || world.kind === "both",
			),
		},
		{
			slug: "design-worlds-product",
			title: "Product-page design worlds",
			worlds: designWorlds.filter(
				(world) => world.kind === "product" || world.kind === "both",
			),
		},
		{
			slug: "design-worlds-cod",
			title: "COD funnel design worlds",
			worlds: designWorlds.filter((world) => world.kind === "cod"),
		},
	];
}

function indexSkill(group: IndexGroup): SkillFile {
	return {
		slug: group.slug,
		description:
			`Index of the ${group.title.toLowerCase()}. ` +
			"Load the matching <id>/SKILL.md for the full world bible.",
		body: `# ${group.title}\n\nPick ONE world. Its id names the skill folder with the full design bible.${taxonomySection()}\n\n${worldTable(group.worlds)}`,
	};
}

/** Writes the file only when the content differs, so a re-run touches nothing. */
function writeIfChanged(path: string, content: string): void {
	if (existsSync(path) && readFileSync(path, "utf8") === content) {
		return;
	}
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content);
}

/**
 * Writes every skill under skillsDir. Returns the slugs written or unchanged.
 * Removes generated folders that no longer have a matching source.
 */
export function exportSkills(skillsDir: string): string[] {
	const skills: SkillFile[] = [
		...designWorlds.map(worldSkill),
		...indexGroups().map(indexSkill),
		...Object.values(ADS_SKILLS).map((skill) => ({
			slug: skill.slug,
			description: skill.description,
			body: `# ${skill.title}\n\n${skill.doc}`,
		})),
	];

	const expected = new Set(skills.map((skill) => skill.slug));
	if (existsSync(skillsDir)) {
		for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
			if (entry.isDirectory() && !expected.has(entry.name)) {
				rmSync(join(skillsDir, entry.name), { recursive: true, force: true });
			}
		}
	}

	const written: string[] = [];
	for (const skill of skills) {
		const path = join(skillsDir, skill.slug, "SKILL.md");
		writeIfChanged(path, renderSkillMd(skill));
		written.push(skill.slug);
	}
	return written.sort();
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
	const slugs = exportSkills(defaultSkillsDir);
	console.log(`exported ${slugs.length} skills to ${defaultSkillsDir}`);
}
