import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import {
	exportSkills,
	toV2AdsText,
	toV2FormRule,
} from "../../../../../scripts/export-world-skills";

const tempDirs: string[] = [];
const dashboardSource = fileURLToPath(
	new URL("./dashboard-skill.md", import.meta.url),
);
const templateRoot = fileURLToPath(
	new URL("../../../../../../../templates/web-app/", import.meta.url),
);

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
		// fournil writes the plural "Forms never pretend to POST" (WANDIT-273 audit).
		[
			"Forms never pretend to POST to a server.",
			"Forms never fake a send to a server.",
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

describe("toV2AdsText", () => {
	it.each([
		[
			"Merchant-side truth by source and campaign is the Leads tab / read_lead_performance.",
			"Merchant-side truth by source and campaign is the app's leads table, read with run_sql.",
		],
		[
			"Platform lead counts roughly match the Leads tab. read_lead_performance (counts) is the truth.",
			"Platform lead counts roughly match the app's leads table. A run_sql query on the app's leads table (counts) is the truth.",
		],
		[
			"platform vs Leads-tab gap; rebuild from the Leads tab export.",
			"platform vs leads-table gap; rebuild from an export of the app's leads table.",
		],
	])("rewrites %s", (text, expected) => {
		expect(toV2AdsText("x", text)).toBe(expected);
	});

	it("throws when a V1 Leads tab phrase has an unknown form", () => {
		expect(() => toV2AdsText("x", "Compare both Leads tabs.")).toThrow(
			/ads skill x/,
		);
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

	it("exports the complete dashboard guide with real project source links", () => {
		const dir = makeTempDir();
		const slugs = exportSkills(dir);
		const dashboard = readFileSync(join(dir, "dashboard", "SKILL.md"), "utf8");
		const source = readFileSync(dashboardSource, "utf8").trim();
		expect(slugs.filter((slug) => slug === "dashboard")).toEqual(["dashboard"]);
		expect(dashboard).toMatch(
			/^---\nname: "dashboard"\ndescription: ".+"\n---\n/,
		);
		expect(dashboard.endsWith(`${source}\n`)).toBe(true);
		expect(
			readFileSync(
				join(templateRoot, ".claude/skills/dashboard/SKILL.md"),
				"utf8",
			),
		).toBe(dashboard);

		const sourceLinks = [
			...dashboard.matchAll(/\]\(\.\.\/\.\.\/\.\.\/(src\/[^)]+)\)/g),
		];
		expect(sourceLinks.length).toBeGreaterThan(0);
		for (const link of sourceLinks) {
			const path = link[1];
			if (!path) {
				throw new Error("The dashboard source link has no path");
			}
			expect(statSync(join(templateRoot, path)).isFile()).toBe(true);
		}
	});

	it("is idempotent: a second run changes no file", () => {
		const dir = makeTempDir();
		const slugs = exportSkills(dir);
		const before = slugs.map((slug) => {
			const path = join(dir, slug, "SKILL.md");
			// A fixed timestamp detects rewrites even when both export calls run within one clock tick.
			utimesSync(path, new Date(0), new Date(0));
			return {
				path,
				content: readFileSync(path, "utf8"),
				mtimeMs: statSync(path).mtimeMs,
			};
		});
		exportSkills(dir);
		for (const file of before) {
			expect(readFileSync(file.path, "utf8")).toBe(file.content);
			expect(statSync(file.path).mtimeMs).toBe(file.mtimeMs);
		}
	});

	it("removes stale folders and restores the registered dashboard skill", () => {
		const dir = makeTempDir();
		exportSkills(dir);
		const dashboardPath = join(dir, "dashboard", "SKILL.md");
		const dashboard = readFileSync(dashboardPath, "utf8");
		writeFileSync(dashboardPath, "old dashboard guide");
		const staleDir = join(dir, "stale-world");
		mkdirSync(staleDir, { recursive: true });
		writeFileSync(join(staleDir, "SKILL.md"), "stale");
		exportSkills(dir);
		expect(existsSync(staleDir)).toBe(false);
		expect(readFileSync(dashboardPath, "utf8")).toBe(dashboard);
	});
});
