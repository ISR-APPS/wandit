import { describe, expect, it } from "vitest";

import { getDirectionCandidatesTool } from "./get-direction-candidates.tool";

describe("get_direction_candidates tool", () => {
	it("defaults an omitted pageKind to COD while preserving the explicit website menu", async () => {
		const execute = getDirectionCandidatesTool.execute;
		if (!execute) {
			throw new Error("get_direction_candidates tool must have execute");
		}
		const callOptions = {
			messages: [],
			toolCallId: "call_1",
		} as unknown as Parameters<typeof execute>[1];
		const input = {
			business: "home appliance",
			industryHints: ["home & kitchen"],
		};

		const cod = await execute(input, callOptions);

		expect(cod).toMatchObject({
			candidates: expect.stringContaining("COD FUNNEL WORLDS"),
		});
		expect(cod).toMatchObject({
			candidates: expect.not.stringContaining("WEBSITE WORLDS"),
		});

		const website = await execute(
			{ ...input, pageKind: "website" },
			callOptions,
		);

		expect(website).toMatchObject({
			candidates: expect.stringContaining("WEBSITE WORLDS"),
		});
	});
});
