import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { LoggingRepoRestorer } from "./logging-repo-restorer";

describe("LoggingRepoRestorer", () => {
	it("boots through Nest with the default logger", async () => {
		// SandboxLogger is a type-only dependency: @Optional must let the
		// container skip the erased token instead of failing the boot.
		const module = await Test.createTestingModule({
			providers: [LoggingRepoRestorer],
		}).compile();

		expect(module.get(LoggingRepoRestorer)).toBeInstanceOf(LoggingRepoRestorer);
	});
});
