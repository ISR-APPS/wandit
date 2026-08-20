import { describe, expect, it } from "vitest";

import { assertNoEditorArtifacts, injectPixels } from "./pixel-injector";

const PAGE =
	"<!doctype html><html><head></head><body><h1>Hi</h1></body></html>";

type CreatedScript = { async?: boolean; src?: string; type?: string };

/**
 * Browser stubs small enough to run an injected snippet through
 * `new Function`, but which keep the TEST in control of when the deferred SDK
 * insert happens: requestIdleCallback and setTimeout only RECORD the callback,
 * and every event handler is only run when the test asks for it. Anything the
 * snippet does before `fireIdle()` is, by construction, work that a real
 * visitor pays for during the critical window.
 *
 * Timers are kept with their delay, because the snippet now uses two: the
 * ~0 ms idle fallback and the 3 s upper bound on the whole deferral.
 */
function browserStubs(readyState: "complete" | "loading") {
	const created: CreatedScript[] = [];
	const idleCallbacks: Array<() => void> = [];
	const timers: Array<{ callback: () => void; delay: number }> = [];
	const handlers = new Map<string, Array<() => void>>();
	const listen = (type: string, handler: () => void) => {
		handlers.set(type, [...(handlers.get(type) ?? []), handler]);
	};
	const fire = (type: string) => {
		for (const handler of handlers.get(type) ?? []) handler();
	};
	const firstScript = {
		parentNode: {
			insertBefore: (node: unknown) => {
				created.push(node as CreatedScript);
			},
		},
	};
	const documentStub = {
		addEventListener: listen,
		createElement: () => ({}) as CreatedScript,
		getElementsByTagName: () => [firstScript],
		readyState,
		visibilityState: "visible",
	};
	const windowStub: Record<string, unknown> = {
		addEventListener: listen,
		requestIdleCallback: (callback: () => void) => {
			idleCallbacks.push(callback);
			return 1;
		},
		setTimeout: (callback: () => void, delay?: number) => {
			timers.push({ callback, delay: delay ?? 0 });
			return 1;
		},
	};

	const drain = (due: (delay: number) => boolean) => {
		const firing = timers.filter((timer) => due(timer.delay));
		const pending = timers.filter((timer) => !due(timer.delay));

		timers.length = 0;
		timers.push(...pending);

		for (const timer of firing) timer.callback();
	};

	return {
		created,
		documentStub,
		// Idle time, plus the ~0 ms setTimeout that stands in for it.
		fireIdle: () => {
			for (const callback of idleCallbacks.splice(0)) callback();
			drain((delay) => delay <= 1);
		},
		fireLoad: () => fire("load"),
		firePageHide: () => fire("pagehide"),
		// The upper bound that fires when `load` never comes.
		fireLongTimer: () => drain((delay) => delay > 1),
		hide: () => {
			documentStub.visibilityState = "hidden";
			fire("visibilitychange");
		},
		idleCallbacks,
		windowStub,
	};
}

function runSnippet(
	html: string,
	provider: "meta" | "tiktok",
	stubs: ReturnType<typeof browserStubs>,
): void {
	// `fbq('init',…)` is a BARE identifier in the base code, so the stub
	// window has to sit on the scope chain — that is what `with` buys here.
	new Function(
		"window",
		"document",
		`with(window){${snippetBody(html, provider)}}`,
	)(stubs.windowStub, stubs.documentStub);
}

function snippetBody(html: string, provider: "meta" | "tiktok"): string {
	const pattern = new RegExp(
		`<script data-wandit-pixel="${provider}">(.*?)</script>`,
		"s",
	);

	return pattern.exec(html)?.[1] ?? "";
}

describe("injectPixels", () => {
	it("returns the bytes untouched when no pixels are configured", () => {
		expect(injectPixels(PAGE, { metaPixelId: null, tiktokPixelId: null })).toBe(
			PAGE,
		);
	});

	it("puts the Meta script in <head> and its noscript image in <body>", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const head = html.slice(0, html.indexOf("</head>"));
		const body = html.slice(html.indexOf("<body"));

		expect(head).toContain('data-wandit-pixel="meta"');
		expect(head).toContain("fbq('init','1234567890')");
		expect(head).toContain("fbq('track','PageView')");
		expect(body).toContain("<noscript>");
		expect(body).toContain("facebook.com/tr?id=1234567890");
		expect(html).not.toContain("tiktok");
	});

	it("puts the TikTok pixel alone in <head>", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});
		const head = html.slice(0, html.indexOf("</head>"));

		expect(head).toContain('data-wandit-pixel="tiktok"');
		expect(head).toContain("ttq.load('CABC123')");
		expect(head).toContain("ttq.page()");
		expect(html).not.toContain("fbq");
	});

	it("executes the Meta snippet: stub is immediate, fbevents.js waits for idle", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const stubs = browserStubs("complete");

		expect(() => runSnippet(html, "meta", stubs)).not.toThrow();

		const fbq = stubs.windowStub.fbq as
			| undefined
			| (((...args: unknown[]) => void) & { queue: IArguments[] });

		// The stub must exist at parse time: the leads runtime drops the Lead
		// conversion silently when window.fbq is missing.
		expect(typeof fbq).toBe("function");
		expect(Array.from(fbq?.queue ?? [], (entry) => Array.from(entry))).toEqual([
			["init", "1234567890"],
			["track", "PageView"],
		]);
		// Nothing was fetched yet — the whole point of the deferral.
		expect(stubs.created).toHaveLength(0);

		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
		expect(stubs.created[0]?.src).toBe(
			"https://connect.facebook.net/en_US/fbevents.js",
		);
		expect(stubs.created[0]?.async).toBe(true);
	});

	it("executes the TikTok snippet: loader assigned, SDK injected after idle, page() queued", () => {
		// Regression: an earlier snippet immediately invoked the loader, so
		// ttq.load was undefined and the pixel never registered anything.
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});
		const stubs = browserStubs("complete");

		expect(() => runSnippet(html, "tiktok", stubs)).not.toThrow();

		const ttq = stubs.windowStub.ttq as unknown[] & {
			_i?: Record<string, unknown>;
			track?: (...args: unknown[]) => void;
		};

		// Queue methods exist before the SDK does — an early lead still lands.
		expect(typeof ttq.track).toBe("function");
		expect(stubs.created).toHaveLength(0);

		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
		expect(stubs.created[0]?.src).toContain("sdkid=CABC123");
		expect(ttq._i?.CABC123).toBeDefined();
		expect(
			ttq.some((entry) => Array.isArray(entry) && entry[0] === "page"),
		).toBe(true);
	});

	it("holds the SDK insert until the load event when the document is still parsing", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const stubs = browserStubs("loading");

		runSnippet(html, "meta", stubs);

		// Still parsing → not even scheduled yet.
		expect(stubs.idleCallbacks).toHaveLength(0);

		stubs.fireLoad();

		expect(stubs.idleCallbacks).toHaveLength(1);
		expect(stubs.created).toHaveLength(0);

		stubs.fireIdle();
		// A second load event must not insert the SDK twice.
		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
	});

	it("falls back to setTimeout when requestIdleCallback is missing", () => {
		// Older Safari has no requestIdleCallback; the SDK must still arrive.
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const stubs = browserStubs("complete");
		delete stubs.windowStub.requestIdleCallback;

		runSnippet(html, "meta", stubs);

		expect(stubs.created).toHaveLength(0);

		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
	});

	// The deferral must be bounded by a timer, never by the subresources: the
	// `load` event waits for every image — including connector media served
	// from a provider host this platform does not control — and a queued
	// PageView is not a sent PageView.
	it("inserts the SDK on its own timer when the load event never fires", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const stubs = browserStubs("loading");

		runSnippet(html, "meta", stubs);

		expect(stubs.created).toHaveLength(0);

		stubs.fireLongTimer();
		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
		expect(stubs.created[0]?.src).toBe(
			"https://connect.facebook.net/en_US/fbevents.js",
		);
	});

	// The bouncing visitor: they leave long before `load`, so the SDK is
	// fetched at once — no idle wait — or the PageView dies in the queue.
	it("inserts the SDK immediately when the page turns hidden", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: null,
		});
		const stubs = browserStubs("loading");

		runSnippet(html, "meta", stubs);
		stubs.hide();

		expect(stubs.created).toHaveLength(1);
	});

	it("inserts the SDK immediately on pagehide, and only once", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: null,
			tiktokPixelId: "CABC123",
		});
		const stubs = browserStubs("loading");

		runSnippet(html, "tiktok", stubs);
		stubs.firePageHide();
		stubs.firePageHide();
		stubs.fireLoad();
		stubs.fireIdle();

		expect(stubs.created).toHaveLength(1);
	});

	// The conversion path: leads-runtime-script.ts calls this right after it
	// queues a Lead, so the event cannot sit in a stub queue while the visitor
	// closes the tab. Both snippets must answer the one hook.
	it("flushes both SDKs through window.wanditFlushPixels", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "1234567890",
			tiktokPixelId: "CABC123",
		});
		const stubs = browserStubs("loading");

		runSnippet(html, "meta", stubs);
		runSnippet(html, "tiktok", stubs);

		expect(stubs.created).toHaveLength(0);

		(stubs.windowStub.wanditFlushPixels as () => void)();

		expect(stubs.created.map((script) => script.src)).toEqual([
			"https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CABC123&lib=ttq",
			"https://connect.facebook.net/en_US/fbevents.js",
		]);

		// A later load event must not insert either SDK a second time.
		stubs.fireLoad();
		stubs.fireIdle();

		expect(stubs.created).toHaveLength(2);
	});

	// assertNoEditorArtifacts rejects the `__wandit-` prefix in published
	// bytes, so the flush hook must not carry it.
	it("names the flush hook without the editor artifact prefix", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(html).toContain("wanditFlushPixels");
		expect(() => assertNoEditorArtifacts(html)).not.toThrow();
	});

	it("injects both pixels", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(html).toContain('data-wandit-pixel="meta"');
		expect(html).toContain('data-wandit-pixel="tiktok"');
	});

	it("is idempotent — a second pass adds nothing", () => {
		const once = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});
		const twice = injectPixels(once, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(twice.match(/data-wandit-pixel="meta"/g)).toHaveLength(1);
		expect(twice.match(/data-wandit-pixel="tiktok"/g)).toHaveLength(1);
	});

	it("strips script-breaking characters from pixel ids", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "12</script><script>alert(1)",
			tiktokPixelId: null,
		});

		expect(html).not.toContain("alert(1)</script>");
		expect(html).toContain("fbq('init','12scriptscriptalert1')");
	});

	it("adds no editor artifacts", () => {
		const html = injectPixels(PAGE, {
			metaPixelId: "111",
			tiktokPixelId: "222",
		});

		expect(() => assertNoEditorArtifacts(html)).not.toThrow();
	});
});

describe("assertNoEditorArtifacts", () => {
	it("passes clean HTML", () => {
		expect(() => assertNoEditorArtifacts(PAGE)).not.toThrow();
	});

	it("throws when editor artifacts survive", () => {
		expect(() =>
			assertNoEditorArtifacts('<div id="__wandit-toolbar"></div>'),
		).toThrow(/__wandit-/);
	});
});
