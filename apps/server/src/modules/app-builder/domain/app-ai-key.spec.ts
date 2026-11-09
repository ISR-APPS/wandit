import { describe, expect, it } from "vitest";

import {
	appAiKeysEqual,
	mintAppAiKey,
	projectIdOfAppAiKey,
} from "./app-ai-key";

const PROJECT_A = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const PROJECT_B = "ffffffff-0000-4111-8222-333333333333";
// 43 base64url characters: the length of 32 random bytes.
const RANDOM_PART = "A".repeat(43);

describe("app AI key", () => {
	it("parses the project id back from a minted key", () => {
		const key = mintAppAiKey(PROJECT_A);

		expect(projectIdOfAppAiKey(key)).toBe(PROJECT_A);
		expect(appAiKeysEqual(key, key)).toBe(true);
	});

	it("never opens project B with the random part of a key of project A", () => {
		const keyA = mintAppAiKey(PROJECT_A);
		const keyB = mintAppAiKey(PROJECT_B);
		// An attacker who holds key A puts the project id of B in front of it.
		const forged = `wnd_ai_${PROJECT_B.replaceAll("-", "")}_${keyA.slice(-43)}`;

		expect(projectIdOfAppAiKey(forged)).toBe(PROJECT_B);
		expect(appAiKeysEqual(forged, keyB)).toBe(false);
		expect(appAiKeysEqual(keyA, keyB)).toBe(false);
	});

	it.each([
		["an empty string", ""],
		["the prefix only", "wnd_ai_"],
		["a dashed project id", `wnd_ai_${PROJECT_A}_${RANDOM_PART}`],
		["upper-case hex", `wnd_ai_${"A".repeat(32)}_${RANDOM_PART}`],
		["a short random part", `wnd_ai_${"a".repeat(32)}_${"A".repeat(42)}`],
		["a long random part", `wnd_ai_${"a".repeat(32)}_${"A".repeat(44)}`],
		["another prefix", `wnd_xx_${"a".repeat(32)}_${RANDOM_PART}`],
		["a trailing space", `wnd_ai_${"a".repeat(32)}_${RANDOM_PART} `],
		[
			"a non-base64url character",
			`wnd_ai_${"a".repeat(32)}_${"A".repeat(42)}+`,
		],
	])("finds no project id in %s", (_label, key) => {
		expect(projectIdOfAppAiKey(key)).toBeNull();
	});
});
