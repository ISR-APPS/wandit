import { describe, expect, it } from "vitest";
import {
	buildLeadsCaptureUrl,
	findMarketDialCode,
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

	it("bakes the market dial code of the phone chip into the runtime", () => {
		const html =
			'<body><form><div class="phone-group"><span>IQ +964</span><input type="tel" name="phone"></div></form></body>';

		expect(injectLeadsRuntime(html, OPTIONS)).toContain(
			'var dialCode = "964";',
		);
	});
});

describe("findMarketDialCode", () => {
	// Markup shapes taken from live pages, plus the price traps next to them.
	it.each([
		{
			expected: "964",
			html: '<div class="phone-group" dir="ltr"><span class="market">IQ +964</span><input id="phone" type="tel" autocomplete="tel-national"></div>',
		},
		{
			expected: "212",
			html: '<div class="phone-input-group"><span>🇲🇦 +212 / +33</span><input type="tel" name="phone"></div>',
		},
		{
			expected: "216",
			html: '<div class="phone-group"><span>+٢١٦</span><input type="tel" name="phone"></div>',
		},
		{
			expected: undefined,
			html: '<form><span>Livraison +500 DA</span><input type="tel" name="phone"></form>',
		},
		{
			expected: undefined,
			html: '<form><div class="row"><span>Livraison +500 DA</span><input type="text" name="name"><input type="tel" name="phone"></div></form>',
		},
	])("reads $expected from the phone group", ({ expected, html }) => {
		expect(findMarketDialCode(html)).toBe(expected);
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
