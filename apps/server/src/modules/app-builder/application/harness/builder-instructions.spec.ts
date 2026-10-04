import { describe, expect, it } from "vitest";
import { buildBuilderInstructions } from "./builder-instructions";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

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
		};
		const instructions = buildBuilderInstructions(input);

		expect(buildBuilderInstructions(input)).toBe(instructions);
		expect(selectedDefault(instructions, "variant")).toBe("inset");
		expect(selectedDefault(instructions, "density")).toBe("compact");
		expect(selectedDefault(instructions, "contentWidth")).toBe("centered");
		expect(selectedDefault(instructions, "palette")).toContain("forest:");
		expect(selectedDefault(instructions, "radius")).toBe("0.625rem");
		// The prompt carries choices, while the template files carry implementation details.
		expect(Buffer.byteLength(instructions)).toBeLessThan(2_600);
	});

	it("varies each axis across UUIDs instead of coupling layout and theme", () => {
		// Two samples per possible combination give broad coverage without random test input.
		const sampleCount = 360;
		const instructions = Array.from({ length: sampleCount }, (_, index) =>
			buildBuilderInstructions({
				framework: "web-app",
				languages: ["en"],
				// Twelve digits fill the last UUID field with distinct, valid values.
				projectId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
			}),
		);
		const combinations = instructions.map((prompt) =>
			["variant", "density", "contentWidth"]
				.map((axis) => selectedDefault(prompt, axis))
				.join("/"),
		);
		// All three shells support both densities and both content widths.
		expect(new Set(combinations).size).toBe(12);
		expect(
			new Set(instructions.map((prompt) => selectedDefault(prompt, "radius"))),
		).toEqual(new Set(["0.375rem", "0.625rem", "0.875rem"]));
		for (const variant of ["sidebar", "inset", "rail"]) {
			const palettes = instructions
				.filter((prompt) => selectedDefault(prompt, "variant") === variant)
				.map((prompt) => selectedDefault(prompt, "palette").split(":")[0]);
			expect(new Set(palettes)).toEqual(
				new Set(["graphite", "ocean", "forest", "violet", "amber"]),
			);
		}
	});

	it("keeps dashboard defaults out of non-web instructions", () => {
		const instructions = buildBuilderInstructions({
			framework: "mobile-app",
			languages: ["fr", "ar"],
			projectId: PROJECT_ID,
		});
		expect(instructions).toContain("interface is fr, ar: a hint");
		expect(instructions).not.toContain("variant=");
		expect(instructions).not.toContain("dashboard");
	});
});
