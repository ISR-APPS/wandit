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

describe("exportSkills", () => {
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
