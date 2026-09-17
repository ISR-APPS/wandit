// @vitest-environment jsdom

import { PERSONAL_WORKSPACE } from "@wandit/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hydrateWorkspaceScope } from "./workspace-provider";
import { getActiveWorkspaceId, setActiveWorkspaceId } from "./workspace-scope";

// The localStorage key prefix WorkspaceProvider writes; copied on purpose.
const STORAGE_PREFIX = "wandit-active-workspace:";

describe("hydrateWorkspaceScope", () => {
	const original = Object.getOwnPropertyDescriptor(window, "localStorage");
	const values = new Map<string, string>();
	// A Map-backed stand-in for the browser storage: Node 25 ships a stub without `setItem`.
	const fakeStorage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => {
			values.set(key, value);
		},
	};

	beforeEach(() => {
		values.clear();
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: fakeStorage,
		});
	});

	afterEach(() => {
		if (original) Object.defineProperty(window, "localStorage", original);
		setActiveWorkspaceId(PERSONAL_WORKSPACE);
	});

	it("sets the persisted organization of the user", () => {
		fakeStorage.setItem(`${STORAGE_PREFIX}user-1`, "org-1");
		hydrateWorkspaceScope("user-1");
		expect(getActiveWorkspaceId()).toBe("org-1");
	});

	it("falls back to personal when the user has no persisted choice", () => {
		// Another user's key must not leak: only the key of user-2 is read.
		fakeStorage.setItem(`${STORAGE_PREFIX}user-1`, "org-1");
		hydrateWorkspaceScope("user-2");
		expect(getActiveWorkspaceId()).toBe(PERSONAL_WORKSPACE);
	});

	it("keeps the in-memory organization", () => {
		// A `switchWorkspace` choice lives in the store; the stale persisted
		// value of the same user must not overwrite it.
		setActiveWorkspaceId("org-1");
		fakeStorage.setItem(`${STORAGE_PREFIX}user-1`, "org-2");

		hydrateWorkspaceScope("user-1");

		expect(getActiveWorkspaceId()).toBe("org-1");
	});

	it("falls back to personal when storage throws", () => {
		// Private mode can throw on every storage read.
		Object.defineProperty(window, "localStorage", {
			configurable: true,
			value: {
				getItem: () => {
					throw new Error("blocked storage");
				},
				setItem: () => undefined,
			},
		});

		hydrateWorkspaceScope("user-1");

		expect(getActiveWorkspaceId()).toBe(PERSONAL_WORKSPACE);
	});
});
