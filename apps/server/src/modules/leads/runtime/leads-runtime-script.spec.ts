import { afterEach, describe, expect, it, vi } from "vitest";

import { buildLeadsRuntimeScript } from "./leads-runtime-script";

const CAPTURE_URL = "https://api.wandit.example/api/public/leads/pf_123";
const MAX_PAYLOAD_BYTES = 12 * 1024;

type RuntimeEvent = {
	detail?: unknown;
	target?: unknown;
	type?: string;
};

type RuntimeHandler = (event: RuntimeEvent) => void;

type RuntimeFetchInit = {
	body: string;
	credentials: string;
	headers: Record<string, string>;
	keepalive: boolean;
	method: string;
	mode: string;
};

type RuntimeResponse = {
	headers: { get: (name: string) => null | string };
	status: number;
};

type RuntimeFetch = (
	url: string,
	init: RuntimeFetchInit,
) => Promise<RuntimeResponse>;

function response(status: number, retryAfter?: string): RuntimeResponse {
	return {
		headers: {
			get: (name) =>
				name.toLowerCase() === "retry-after" ? (retryAfter ?? null) : null,
		},
		status,
	};
}

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((promiseResolve, promiseReject) => {
		resolve = promiseResolve;
		reject = promiseReject;
	});

	return { promise, reject, resolve };
}

async function flushMicrotasks(): Promise<void> {
	for (let index = 0; index < 8; index += 1) {
		await Promise.resolve();
	}
}

function createRuntimeHarness(
	options: {
		fetch?: RuntimeFetch;
		honeypot?: string;
		href?: string;
		/** Install fbq/ttq spies on the window stub (published-page pixels). */
		pixels?: boolean;
		referrer?: string;
		search?: string;
	} = {},
) {
	const script = buildLeadsRuntimeScript({ captureUrl: CAPTURE_URL });
	const documentListeners = new Map<string, RuntimeHandler[]>();
	const windowListeners = new Map<string, RuntimeHandler[]>();
	const beacons: Array<{ body: string; url: string }> = [];
	const results: Array<{ ok: boolean }> = [];
	const fetchMock = vi.fn(
		options.fetch ??
			(async () => {
				return response(200);
			}),
	);

	function addListener(
		listeners: Map<string, RuntimeHandler[]>,
		type: string,
		handler: RuntimeHandler,
	) {
		const handlers = listeners.get(type) ?? [];
		handlers.push(handler);
		listeners.set(type, handlers);
	}

	function emit(
		listeners: Map<string, RuntimeHandler[]>,
		type: string,
		event: RuntimeEvent,
	) {
		for (const handler of listeners.get(type) ?? []) {
			handler(event);
		}
	}

	const documentStub = {
		addEventListener: (type: string, handler: RuntimeHandler) => {
			addListener(documentListeners, type, handler);
		},
		dispatchEvent: (event: RuntimeEvent) => {
			if (event.type === "wandit:lead:result") {
				results.push(event.detail as { ok: boolean });
			}
			if (event.type) emit(documentListeners, event.type, event);
			return true;
		},
		querySelector: () =>
			options.honeypot === undefined ? null : { value: options.honeypot },
		referrer: options.referrer ?? "https://facebook.com/",
	};
	const navigatorStub = {
		sendBeacon: (url: string, body: string) => {
			beacons.push({ body, url });
			return true;
		},
	};
	const locationStub = {
		href:
			options.href ??
			"https://shop.example/landing?utm_source=facebook&fbclid=abc",
		search: options.search ?? "?utm_source=facebook&fbclid=abc",
	};
	const fbqCalls: unknown[][] = [];
	const ttqCalls: unknown[][] = [];
	const windowStub = {
		addEventListener: (type: string, handler: RuntimeHandler) => {
			addListener(windowListeners, type, handler);
		},
		...(options.pixels
			? {
					fbq: (...args: unknown[]) => {
						fbqCalls.push(args);
					},
					ttq: {
						track: (...args: unknown[]) => {
							ttqCalls.push(args);
						},
					},
				}
			: {}),
	};
	class CustomEventStub {
		detail: unknown;
		type: string;

		constructor(type: string, init: { detail: unknown }) {
			this.detail = init.detail;
			this.type = type;
		}
	}

	new Function(
		"document",
		"navigator",
		"location",
		"window",
		"fetch",
		"CustomEvent",
		script,
	)(
		documentStub,
		navigatorStub,
		locationStub,
		windowStub,
		fetchMock,
		CustomEventStub,
	);

	return {
		beacons,
		emitLead: (detail: Record<string, unknown>) => {
			emit(documentListeners, "wandit:lead", { detail });
		},
		fbqCalls,
		fetchMock,
		pagehide: () => {
			emit(windowListeners, "pagehide", {});
		},
		results,
		ttqCalls,
	};
}

afterEach(() => {
	vi.useRealTimers();
});

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

	it("wires CORS fetch acknowledgement and pagehide-only beacon fallback", () => {
		expect(script).toContain('document.addEventListener("wandit:lead"');
		expect(script).toContain('document.addEventListener("submit"');
		expect(script).toContain('window.addEventListener("pagehide"');
		expect(script).toContain('new CustomEvent("wandit:lead:result"');
		expect(script).toContain("[data-wandit-hp]");
		expect(script).toContain("navigator.sendBeacon");
		expect(script).toContain('mode: "cors"');
		expect(script).toContain('credentials: "omit"');
		expect(script).toContain('headers: { "Content-Type": "application/json" }');
		expect(script).toContain("keepalive: true");
		expect(script).not.toContain('mode: "no-cors"');
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

	it("waits for a 2xx acknowledgement before reporting success and deduping", async () => {
		const pending = deferred<RuntimeResponse>();
		const harness = createRuntimeHarness({
			fetch: () => pending.promise,
		});

		harness.emitLead({
			commune: "Bab El Oued",
			name: "Amine",
			phone: "٠٥٥٥١٢٣٤٥٦",
			quantity: 2,
			wilaya: "Alger",
		});

		expect(harness.fetchMock).toHaveBeenCalledTimes(1);
		expect(harness.beacons).toHaveLength(0);
		expect(harness.results).toEqual([]);

		const [url, init] = harness.fetchMock.mock.calls[0] ?? [];
		expect(url).toBe(CAPTURE_URL);
		expect(init).toMatchObject({
			credentials: "omit",
			headers: { "Content-Type": "application/json" },
			keepalive: true,
			method: "POST",
			mode: "cors",
		});

		const body = JSON.parse(init?.body ?? "{}");
		expect(body).toMatchObject({
			attribution: {
				fbclid: "abc",
				landing_url:
					"https://shop.example/landing?utm_source=facebook&fbclid=abc",
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

		pending.resolve(response(201));
		await flushMicrotasks();
		expect(harness.results).toEqual([{ ok: true }]);

		// The acknowledged phone is deduped even when its digits use another script.
		harness.emitLead({ name: "Amine", phone: "0555123456" });
		await flushMicrotasks();
		expect(harness.fetchMock).toHaveBeenCalledTimes(1);
		expect(harness.results).toEqual([{ ok: true }, { ok: true }]);
	});

	it("retries 429 and 5xx responses with bounded backoff", async () => {
		vi.useFakeTimers();
		const replies = [response(429, "120"), response(503), response(204)];
		const harness = createRuntimeHarness({
			fetch: async () => replies.shift() ?? response(500),
		});

		harness.emitLead({ name: "Nadia", phone: "0555000001" });
		await flushMicrotasks();
		expect(harness.fetchMock).toHaveBeenCalledTimes(1);

		// A large Retry-After value is honored, but capped at two seconds.
		await vi.advanceTimersByTimeAsync(1_999);
		expect(harness.fetchMock).toHaveBeenCalledTimes(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(harness.fetchMock).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(749);
		expect(harness.fetchMock).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(1);
		await flushMicrotasks();
		expect(harness.fetchMock).toHaveBeenCalledTimes(3);
		expect(harness.results).toEqual([{ ok: true }]);
	});

	it("bounds network retries, reports failure, and permits a later retry", async () => {
		vi.useFakeTimers();
		const harness = createRuntimeHarness({
			fetch: async () => {
				throw new Error("offline");
			},
		});

		harness.emitLead({ name: "Lina", phone: "0555000002" });
		await vi.runAllTimersAsync();
		expect(harness.fetchMock).toHaveBeenCalledTimes(3);
		expect(harness.results).toEqual([{ ok: false }]);

		// A failed transport did not write sentAt, so the same lead can try again.
		harness.emitLead({ name: "Lina", phone: "0555000002" });
		await vi.runAllTimersAsync();
		expect(harness.fetchMock).toHaveBeenCalledTimes(6);
		expect(harness.results).toEqual([{ ok: false }, { ok: false }]);

		// Exhausted fetches remain eligible for the last-resort lifecycle beacon.
		harness.pagehide();
		expect(harness.beacons).toHaveLength(1);
	});

	it("uses sendBeacon only for an unacknowledged payload on pagehide", async () => {
		const pending = deferred<RuntimeResponse>();
		const harness = createRuntimeHarness({
			fetch: () => pending.promise,
		});

		harness.emitLead({ name: "Sofiane", phone: "0555000003" });
		expect(harness.beacons).toHaveLength(0);

		harness.pagehide();
		expect(harness.beacons).toHaveLength(1);
		expect(harness.beacons[0]?.url).toBe(CAPTURE_URL);
		expect(JSON.parse(harness.beacons[0]?.body ?? "{}")).toMatchObject({
			name: "Sofiane",
			phone: "0555000003",
		});

		// Repeated lifecycle events do not queue the same payload twice.
		harness.pagehide();
		expect(harness.beacons).toHaveLength(1);

		pending.resolve(response(202));
		await flushMicrotasks();
		harness.pagehide();
		expect(harness.beacons).toHaveLength(1);
		expect(harness.results).toEqual([{ ok: true }]);
	});

	it("keeps UTF-8 payloads below 12 KiB while preserving canonical fields", () => {
		const largeValue = '"😀\\n'.repeat(400);
		const search = new URLSearchParams({
			fbclid: largeValue,
			ttclid: largeValue,
			utm_campaign: largeValue,
			utm_content: largeValue,
			utm_medium: largeValue,
			utm_source: largeValue,
			utm_term: largeValue,
		}).toString();
		const harness = createRuntimeHarness({
			href: `https://shop.example/landing?${search}`,
			referrer: `https://referrer.example/${largeValue}`,
			search: `?${search}`,
		});
		const detail: Record<string, unknown> = {
			commune: largeValue,
			name: largeValue,
			phone: "0555000004",
			wilaya: largeValue,
		};
		for (let index = 0; index < 25; index += 1) {
			detail[`extra-${index}-${"ض".repeat(80)}`] = largeValue;
		}

		harness.emitLead(detail);

		const payload = harness.fetchMock.mock.calls[0]?.[1]?.body ?? "";
		const body = JSON.parse(payload);
		expect(new TextEncoder().encode(payload).byteLength).toBeLessThanOrEqual(
			MAX_PAYLOAD_BYTES,
		);
		expect(body.phone).toBe("0555000004");
		expect(body.name).toBe(largeValue.trim().slice(0, 200));
	});

	// Ad-pixel Lead conversions (fbq/ttq are injected at publish time by
	// pixel-injector.ts; the runtime only fires the event).
	it("fires one Lead conversion per accepted capture on both pixels", async () => {
		const harness = createRuntimeHarness({ pixels: true });

		harness.emitLead({ phone: "0555000010" });
		await flushMicrotasks();

		expect(harness.results).toEqual([{ ok: true }]);
		expect(harness.fbqCalls).toEqual([["track", "Lead"]]);
		expect(harness.ttqCalls).toEqual([["Lead"]]);
	});

	it("fires no conversion when the capture endpoint rejects the lead", async () => {
		const harness = createRuntimeHarness({
			fetch: async () => response(400),
			pixels: true,
		});

		harness.emitLead({ phone: "0555000011" });
		await flushMicrotasks();

		expect(harness.results).toEqual([{ ok: false }]);
		expect(harness.fbqCalls).toEqual([]);
		expect(harness.ttqCalls).toEqual([]);
	});

	it("does not fire a second conversion on the same-phone dedupe path", async () => {
		const harness = createRuntimeHarness({ pixels: true });

		harness.emitLead({ phone: "0555000012" });
		await flushMicrotasks();
		harness.emitLead({ phone: "0555000012" });
		await flushMicrotasks();

		expect(harness.fetchMock).toHaveBeenCalledTimes(1);
		expect(harness.fbqCalls).toEqual([["track", "Lead"]]);
		expect(harness.ttqCalls).toEqual([["Lead"]]);
	});

	it("fires no conversion for a honeypot-trapped send (server 200s but drops it)", async () => {
		const harness = createRuntimeHarness({
			honeypot: "gotcha",
			pixels: true,
		});

		harness.emitLead({ phone: "0555000014" });
		await flushMicrotasks();

		expect(harness.results).toEqual([{ ok: true }]);
		expect(harness.fbqCalls).toEqual([]);
		expect(harness.ttqCalls).toEqual([]);
	});

	it("stays silent and still reports success when no pixels are installed", async () => {
		const harness = createRuntimeHarness();

		harness.emitLead({ phone: "0555000013" });
		await flushMicrotasks();

		expect(harness.results).toEqual([{ ok: true }]);
		expect(harness.fbqCalls).toEqual([]);
		expect(harness.ttqCalls).toEqual([]);
	});
});
