import { describe, expect, it } from "vitest";

import { inlineKnownCdnScripts } from "./inline-cdn-scripts";

const CORE_MARKER = "/*gsap core 3.12.5 inlined*/";
const SCROLLTRIGGER_MARKER = "/*gsap ScrollTrigger 3.12.5 inlined*/";

function page(scripts: string): string {
	return `<!doctype html><html><head><title>t</title></head><body><h1>Page</h1>${scripts}</body></html>`;
}

describe("inlineKnownCdnScripts", () => {
	it("inlines the standard jsdelivr core + ScrollTrigger pair", () => {
		const html = page(
			'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>' +
				'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>',
		);
		const inlined = inlineKnownCdnScripts(html);

		expect(inlined).toContain(CORE_MARKER);
		expect(inlined).toContain(SCROLLTRIGGER_MARKER);
		// The vendored sources actually ship, in place of the CDN requests.
		expect(inlined).toContain("* GSAP 3.12.5");
		expect(inlined).toContain("* ScrollTrigger 3.12.5");
		expect(inlined).not.toContain("cdn.jsdelivr.net");
	});

	it("inlines unpkg and cdnjs builds", () => {
		const inlined = inlineKnownCdnScripts(
			page(
				'<script src="https://unpkg.com/gsap@3.12.5/dist/gsap.min.js"></script>' +
					'<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>',
			),
		);

		expect(inlined).toContain(CORE_MARKER);
		expect(inlined).toContain(SCROLLTRIGGER_MARKER);
		expect(inlined).not.toContain("unpkg.com");
		expect(inlined).not.toContain("cdnjs.cloudflare.com");
	});

	it("accepts 3.x version variance, non-min builds, and loose tag syntax", () => {
		const inlined = inlineKnownCdnScripts(
			page(
				'<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.js"></script>' +
					"<script defer src='https://cdnjs.cloudflare.com/ajax/libs/gsap/3.11.4/ScrollTrigger.min.js'>\n</script>" +
					'<script src="//unpkg.com/gsap@3.12/dist/gsap.min.js?module"></script>',
			),
		);

		expect(inlined).not.toContain("src=");
		expect(inlined.split(CORE_MARKER)).toHaveLength(3);
		expect(inlined.split(SCROLLTRIGGER_MARKER)).toHaveLength(2);
	});

	it("inlines a self-closing sanctioned tag", () => {
		const inlined = inlineKnownCdnScripts(
			page(
				'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"/>' +
					"<p>after</p>",
			),
		);

		expect(inlined).toContain(CORE_MARKER);
		expect(inlined).toContain("<p>after</p>");
		expect(inlined).not.toContain("cdn.jsdelivr.net");
	});

	it("inlines a sanctioned tag with inline fallback body content, dropping the body", () => {
		const inlined = inlineKnownCdnScripts(
			page(
				'<script src="https://unpkg.com/gsap@3.12/dist/gsap.min.js">' +
					'window.gsap||document.write("fallback")</script>' +
					"<p>after</p>",
			),
		);

		expect(inlined).toContain(CORE_MARKER);
		expect(inlined).not.toContain('document.write("fallback")');
		expect(inlined).toContain("<p>after</p>");
		expect(inlined).not.toContain("unpkg.com");
	});

	it("never rewrites a GSAP-looking tag inside inline script text", () => {
		const html = page(
			"<script>var s='<script src=\"https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js\">';</script>",
		);

		expect(inlineKnownCdnScripts(html)).toBe(html);
	});

	it("never rewrites other GSAP majors to 3.12.5", () => {
		const html = page(
			'<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/2.1.3/TweenMax.min.js"></script>' +
				'<script src="https://cdn.jsdelivr.net/npm/gsap@4.0.0/dist/gsap.min.js"></script>',
		);

		expect(inlineKnownCdnScripts(html)).toBe(html);
	});

	it("leaves unknown scripts, inline scripts, and other HTML untouched", () => {
		const html = page(
			'<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js"></script>' +
				'<script src="./local.js"></script>' +
				'<script>gsap.to(".x", { opacity: 1 });</script>',
		);

		expect(inlineKnownCdnScripts(html)).toBe(html);
	});

	it("is idempotent — an already-inlined page passes through unchanged", () => {
		const once = inlineKnownCdnScripts(
			page(
				'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>' +
					'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>',
			),
		);

		expect(inlineKnownCdnScripts(once)).toBe(once);
	});

	it("never emits a premature </script> from the vendored sources", () => {
		const inlined = inlineKnownCdnScripts(
			page(
				'<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>',
			),
		);
		const opens = inlined.match(/<script\b/g) ?? [];
		const closes = inlined.match(/<\/script>/g) ?? [];

		expect(opens).toHaveLength(closes.length);
	});
});
