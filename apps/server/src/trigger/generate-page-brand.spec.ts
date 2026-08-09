import { describe, expect, it } from "vitest";

import { appendProjectBrandAsset } from "./generate-page-brand";

describe("appendProjectBrandAsset", () => {
	it("leaves a brief byte-for-byte unchanged when the project has no logo", () => {
		expect(appendProjectBrandAsset("Build this page.\n", null)).toBe(
			"Build this page.\n",
		);
	});

	it("appends a delimited exact-url block with accessible restore guidance", () => {
		const logoUrl =
			"https://assets.wandit.example/uploads/user-1/logo-id/mark.webp";
		const brief = appendProjectBrandAsset("Build this page.", logoUrl);

		expect(brief).toContain("----- PROJECT BRAND ASSET -----");
		expect(brief).toContain(`Official project logo URL: ${logoUrl}`);
		expect(brief).toContain('data-brand="nav"');
		expect(brief).toContain('data-brand="footer"');
		expect(brief).toContain("aria-label");
		expect(brief).toContain("alt on the logo image");
		expect(brief).toContain("----- END PROJECT BRAND ASSET -----");
	});
});
