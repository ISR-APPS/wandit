import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
	exportSkills,
	renderSkillMd,
	toV2FormRule,
} from "../../../../../scripts/export-world-skills";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "wandit-skills-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("renderSkillMd", () => {
	it("writes YAML front matter and the body", () => {
		const md = renderSkillMd({
			slug: "atelier",
			description: "A quiet, crafted world.",
			body: "# Atelier\n\nThe doc body.",
		});
		expect(md).toBe(
			'---\nname: "atelier"\ndescription: "A quiet, crafted world."\n---\n\n# Atelier\n\nThe doc body.\n',
		);
	});
});

describe("toV2FormRule", () => {
	const pointer = "the fields as the public form contract in CLAUDE.md says";

	it.each([
		[
			"On valid submit dispatch the wandit:lead CustomEvent on document with the fields flat in detail ({ name, phone }); keep one decoy with data-wandit-hp.",
			`On valid submit send ${pointer}; keep one decoy with data-wandit-hp.`,
		],
		[
			"the page passes the order to the wandit runtime by dispatching the wandit:lead CustomEvent on document with the buyer's fields flat in detail (name, phone), while a decoy marked data-wandit-hp waits.",
			`the page passes the order to the app's database by sending ${pointer}, while a decoy marked data-wandit-hp waits.`,
		],
		[
			'the page dispatches the "wandit:lead" CustomEvent on `document` with its fields flat in `detail`.',
			`the page sends ${pointer}.`,
		],
		[
			'On valid submit dispatch on document: new CustomEvent("wandit:lead", { detail: { name } }) — the fields flat in detail. The form never pretends to POST.',
			`On valid submit send ${pointer}. The form never fakes a send.`,
		],
		[
			"one exposure leaves the page: the wandit:lead CustomEvent dispatched on document with the fields flat in detail (name, phone), while one decoy waits.",
			"one exposure leaves the page: the fields sent as the public form contract in CLAUDE.md says, while one decoy waits.",
		],
	])("rewrites %s", (doc, expected) => {
		expect(toV2FormRule("x", doc)).toBe(expected);
	});

	it("throws when a wandit:lead clause has an unknown form", () => {
		expect(() => toV2FormRule("x", "Fire wandit:lead on submit.")).toThrow(
			/world x/,
		);
	});

	it("throws when the rewrite removes the honeypot rule", () => {
		expect(() =>
			toV2FormRule(
				"x",
				"On valid submit dispatch data-wandit-hp and wandit:lead on document with the fields in detail.",
			),
		).toThrow(/data-wandit-hp/);
	});
});

describe("exportSkills", () => {
	it("writes no skill that names the V1 wandit:lead event", () => {
		const dir = makeTempDir();
		for (const slug of exportSkills(dir)) {
			expect(readFileSync(join(dir, slug, "SKILL.md"), "utf8")).not.toContain(
				"wandit:lead",
			);
		}
	});

	it("writes one SKILL.md per world with name and description front matter", () => {
		const dir = makeTempDir();
		const slugs = exportSkills(dir);
		expect(slugs.length).toBeGreaterThan(20);
		const atelier = readFileSync(join(dir, "atelier", "SKILL.md"), "utf8");
		expect(atelier).toMatch(/^---\nname: "atelier"\ndescription: ".+"\n---\n/);
	});

	it("writes the six ads skills", () => {
		const dir = makeTempDir();
		const slugs = exportSkills(dir);
		for (const slug of [
			"ads-fundamentals",
			"ads-creative",
			"ads-audiences",
			"ads-measurement",
			"ads-cod-maghreb",
			"ads-diagnostic",
		]) {
			expect(slugs).toContain(slug);
		}
	});

	it("is idempotent: a second run changes no file", () => {
		const dir = makeTempDir();
		exportSkills(dir);
		const before = readFileSync(join(dir, "atelier", "SKILL.md"), "utf8");
		exportSkills(dir);
		const after = readFileSync(join(dir, "atelier", "SKILL.md"), "utf8");
		expect(after).toBe(before);
	});

	it("removes a stale skill folder that no source produces", () => {
		const dir = makeTempDir();
		exportSkills(dir);
		const staleDir = join(dir, "stale-world");
		mkdirSync(staleDir, { recursive: true });
		writeFileSync(join(staleDir, "SKILL.md"), "stale");
		exportSkills(dir);
		expect(existsSync(staleDir)).toBe(false);
	});
});
