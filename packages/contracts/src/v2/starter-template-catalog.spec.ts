import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { starterTemplateManifestSchema } from "./starter-template-archive";
import { STARTER_TEMPLATES } from "./starter-template-catalog";
import { starterTemplateSchema } from "./starter-templates";

const repoRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../..",
);
const startersDir = join(repoRoot, "templates", "starters");
const imagesDir = join(repoRoot, "apps", "web", "public", "starter-templates");

describe("STARTER_TEMPLATES", () => {
	it("holds only valid entries, each with its own id", () => {
		const invalidIds = STARTER_TEMPLATES.filter(
			(entry) => !starterTemplateSchema.safeParse(entry).success,
		).map((entry) => entry.id);
		expect(invalidIds).toEqual([]);

		const ids = STARTER_TEMPLATES.map((entry) => entry.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	// An entry with no overlay makes each project from it fail in the apply task.
	// An overlay with no entry is packed and deployed, but no user can select it.
	it("has one overlay folder for each entry and no other overlay folder", () => {
		const overlayIds = readdirSync(startersDir, { withFileTypes: true })
			.filter(
				(item) =>
					item.isDirectory() &&
					existsSync(join(startersDir, item.name, "starter.json")),
			)
			.map((item) => item.name);
		expect(overlayIds.sort()).toEqual(
			STARTER_TEMPLATES.map((entry) => entry.id).sort(),
		);
	});

	// pack.mjs checks fewer path rules than the apply task. A bad "removed" path fails each apply.
	it("has a starter.json that the apply task accepts for each entry", () => {
		const removedSchema = starterTemplateManifestSchema.pick({ removed: true });
		const invalidIds = STARTER_TEMPLATES.filter(
			(entry) =>
				!removedSchema.safeParse(
					JSON.parse(
						readFileSync(join(startersDir, entry.id, "starter.json"), "utf8"),
					),
				).success,
		).map((entry) => entry.id);
		expect(invalidIds).toEqual([]);
	});

	it("has the cover and each gallery image of each entry", () => {
		const missingFiles = STARTER_TEMPLATES.flatMap((entry) =>
			[
				"cover.webp",
				...Array.from(
					{ length: entry.shots },
					(_, index) => `shot-${index + 1}.webp`,
				),
			]
				.filter((file) => !existsSync(join(imagesDir, entry.id, file)))
				.map((file) => `${entry.id}/${file}`),
		);
		expect(missingFiles).toEqual([]);
	});
});
