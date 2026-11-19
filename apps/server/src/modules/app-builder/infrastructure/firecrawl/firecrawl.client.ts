/**
 * Calls Firecrawl `POST /v2/scrape` (https://docs.firecrawl.dev/api-reference/endpoint/scrape)
 * for the `web_fetch` and `capture_site` host tools. `builder-turn.deps.ts` binds both
 * functions to `FIRECRAWL_API_KEY`. It calls `fetch` and parses the answer with
 * `firecrawlScrapeResponseSchema`. No SDK and no retry of a network error: the tool refunds.
 */
import {
	type FirecrawlScrapeResponse,
	firecrawlScrapeResponseSchema,
	type SiteStyleMap,
	siteStyleMapSchema,
} from "@wandit/contracts";

import { redactProviderText } from "../../../ai-errors/domain";
import type {
	SiteCaptureOutcome,
	SiteCaptureRequest,
	WebPageOutcome,
} from "../../domain/ports/web-pages";
import { CLONE_VIEWPORTS, STYLE_MAP_SCRIPT } from "../../domain/site-clone";

const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape";
// One Firecrawl credit of the Standard monthly plan costs $0.00099.
const FIRECRAWL_USD_MICROS_PER_CREDIT = 990;
// The Firecrawl error JSON is short. 500 chars keep its message and drop a long HTML page.
const ERROR_MESSAGE_MAX_CHARS = 500;

// Firecrawl stops a page read after 30 s. The client waits 15 s more for the answer.
const FETCH_SCRAPE_TIMEOUT_MS = 30_000;
const FETCH_CLIENT_TIMEOUT_MS = 45_000;
// A PDF costs one Firecrawl credit per page. 5 pages keep a page read below its fixed price.
const FETCH_PDF_MAX_PAGES = 5;

// Firecrawl stops a capture after 45 s. The client waits 10 s more for the answer.
const CAPTURE_SCRAPE_TIMEOUT_MS = 45_000;
const CAPTURE_CLIENT_TIMEOUT_MS = 55_000;
// 2 s after the load, so late content and web fonts are in the screenshot.
const CAPTURE_WAIT_AFTER_LOAD_MS = 2_000;
// JPEG quality of the screenshot. 80 keeps text edges sharp in a small file.
const CAPTURE_SCREENSHOT_QUALITY = 80;
// The file `branding.json` is a help for the agent. Above 100,000 chars it is too long to read.
const BRANDING_JSON_MAX_CHARS = 100_000;

// The browser window of each device, in CSS px. The heights are a laptop and a 390 px phone.
const CAPTURE_WINDOWS = {
	desktop: { height: 900, width: CLONE_VIEWPORTS.desktop.cssWidthPx },
	mobile: { height: 844, width: CLONE_VIEWPORTS.mobile.cssWidthPx },
} as const;

// These codes name our optional parts (the page script and the branding format), not the page.
const OPTIONAL_PART_ERROR_CODES: ReadonlySet<string> = new Set([
	"SCRAPE_ACTIONS_NOT_SUPPORTED",
	"SCRAPE_ACTION_ERROR",
	"SCRAPE_BRANDING_NOT_SUPPORTED",
]);

type FirecrawlScreenshotFormat = {
	type: "screenshot";
	fullPage: true;
	/** JPEG quality, 1 to 100. */
	quality: number;
	/** The browser window, in CSS px. */
	viewport: { width: number; height: number };
};

/** The fields of the scrape request that this client sends. */
type FirecrawlScrapeBody = {
	url: string;
	formats: Array<
		"markdown" | "rawHtml" | "images" | "branding" | FirecrawlScreenshotFormat
	>;
	/** True drops the navigation, the footer, and the side columns. */
	onlyMainContent: boolean;
	/** Firecrawl stops the scrape after this time, in ms. */
	timeout: number;
	parsers?: Array<{ type: "pdf"; maxPages: number }>;
	blockAds?: boolean;
	/** Wait after the page load, in ms. */
	waitFor?: number;
	/** Most age of a cached answer of Firecrawl, in ms. 0 reads the live page. */
	maxAge?: number;
	/** True emulates a phone. */
	mobile?: boolean;
	actions?: Array<{ type: "executeJavascript"; script: string }>;
};

type FirecrawlScrapeData = NonNullable<FirecrawlScrapeResponse["data"]>;

type FirecrawlScrapeOutcome =
	| { status: "ok"; data: FirecrawlScrapeData }
	| {
			status: "failed";
			/** The Firecrawl error code, for example `SCRAPE_ACTION_ERROR`. Null when the answer has none. */
			code: string | null;
			/** Redacted and cut. It is for the agent. */
			message: string;
	  };

/** Parses the body text of a scrape answer. Null when the text is not a scrape answer. */
function scrapeAnswerOf(text: string): FirecrawlScrapeResponse | null {
	try {
		const parsed = firecrawlScrapeResponseSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		// `JSON.parse` throws on a gateway error page, which is HTML. The caller reports the raw text.
		return null;
	}
}

/**
 * Sends one scrape request. `failed` is an answer that holds no usable page.
 * A network error, a timeout, or an abort throws.
 */
async function postScrape(
	apiKey: string,
	body: FirecrawlScrapeBody,
	timeoutMs: number,
	abortSignal: AbortSignal | undefined,
): Promise<FirecrawlScrapeOutcome> {
	const timeout = AbortSignal.timeout(timeoutMs);
	const response = await fetch(FIRECRAWL_SCRAPE_URL, {
		body: JSON.stringify(body),
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		method: "POST",
		signal:
			abortSignal === undefined
				? timeout
				: AbortSignal.any([abortSignal, timeout]),
	});
	const text = await response.text();
	const answer = scrapeAnswerOf(text);

	// Firecrawl sends some failures, such as a DNS failure, as HTTP 200 with `success: false`.
	if (
		!response.ok ||
		answer === null ||
		!answer.success ||
		answer.data === undefined
	) {
		// A provider body can echo a URL, a credential, or a full HTML page.
		// The cut can split an emoji in two. Postgres jsonb refuses the half that stays.
		const detail = redactProviderText(answer?.error ?? text)
			.slice(0, ERROR_MESSAGE_MAX_CHARS)
			.toWellFormed();
		return {
			code: answer?.code ?? null,
			message: `Firecrawl answered ${response.status}: ${detail}`,
			status: "failed",
		};
	}

	const pageStatus = answer.data.metadata?.statusCode;
	// Firecrawl read the page, but the site sent an error page. Only 2xx and 304 are a clean load.
	if (
		pageStatus !== undefined &&
		(pageStatus < 200 || pageStatus >= 300) &&
		pageStatus !== 304
	) {
		return {
			code: null,
			message: `The page answered HTTP ${pageStatus}`,
			status: "failed",
		};
	}

	return { data: answer.data, status: "ok" };
}

/** The provider cost of one answer, in USD micros. Null when Firecrawl sends no credit count. */
function costUsdMicrosOf(data: FirecrawlScrapeData): number | null {
	const creditsUsed = data.metadata?.creditsUsed;
	// Firecrawl counts in its own credits; metering stores whole USD micros.
	return creditsUsed === undefined
		? null
		: Math.round(creditsUsed * FIRECRAWL_USD_MICROS_PER_CREDIT);
}

/** The style map that the page script returned. Null when the answer holds no valid map. */
function styleMapOf(data: FirecrawlScrapeData): SiteStyleMap | null {
	const text = data.actions?.javascriptReturns.at(-1)?.value;
	if (text === undefined) {
		return null;
	}
	try {
		const parsed = siteStyleMapSchema.safeParse(JSON.parse(text));
		return parsed.success ? parsed.data : null;
	} catch {
		// The source page controls this text, so it can be a text that is not JSON.
		// The capture stays good without a style map.
		return null;
	}
}

/**
 * Reads one page as markdown for `web_fetch`. A PDF gives its first 5 pages.
 * `abortSignal` is the signal of the tool call; the read also stops after 45 s.
 */
export async function fetchPageWithFirecrawl(
	apiKey: string,
	url: string,
	abortSignal: AbortSignal | undefined,
): Promise<WebPageOutcome> {
	const outcome = await postScrape(
		apiKey,
		{
			formats: ["markdown"],
			onlyMainContent: true,
			parsers: [{ maxPages: FETCH_PDF_MAX_PAGES, type: "pdf" }],
			timeout: FETCH_SCRAPE_TIMEOUT_MS,
			url,
		},
		FETCH_CLIENT_TIMEOUT_MS,
		abortSignal,
	);
	if (outcome.status === "failed") {
		return { message: outcome.message, status: "failed" };
	}

	const { data } = outcome;
	const markdown = data.markdown ?? "";
	if (markdown.trim() === "") {
		return { message: "The page has no text", status: "failed" };
	}

	return {
		costUsdMicros: costUsdMicrosOf(data),
		page: {
			finalUrl: data.metadata?.url ?? url,
			markdown,
			title: data.metadata?.title ?? null,
		},
		status: "ok",
	};
}

/**
 * The scrape request of one capture. `hasOptionalParts` adds the page script
 * and, on desktop, the branding format.
 */
function captureBodyOf(
	request: SiteCaptureRequest,
	hasOptionalParts: boolean,
): FirecrawlScrapeBody {
	const screenshot: FirecrawlScreenshotFormat = {
		fullPage: true,
		quality: CAPTURE_SCREENSHOT_QUALITY,
		type: "screenshot",
		viewport: CAPTURE_WINDOWS[request.device],
	};
	return {
		...(hasOptionalParts
			? { actions: [{ script: STYLE_MAP_SCRIPT, type: "executeJavascript" }] }
			: {}),
		blockAds: true,
		// The mobile capture gives only the phone layout. The page content comes from desktop.
		formats:
			request.device === "mobile"
				? [screenshot]
				: [
						"markdown",
						"rawHtml",
						"images",
						...(hasOptionalParts ? (["branding"] as const) : []),
						screenshot,
					],
		maxAge: 0,
		mobile: request.device === "mobile",
		onlyMainContent: false,
		timeout: CAPTURE_SCRAPE_TIMEOUT_MS,
		url: request.url,
		waitFor: CAPTURE_WAIT_AFTER_LOAD_MS,
	};
}

/**
 * Captures one page on one device for `capture_site`: a full-page screenshot,
 * the style map, and, on desktop, the page content. `abortSignal` is the
 * signal of the tool call; each request also stops after 55 s.
 */
export async function captureWithFirecrawl(
	apiKey: string,
	request: SiteCaptureRequest,
	abortSignal: AbortSignal | undefined,
): Promise<SiteCaptureOutcome> {
	let outcome = await postScrape(
		apiKey,
		captureBodyOf(request, true),
		CAPTURE_CLIENT_TIMEOUT_MS,
		abortSignal,
	);
	// One second try without the optional parts still gives the screenshot, so the site can be cloned.
	if (
		outcome.status === "failed" &&
		outcome.code !== null &&
		OPTIONAL_PART_ERROR_CODES.has(outcome.code)
	) {
		outcome = await postScrape(
			apiKey,
			captureBodyOf(request, false),
			CAPTURE_CLIENT_TIMEOUT_MS,
			abortSignal,
		);
	}
	if (outcome.status === "failed") {
		return { message: outcome.message, status: "failed" };
	}

	const { data } = outcome;
	if (data.screenshot === undefined) {
		return {
			message: "Firecrawl sent no screenshot of the page",
			status: "failed",
		};
	}

	const brandingJson =
		data.branding === undefined ? null : JSON.stringify(data.branding);
	return {
		capture: {
			brandingJson:
				brandingJson !== null && brandingJson.length <= BRANDING_JSON_MAX_CHARS
					? brandingJson
					: null,
			finalUrl: data.metadata?.url ?? request.url,
			imageUrls: data.images ?? [],
			markdown: data.markdown ?? null,
			rawHtml: data.rawHtml ?? null,
			screenshotUrl: data.screenshot,
			styleMap: styleMapOf(data),
			title: data.metadata?.title ?? null,
		},
		// A failed first request has no credit count, so this is the cost of the request that passed.
		costUsdMicros: costUsdMicrosOf(data),
		status: "ok",
	};
}
