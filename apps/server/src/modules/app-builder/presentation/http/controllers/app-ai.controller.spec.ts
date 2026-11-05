import { describe, expect, it } from "vitest";

import { PROJECT_ROLE_KEY } from "../../../../projects";
import { AppAiController } from "./app-ai.controller";

describe("AppAiController route metadata", () => {
	// Security: a project viewer must not read, rotate, or delete the AI key.
	// The project role decides, not the workspace header.
	it("needs the editor project role on every route", () => {
		expect(Reflect.getMetadata(PROJECT_ROLE_KEY, AppAiController)).toEqual({
			anyEngine: false,
			role: "editor",
		});
	});
});
