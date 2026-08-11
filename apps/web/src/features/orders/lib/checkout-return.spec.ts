import { afterEach, describe, expect, it, vi } from "vitest";

import {
	currentCheckoutReturnPath,
	domainCheckoutReturnFromSearch,
	withoutCheckoutReturnParams,
} from "./checkout-return";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("currentCheckoutReturnPath", () => {
	it("captures the pathname and search at checkout time", () => {
		vi.stubGlobal("window", {
			location: {
				pathname: "/p/project-1",
				search: "?tab=settings&keep=yes",
			},
		});

		expect(currentCheckoutReturnPath()).toBe(
			"/p/project-1?tab=settings&keep=yes",
		);
	});
});

describe("domainCheckoutReturnFromSearch", () => {
	it("reads a successful domain checkout session", () => {
		expect(
			domainCheckoutReturnFromSearch(
				"?tab=settings&checkout=success&purpose=order&session_id=cs_return",
			),
		).toEqual({ kind: "success", sessionId: "cs_return" });
	});

	it("reads a canceled checkout without requiring a session", () => {
		expect(domainCheckoutReturnFromSearch("?checkout=cancel")).toEqual({
			kind: "cancel",
		});
	});

	it("ignores a successful checkout without a session", () => {
		expect(domainCheckoutReturnFromSearch("?checkout=success")).toBeNull();
	});
});

describe("withoutCheckoutReturnParams", () => {
	it("removes only checkout callback values", () => {
		expect(
			withoutCheckoutReturnParams(
				"?tab=settings&checkout=success&purpose=order&session_id=cs_return&keep=yes",
			),
		).toBe("?tab=settings&keep=yes");
	});
});
