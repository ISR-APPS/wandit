/**
 * Publish-time ad-pixel injection. The builder is forbidden from emitting
 * trackers, so pixels enter the page exactly once: here, into the published
 * bytes only. Draft versions in R2 never contain them.
 *
 * Pure functions on purpose — no Nest, no I/O — so tests are trivial and the
 * publish pipeline stays the only caller.
 */
import { load } from "cheerio";

export type PixelIds = {
	metaPixelId: string | null;
	tiktokPixelId: string | null;
};

const PIXEL_MARKER = "data-wandit-pixel";

/**
 * The editor stamps its artifacts with `__wandit-` id prefixes and strips
 * them before every R2 write (pages/domain/stamp.ts). Publish reads bytes
 * from R2, so a leak is structurally impossible — this assertion exists to
 * keep it that way if anyone ever changes where publish reads from.
 */
export function assertNoEditorArtifacts(html: string): void {
	if (html.includes("__wandit-")) {
		throw new Error(
			"Refusing to publish: editor artifacts (__wandit-) found in HTML",
		);
	}
}

export function injectPixels(html: string, pixels: PixelIds): string {
	// No pixels configured → return the bytes untouched (no cheerio
	// round-trip, published output stays byte-identical to the draft).
	if (!pixels.metaPixelId && !pixels.tiktokPixelId) {
		return html;
	}

	const $ = load(html);

	// Scripts go in <head> (both providers' documented placement — the base
	// code must load before the visitor can convert); Meta's <noscript>
	// fallback image stays in <body> where an img is valid.
	if (pixels.metaPixelId && $(`script[${PIXEL_MARKER}="meta"]`).length === 0) {
		$("head").append(metaPixelScript(pixels.metaPixelId));
		$("body").append(metaPixelNoscript(pixels.metaPixelId));
	}

	if (
		pixels.tiktokPixelId &&
		$(`script[${PIXEL_MARKER}="tiktok"]`).length === 0
	) {
		$("head").append(tiktokPixelSnippet(pixels.tiktokPixelId));
	}

	return $.html();
}

function metaPixelScript(pixelId: string): string {
	const id = escapeForScript(pixelId);

	return `<script ${PIXEL_MARKER}="meta">!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`;
}

function metaPixelNoscript(pixelId: string): string {
	return `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1" alt=""/></noscript>`;
}

function tiktokPixelSnippet(pixelId: string): string {
	const id = escapeForScript(pixelId);

	// NOTE the `};ttq.load(` after insertBefore: ttq.load must be ASSIGNED,
	// not immediately invoked. The earlier version accidentally executed the
	// loader with (window,document,"ttq") — leaving ttq.load undefined, so
	// ttq.load(id) threw and the TikTok pixel never registered anything.
	return `<script ${PIXEL_MARKER}="tiktok">!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${id}');ttq.page();}(window,document,'ttq');</script>`;
}

// Pixel ids are numeric-ish strings from the project settings form. Allowlist
// rather than escape: anything outside [A-Za-z0-9_-] cannot be a pixel id and
// must never reach an inline script.
function escapeForScript(value: string): string {
	return value.replace(/[^A-Za-z0-9_-]/g, "");
}
