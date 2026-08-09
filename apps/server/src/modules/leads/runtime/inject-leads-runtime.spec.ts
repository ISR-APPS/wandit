import { describe, expect, it } from "vitest";

import {
	buildLeadsCaptureUrl,
	injectLeadsRuntime,
	LEADS_RUNTIME_SCRIPT_ID,
} from "./inject-leads-runtime";

const OPTIONS = {
	captureUrl: "https://api.wandit.example/api/public/leads/pf_123",
};

const BLOCK_START = `<script id="${LEADS_RUNTIME_SCRIPT_ID}">`;

describe("injectLeadsRuntime", () => {
	it("inserts the script immediately before the last </body>, case-insensitively", () => {
		const html = "<body>a</body><div>b</div></BODY>";
		const result = injectLeadsRuntime(html, OPTIONS);

		expect(result.startsWith(`<body>a</body><div>b</div>${BLOCK_START}`)).toBe(
			true,
		);
		expect(result.endsWith("</script></BODY>")).toBe(true);
	});

	it("appends at the end when the document has no body close tag", () => {
		const html = "<main>fragment</main>";
		const result = injectLeadsRuntime(html, OPTIONS);

		expect(result.startsWith(html)).toBe(true);
		expect(result).toContain(BLOCK_START);
		expect(result.endsWith("</script>")).toBe(true);
	});

	it("is idempotent", () => {
		const once = injectLeadsRuntime("<html><body></body></html>", OPTIONS);

		expect(injectLeadsRuntime(once, OPTIONS)).toBe(once);
		expect(once.indexOf(BLOCK_START)).toBe(once.lastIndexOf(BLOCK_START));
	});

	it("splices correctly when a Turkish İ precedes </body>", () => {
		// toLowerCase("İ") is two code units — an index taken from a lowered
		// copy would cut inside the closing tag and corrupt the publish.
		const html = "<html><body><h1>İstanbul İ</h1></body></html>";
		const result = injectLeadsRuntime(html, OPTIONS);

		expect(result).toContain("</script></body></html>");
		expect(result).toContain("<h1>İstanbul İ</h1>");
	});

	it("embeds the capture URL (quotes and ampersands intact) inside the wrapper", () => {
		const captureUrl = 'https://api.wandit.example/capture?a=1&sig="q"';
		const result = injectLeadsRuntime("<body></body>", { captureUrl });

		expect(result).toContain(JSON.stringify(captureUrl));
	});
});

describe("buildLeadsCaptureUrl", () => {
	it("joins the API origin with the public capture route", () => {
		expect(buildLeadsCaptureUrl("https://api.wandit.example", "pf_123")).toBe(
			"https://api.wandit.example/api/public/leads/pf_123",
		);
	});

	it("strips a trailing slash from the origin", () => {
		expect(buildLeadsCaptureUrl("https://api.wandit.example/", "pf_123")).toBe(
			"https://api.wandit.example/api/public/leads/pf_123",
		);
	});
});
