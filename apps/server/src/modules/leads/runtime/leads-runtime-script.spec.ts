import { describe, expect, it } from "vitest";

import { buildLeadsRuntimeScript } from "./leads-runtime-script";

const CAPTURE_URL = "https://api.wandit.example/api/public/leads/pf_123";

describe("buildLeadsRuntimeScript", () => {
	const script = buildLeadsRuntimeScript({ captureUrl: CAPTURE_URL });

	it("embeds a capture URL containing quotes and ampersands as valid JS", () => {
		const trickyUrl = 'https://api.wandit.example/capture?sig="a&b"&x=1';
		const tricky = buildLeadsRuntimeScript({ captureUrl: trickyUrl });

		expect(tricky).toContain(JSON.stringify(trickyUrl));
		expect(() => new Function(tricky)).not.toThrow();
	});

	it("folds < so a hostile URL cannot close the inline script tag", () => {
		const hostile = buildLeadsRuntimeScript({
			captureUrl: "https://evil.example/</script><script>alert(1)</script>",
		});

		expect(hostile.toLowerCase()).not.toContain("</script>");
		expect(hostile).toContain("\\u003c/script>");
		expect(() => new Function(hostile)).not.toThrow();
	});

	it("wires the event path, heuristic fallback, honeypot, and transport", () => {
		expect(script).toContain('document.addEventListener("wandit:lead"');
		expect(script).toContain('document.addEventListener("submit"');
		expect(script).toContain("[data-wandit-hp]");
		expect(script).toContain("navigator.sendBeacon");
		expect(script).toContain('mode: "no-cors"');
		expect(script).toContain("keepalive: true");
	});

	it("has no script-close, backtick, or interpolation breakage", () => {
		expect(script.toLowerCase()).not.toContain("</script>");
		expect(script).not.toContain("`");
		expect(script).not.toContain("${");
		// The label-collapsing regex must survive template-literal escaping
		// (a single backslash in the emitted script).
		expect(script).toContain("/\\s+/g");
		expect(() => new Function(script)).not.toThrow();
	});

	// vitest.config.ts pins environment: "node", so the one behavioral test
	// runs the IIFE against minimal DOM stubs instead of jsdom.
	it("sends a wandit:lead event via sendBeacon, splitting extras out and deduping repeats", () => {
		type Handler = (event: { detail?: unknown }) => void;
		const listeners = new Map<string, Handler>();
		const beacons: Array<{ body: string; url: string }> = [];
		const documentStub = {
			addEventListener: (type: string, handler: Handler) => {
				listeners.set(type, handler);
			},
			querySelector: () => null,
			referrer: "https://facebook.com/",
		};
		const navigatorStub = {
			sendBeacon: (url: string, body: string) => {
				beacons.push({ body, url });
				return true;
			},
		};
		const locationStub = {
			href: "https://shop.example/landing?utm_source=facebook&fbclid=abc",
			search: "?utm_source=facebook&fbclid=abc",
		};

		new Function("document", "navigator", "location", script)(
			documentStub,
			navigatorStub,
			locationStub,
		);

		const emit = listeners.get("wandit:lead");

		expect(emit).toBeDefined();
		expect(listeners.get("submit")).toBeDefined();

		// Arabic-Indic phone digits: dedupe must fold them to ASCII.
		emit?.({
			detail: {
				commune: "Bab El Oued",
				name: "Amine",
				phone: "٠٥٥٥١٢٣٤٥٦",
				quantity: 2,
				wilaya: "Alger",
			},
		});

		expect(beacons).toHaveLength(1);
		expect(beacons[0]?.url).toBe(CAPTURE_URL);

		const body = JSON.parse(beacons[0]?.body ?? "{}");

		expect(body).toMatchObject({
			attribution: {
				fbclid: "abc",
				landing_url: locationStub.href,
				referrer: "https://facebook.com/",
				utm_source: "facebook",
			},
			commune: "Bab El Oued",
			extras: { quantity: 2 },
			name: "Amine",
			phone: "٠٥٥٥١٢٣٤٥٦",
			wilaya: "Alger",
		});
		expect(body._hp).toBeUndefined();

		// Same phone (ASCII digits this time) inside the dedupe window: dropped.
		emit?.({ detail: { name: "Amine", phone: "0555123456" } });
		expect(beacons).toHaveLength(1);
	});
});
