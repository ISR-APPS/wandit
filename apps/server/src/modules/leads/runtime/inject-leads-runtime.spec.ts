import { describe, expect, it } from "vitest";
import {
	buildLeadsCaptureUrl,
	injectLeadsRuntime,
	LEADS_RUNTIME_SCRIPT_ID,
} from "./inject-leads-runtime";
import { buildLeadsRuntimeScript } from "./leads-runtime-script";

const OPTIONS = {
	captureUrl: "https://api.wandit.example/api/public/leads/pf_123",
	deploymentId: "0198d798-57ce-779a-8f7c-d16260401a81",
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

	it("replaces canonical stale runtime blocks with one freshly stamped block", () => {
		const oldOptions = {
			captureUrl: "https://old-api.wandit.example/api/public/leads/pf_old",
			deploymentId: "0198d798-57ce-779a-8f7c-d16260401a80",
		};
		const oldBlock = `${BLOCK_START}${buildLeadsRuntimeScript(oldOptions)}</script>`;
		const html = `<html><body>${oldBlock}<main>page</main>${oldBlock}</body></html>`;
		const result = injectLeadsRuntime(html, OPTIONS);

		expect(result.split(BLOCK_START)).toHaveLength(2);
		expect(result).toContain(JSON.stringify(OPTIONS.captureUrl));
		expect(result).toContain(JSON.stringify(OPTIONS.deploymentId));
		expect(result).not.toContain(JSON.stringify(oldOptions.captureUrl));
		expect(result).not.toContain(JSON.stringify(oldOptions.deploymentId));
		expect(result).toContain(`<main>page</main>${BLOCK_START}`);
		expect(result.endsWith("</script></body></html>")).toBe(true);
	});

	it("leaves merchant bytes untouched when the marker appears inside a script string", () => {
		const html = `<script>var x = '${BLOCK_START}';</script><body>page</body>`;

		expect(injectLeadsRuntime(html, OPTIONS)).toBe(html);
	});

	it("leaves a variant runtime carrier untouched", () => {
		const html = `<body><script data-x id="${LEADS_RUNTIME_SCRIPT_ID}">(function(){})();</script></body>`;

		expect(injectLeadsRuntime(html, OPTIONS)).toBe(html);
	});

	it("is idempotent for the same options", () => {
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
		const deploymentId = "0198d798-57ce-779a-8f7c-d16260401a82";
		const result = injectLeadsRuntime("<body></body>", {
			captureUrl,
			deploymentId,
		});

		expect(result).toContain(JSON.stringify(captureUrl));
		expect(result).toContain(JSON.stringify(deploymentId));
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
