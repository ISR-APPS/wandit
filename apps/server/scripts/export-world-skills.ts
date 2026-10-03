/**
 * Exports design-world and ads skills into templates/web-app/.claude/skills.
 * Run from apps/server: `npx tsx scripts/export-world-skills.ts`.
 * Reads designWorlds and ADS_SKILLS from the ai-chat agent module.
 * `toV2FormRule` swaps the V1 `wandit:lead` form rule of each world doc for V2.
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

// The V2 data path of a public form, in place of the V1 `wandit:lead` dispatch.
const FORM_CONTRACT = "the public form contract in CLAUDE.md";
// The field list after `in detail`, for example `({ name, phone })`.
const DETAIL_LIST = String.raw`(?:\s*\((?:[^()]|\([^()]*\))*\))?`;
// "dispatch the wandit:lead CustomEvent on document with ... in detail (...)".
// Group 1 is the verb ending, so the pointer keeps the grammar of the sentence.
const LEAD_DISPATCH_RE = new RegExp(
	String.raw`\bdispatch(es|ing)?\b[^.;]*?wandit:lead[^.;]*?\bin \`?detail\`?${DETAIL_LIST}`,
	"g",
);
// "the wandit:lead CustomEvent dispatched on document with ... in detail (...)".
const LEAD_DISPATCHED_RE = new RegExp(
	String.raw`\bthe wandit:lead CustomEvent dispatched\b[^.;]*?\bin \`?detail\`?${DETAIL_LIST}`,
	"g",
);

/**
 * Rewrites the V1 form data path of one world doc for a V2 app (WANDIT-273).
 * V1 pages still need the `wandit:lead` dispatch, so only the export rewrites it.
 * Throws when a `wandit:lead` clause stays or the honeypot sentence is lost.
 */
export function toV2FormRule(worldId: string, doc: string): string {
	const rewritten = doc
		.replace(LEAD_DISPATCH_RE, (_clause, ending: string | undefined) => {
			const verb =
				ending === "es" ? "sends" : ending === "ing" ? "sending" : "send";
			return `${verb} the fields as ${FORM_CONTRACT} says`;
		})
		.replace(LEAD_DISPATCHED_RE, `the fields sent as ${FORM_CONTRACT} says`)
		// V1 words that also name the old data path.
		.replace(/\bto the wandit runtime\b/g, "to the app's database")
		.replace(/\bnever pretends to POST\b/g, "never fakes a send");
	// A new V1 phrasing must fail the export, not reach the agent.
	if (rewritten.includes("wandit:lead")) {
		throw new Error(
			`world ${worldId}: a wandit:lead clause has a form that toV2FormRule does not know`,
		);
	}
	// The design skill keeps its honeypot rule; the RPC reads that field.
	if (doc.includes("data-wandit-hp") && !rewritten.includes("data-wandit-hp")) {
		throw new Error(
			`world ${worldId}: the rewrite removed the data-wandit-hp honeypot rule`,
		);
	}
	return rewritten;
}

function worldSkill(world: DesignWorld): SkillFile {
	return {
		slug: world.id,
		description: world.tagline || firstLine(world.doc),
		body: toV2FormRule(world.id, world.doc),
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
