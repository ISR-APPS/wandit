import { describe, expect, it } from "vitest";

import { filterPrograms, normalizeProgramSearch } from "./program-matching";

type TestProgramItem = {
	id: string;
	program: {
		name: string;
		status: "active" | "archived";
	};
};

function program(
	name: string,
	status: "active" | "archived" = "active",
): TestProgramItem {
	return {
		id: name,
		program: { name, status },
	};
}

function names(items: readonly TestProgramItem[]): string[] {
	return items.map((item) => item.program.name);
}

describe("affiliate program matching", () => {
	it("returns the first 10 active programs alphabetically for an empty query", () => {
		const items = [
			program("Lima"),
			program("Bravo"),
			program("Aardvark archived", "archived"),
			program("Juliet"),
			program("Delta"),
			program("Alpha"),
			program("Kilo"),
			program("Hotel"),
			program("Charlie"),
			program("Foxtrot"),
			program("India"),
			program("Echo"),
			program("Golf"),
		];

		const result = filterPrograms(items, "");

		expect(names(result.items)).toEqual([
			"Alpha",
			"Bravo",
			"Charlie",
			"Delta",
			"Echo",
			"Foxtrot",
			"Golf",
			"Hotel",
			"India",
			"Juliet",
		]);
		expect(result.total).toBe(13);
		expect(names(items)).toEqual([
			"Lima",
			"Bravo",
			"Aardvark archived",
			"Juliet",
			"Delta",
			"Alpha",
			"Kilo",
			"Hotel",
			"Charlie",
			"Foxtrot",
			"India",
			"Echo",
			"Golf",
		]);
	});

	it("matches program names without accents", () => {
		const items = [program("Créateur 25%"), program("Partner flat fee")];

		expect(normalizeProgramSearch(" CRÉATEUR ")).toBe("createur");
		expect(names(filterPrograms(items, "createur").items)).toEqual([
			"Créateur 25%",
		]);
	});

	it("ranks prefix matches before substring matches", () => {
		const items = [
			program("Best creator tools"),
			program("Creator archived", "archived"),
			program("Creator launch"),
			program("The creator studio"),
		];

		expect(names(filterPrograms(items, "creator").items)).toEqual([
			"Creator launch",
			"Creator archived",
			"Best creator tools",
			"The creator studio",
		]);
	});

	it("sorts archived programs after active programs", () => {
		const items = [
			program("Alpha archived", "archived"),
			program("Zulu active"),
			program("Zulu archived", "archived"),
			program("Alpha active"),
		];

		expect(names(filterPrograms(items, "").items)).toEqual([
			"Alpha active",
			"Zulu active",
			"Alpha archived",
			"Zulu archived",
		]);
	});

	it("limits visible items while preserving the total match count", () => {
		const items = [
			program("Delta program"),
			program("Alpha program"),
			program("Charlie program"),
			program("Bravo program"),
		];

		const result = filterPrograms(items, "program", 2);

		expect(names(result.items)).toEqual(["Alpha program", "Bravo program"]);
		expect(result.total).toBe(4);
		expect(filterPrograms(items, "program", -1).items).toEqual([]);
	});

	it("treats a whitespace-only query as an empty query", () => {
		const items = [
			program("Bravo"),
			program("Alpha archived", "archived"),
			program("Alpha"),
		];

		const result = filterPrograms(items, "   ");

		expect(names(result.items)).toEqual(["Alpha", "Bravo", "Alpha archived"]);
		expect(result.total).toBe(3);
	});

	it("keeps input order for names that normalize to the same string", () => {
		const items = [program("Créateur"), program("Createur")];

		expect(names(filterPrograms(items, "").items)).toEqual([
			"Créateur",
			"Createur",
		]);
		expect(names(filterPrograms(items, "createur").items)).toEqual([
			"Créateur",
			"Createur",
		]);
	});

	it("matches an accented query against an unaccented name", () => {
		const result = filterPrograms([program("Createur 25%")], "créateur");

		expect(names(result.items)).toEqual(["Createur 25%"]);
		expect(result.total).toBe(1);
		expect(normalizeProgramSearch("CRÉATEUR ")).toBe("createur");
	});

	it("returns no items and a zero total when nothing matches", () => {
		const items = [program("Creator recurring"), program("Partner flat fee")];

		expect(filterPrograms(items, "ambassador")).toEqual({
			items: [],
			total: 0,
		});
	});
});
