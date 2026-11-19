/**
 * Port: the two web page readers of the builder host tools.
 * The `web_fetch` tool calls `FetchWebPage`. The `capture_site` tool calls `CaptureSitePage`.
 * `builder-turn.deps.ts` binds each one to a provider client, today Firecrawl.
 * The types name no provider, so a change of provider changes only the client.
 */
import type { SiteStyleMap } from "@wandit/contracts";

/** One web page as markdown. The `web_fetch` tool cuts and caches it. */
export type WebPage = {
	/** The address of the page after redirects. */
	finalUrl: string;
	/** Null when the page has no title. */
	title: string | null;
	/** The full text of the page, not cut. */
	markdown: string;
};

/**
 * The answer of one page read. `failed` means that the provider answered
 * and did not read the page; its `message` is for the agent.
 */
export type WebPageOutcome =
	| {
			status: "ok";
			page: WebPage;
			/** Provider cost of the call, in millionths of a US dollar. Null when the provider sends no count. */
			costUsdMicros: number | null;
	  }
	| {
			status: "failed";
			/** Why the provider did not read the page. It holds no secret. */
			message: string;
	  };

/** Reads one page as markdown. A network error, a timeout, or an abort throws. */
export type FetchWebPage = (
	url: string,
	abortSignal: AbortSignal | undefined,
) => Promise<WebPageOutcome>;

/** One capture as the `capture_site` tool asks for it. The tool sends one per device. */
export type SiteCaptureRequest = {
	/** A public http(s) address. The tool input schema checks it first. */
	url: string;
	/** `desktop` is 1440 CSS px wide. `mobile` is 390 CSS px wide. */
	device: "desktop" | "mobile";
};

/** The reference data of one page on one device. The tool writes it into the sandbox. */
export type SitePageCapture = {
	/** The address of the page after redirects. */
	finalUrl: string;
	/** Null when the page has no title. */
	title: string | null;
	/** URL of the full-page screenshot on the storage of the provider. The tool downloads it. */
	screenshotUrl: string;
	/** The page text as markdown. Null for a mobile capture. */
	markdown: string | null;
	/** The full HTML of the page, not cleaned. Null for a mobile capture. */
	rawHtml: string | null;
	/** The URLs of the images of the page. Empty for a mobile capture. */
	imageUrls: string[];
	/** Design tokens of the page as JSON text. Null for a mobile capture, or when the provider has none. */
	brandingJson: string | null;
	/** Box and computed styles of each element. Null when the page script gave no valid map. */
	styleMap: SiteStyleMap | null;
};

/**
 * The answer of one capture. `failed` means that the provider answered
 * and did not capture the page; its `message` is for the agent.
 */
export type SiteCaptureOutcome =
	| {
			status: "ok";
			capture: SitePageCapture;
			/** Provider cost of the call, in millionths of a US dollar. Null when the provider sends no count. */
			costUsdMicros: number | null;
	  }
	| {
			status: "failed";
			/** Why the provider did not capture the page. It holds no secret. */
			message: string;
	  };

/** Captures one page on one device. A network error, a timeout, or an abort throws. */
export type CaptureSitePage = (
	request: SiteCaptureRequest,
	abortSignal: AbortSignal | undefined,
) => Promise<SiteCaptureOutcome>;
