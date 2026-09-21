import { describe, expect, it } from "vitest";

import { authenticatedRemoteUrl, redactRemoteUrl } from "./git-remote-url";

describe("authenticatedRemoteUrl", () => {
	it("puts the username and the JWT password into the remote URL", () => {
		const url = authenticatedRemoteUrl(
			"https://acme.code.storage/wandit/project-1.git",
			{ username: "t", password: "header.payload.signature" },
		);

		expect(url).toBe(
			"https://t:header.payload.signature@acme.code.storage/wandit/project-1.git",
		);
	});
});

describe("redactRemoteUrl", () => {
	it("masks the password and keeps host and path", () => {
		expect(
			redactRemoteUrl(
				"https://t:secret-jwt@acme.code.storage/wandit/project-1.git",
			),
		).toBe("https://t:***@acme.code.storage/wandit/project-1.git");
	});

	it("leaves a URL without credentials unchanged", () => {
		expect(redactRemoteUrl("https://acme.code.storage/wandit/p.git")).toBe(
			"https://acme.code.storage/wandit/p.git",
		);
	});

	it("returns a non-URL value unchanged", () => {
		expect(redactRemoteUrl("not a url")).toBe("not a url");
	});
});
