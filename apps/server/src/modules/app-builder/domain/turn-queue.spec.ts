import { describe, expect, it } from "vitest";
import {
	assertCurrentTurn,
	isActiveStatus,
	isTerminalStatus,
	nextStatusForCancel,
	StaleTurnError,
} from "./turn-queue";

describe("isTerminalStatus", () => {
	it.each([
		"succeeded",
		"failed",
		"canceled",
		"stalled",
		"stopped_no_credits",
		"stopped_project_cap",
		"stopped_disabled",
	] as const)("returns true for %s", (status) => {
		expect(isTerminalStatus(status)).toBe(true);
		expect(isActiveStatus(status)).toBe(false);
	});

	it.each([
		"queued",
		"waiting",
		"running",
		"cancelling",
		"waiting_for_answer",
		"waiting_for_approval",
	] as const)("returns false for %s", (status) => {
		expect(isTerminalStatus(status)).toBe(false);
		expect(isActiveStatus(status)).toBe(true);
	});
});

describe("nextStatusForCancel", () => {
	it("sends a waiting turn straight to canceled (no run to die first)", () => {
		expect(nextStatusForCancel("waiting")).toBe("canceled");
	});

	it.each([
		"waiting_for_answer",
		"waiting_for_approval",
	] as const)("sends %s straight to canceled (the pause ended the run already)", (status) => {
		expect(nextStatusForCancel(status)).toBe("canceled");
	});

	it.each([
		"queued",
		"running",
	] as const)("sends %s through cancelling so the task can write a wip commit", (status) => {
		expect(nextStatusForCancel(status)).toBe("cancelling");
	});

	it("keeps cancelling for an idempotent retry", () => {
		expect(nextStatusForCancel("cancelling")).toBe("cancelling");
	});

	it("answers null for a terminal turn (cancel is a no-op)", () => {
		expect(nextStatusForCancel("succeeded")).toBeNull();
		expect(nextStatusForCancel("failed")).toBeNull();
	});
});

describe("assertCurrentTurn", () => {
	it("passes when the writer owns the newest turn number", () => {
		expect(() => assertCurrentTurn(3, 3)).not.toThrow();
		expect(() => assertCurrentTurn(2, 3)).not.toThrow();
	});

	it("throws a StaleTurnError when a newer turn owns the project", () => {
		expect(() => assertCurrentTurn(4, 3)).toThrowError(StaleTurnError);
		try {
			assertCurrentTurn(4, 3);
		} catch (error) {
			expect(error).toBeInstanceOf(StaleTurnError);
			// SAFETY: the instanceof assertion above proves the cast.
			const stale = error as StaleTurnError;
			expect(stale.code).toBe("BUILDER_TURN_STALE");
			expect(stale.current).toBe(4);
			expect(stale.turnNumber).toBe(3);
		}
	});
});
