import { describe, expect, it } from "vitest";

import { UnknownTemplateFrameworkError } from "../../domain/errors/unknown-template-framework.error";
import { profileForFramework } from "./template-profiles";

describe("profileForFramework", () => {
	it("answers the web profile for web-app", () => {
		expect(profileForFramework("web-app")).toEqual({
			devCommand: "pnpm run dev",
			devPort: 5173,
			framework: "web-app",
			versionFile: "web-app/template_version",
		});
	});

	it("answers the Metro profile for mobile-app", () => {
		expect(profileForFramework("mobile-app")).toEqual({
			devCommand: "pnpm run dev",
			devPort: 8081,
			framework: "mobile-app",
			versionFile: "mobile-app/template_version",
		});
	});

	it("throws a typed error that names an unknown framework", () => {
		expect(() => profileForFramework("tanstack-start")).toThrow(
			UnknownTemplateFrameworkError,
		);
		expect(() => profileForFramework("tanstack-start")).toThrow(
			'"tanstack-start"',
		);
	});
});
