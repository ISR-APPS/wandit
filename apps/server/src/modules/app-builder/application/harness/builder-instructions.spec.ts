import { describe, expect, it } from "vitest";
import { buildBuilderInstructions } from "./builder-instructions";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const WORLDS = ["fiche", "cadran", "brume"];

function selectedDefault(instructions: string, axis: string): string {
	const line = instructions
		.split("\n")
		.find((instruction) => instruction.startsWith(`${axis}=`));
	if (line === undefined) throw new Error(`Missing default for ${axis}`);
	return line.slice(axis.length + 1);
}

describe("buildBuilderInstructions", () => {
	it("keeps project defaults stable and subordinate to the requested app", () => {
		const input = {
			framework: "web-app",
			languages: ["en", "ar"],
			projectId: PROJECT_ID,
			designWorldOrder: WORLDS,
		};
		const instructions = buildBuilderInstructions(input);

		expect(buildBuilderInstructions(input)).toBe(instructions);
		expect(selectedDefault(instructions, "variant")).toBe("inset");
		expect(selectedDefault(instructions, "density")).toBe("compact");
		expect(selectedDefault(instructions, "contentWidth")).toBe("centered");
		// The project order of the app worlds replaces the old hashed palette and radius.
		expect(selectedDefault(instructions, "designWorlds")).toBe(
			"fiche, cadran, brume",
		);
		// The prompt carries choices, while the template files carry implementation details.
		expect(Buffer.byteLength(instructions)).toBeLessThan(2_600);
	});

	it("varies the shell defaults across UUIDs", () => {
		// 120 fixed UUIDs cover the 12 shell combinations many times, with no random input.
		const sampleCount = 120;
		const instructions = Array.from({ length: sampleCount }, (_, index) =>
			buildBuilderInstructions({
				framework: "web-app",
				languages: ["en"],
				// Twelve digits fill the last UUID field with distinct, valid values.
				projectId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
				designWorldOrder: WORLDS,
			}),
		);
		const combinations = instructions.map((prompt) =>
			["variant", "density", "contentWidth"]
				.map((axis) => selectedDefault(prompt, axis))
				.join("/"),
		);
		// All three shells support both densities and both content widths.
		expect(new Set(combinations).size).toBe(12);
	});

	it("keeps dashboard defaults out of non-web instructions", () => {
		const instructions = buildBuilderInstructions({
			framework: "mobile-app",
			languages: ["fr", "ar"],
			projectId: PROJECT_ID,
			designWorldOrder: ["vestiaire", "registre"],
		});
		expect(instructions).toContain("interface is fr, ar: a hint");
		expect(instructions).toContain(
			"design world order of this project is: vestiaire, registre.",
		);
		expect(instructions).not.toContain("variant=");
		expect(instructions).not.toContain("dashboard");
	});
});
