import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	LANDING_PLAN_SELECTION_STORAGE_KEY,
	landingPlanSelection,
} from "./landing-plan-selection";

function installSessionStorage() {
	const values = new Map<string, string>();
	vi.stubGlobal("window", {
		sessionStorage: {
			getItem: (key: string) => values.get(key) ?? null,
			removeItem: (key: string) => {
				values.delete(key);
			},
			setItem: (key: string, value: string) => {
				values.set(key, value);
			},
		},
	});
	return values;
}

beforeEach(() => {
	installSessionStorage();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("landingPlanSelection", () => {
	it("round-trips a validated selection exactly once", () => {
		landingPlanSelection.stash({
			interval: "year",
			plan: "pro",
			tierCredits: 1000,
		});

		expect(landingPlanSelection.consume()).toEqual({
			interval: "year",
			plan: "pro",
			tierCredits: 1000,
		});
		expect(landingPlanSelection.consume()).toBeNull();
	});

	it("does not persist a legacy or cross-plan tier", () => {
		landingPlanSelection.stash({
			interval: "month",
			plan: "starter",
			tierCredits: 250,
		});

		expect(
			window.sessionStorage.getItem(LANDING_PLAN_SELECTION_STORAGE_KEY),
		).toBeNull();
	});

	it("deletes malformed or invalid stored data before returning", () => {
		window.sessionStorage.setItem(
			LANDING_PLAN_SELECTION_STORAGE_KEY,
			JSON.stringify({
				interval: "month",
				plan: "starter",
				tierCredits: 250,
			}),
		);

		expect(landingPlanSelection.consume()).toBeNull();
		expect(
			window.sessionStorage.getItem(LANDING_PLAN_SELECTION_STORAGE_KEY),
		).toBeNull();
	});

	it("fails closed when session storage is unavailable", () => {
		vi.stubGlobal("window", {
			sessionStorage: {
				getItem: () => {
					throw new Error("blocked");
				},
				removeItem: () => {
					throw new Error("blocked");
				},
				setItem: () => {
					throw new Error("blocked");
				},
			},
		});

		expect(() =>
			landingPlanSelection.stash({
				interval: "month",
				plan: "starter",
				tierCredits: 60,
			}),
		).not.toThrow();
		expect(landingPlanSelection.consume()).toBeNull();
	});
});
