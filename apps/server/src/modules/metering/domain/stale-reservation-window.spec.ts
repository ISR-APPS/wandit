import { describe, expect, it } from "vitest";

import {
	AGENT_SESSION_STALE_AFTER_MS,
	RESERVATION_STALE_AFTER_MS,
	staleAfterMsFor,
} from "./stale-reservation-window";

describe("staleAfterMsFor", () => {
	it("gives agent_session the 90-minute window", () => {
		expect(staleAfterMsFor("agent_session")).toBe(90 * 60_000);
		expect(AGENT_SESSION_STALE_AFTER_MS).toBe(90 * 60_000);
	});

	it("keeps every other operation at 40 minutes", () => {
		expect(staleAfterMsFor("chat")).toBe(40 * 60_000);
		expect(staleAfterMsFor("sandbox")).toBe(RESERVATION_STALE_AFTER_MS);
		expect(RESERVATION_STALE_AFTER_MS).toBe(40 * 60_000);
	});
});
