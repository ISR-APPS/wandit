/**
 * Reads the HTML of a captured page for a website clone, with cheerio, and
 * reads the size of a downloaded image, with sharp.
 * The `capture_site` host tool calls each function. The HTML comes from an
 * unknown website, so each URL that leaves this file is absolute http(s).
 */
import * as cheerio from "cheerio";
import sharp from "sharp";

import { SHARP_DECODE_OPTIONS } from "../../../../infrastructure/storage/optimize-image";

// `page.html` is at most 1.5 MB in the sandbox. The agent searches it with Grep.
const PAGE_HTML_MAX_CHARS = 1_500_000;
// The style sheets of one capture. More sheets are mostly third-party widgets.
const MAX_STYLE_SHEETS = 8;
// A `data:` URI above 1,000 chars: the 5 chars of "data:" and 996 more.
// A quote, a space, or ")" ends a URI in an attribute, in a srcset, and in CSS.
const LONG_DATA_URI = /data:[^"'\s)]{996,}/g;

// The address that resolves the relative URLs of the page. A `<base href>` tag replaces the page address.
function baseUrlOf($: cheerio.CheerioAPI, pageUrl: string): string {
	const baseHref = $("base[href]").first().attr("href") ?? "";
	return URL.parse(baseHref, pageUrl)?.href ?? pageUrl;
}

/**
 * One URL of the source page as an absolute http(s) URL. `baseUrl` resolves a
 * relative value. Null for no value, a `data:` URI, and a text that is not a URL.
 */
export function httpUrlOf(
	value: string | null | undefined,
	baseUrl: string,
): string | null {
	const url = value == null ? null : URL.parse(value.trim(), baseUrl);
	return url?.protocol === "https:" || url?.protocol === "http:"
		? url.href
		: null;
}

/**
 * The reference HTML for the agent: no script, one tag per line.
 * It keeps `style` and `svg`. It cuts the result at 1,500,000 chars.
 */
export function stripPageHtml(rawHtml: string): string {
	const $ = cheerio.load(rawHtml);
	// The agent must not copy scripts, and an iframe holds another site.
	$("script, noscript, iframe").remove();
	$.root()
		.find("*")
		.addBack()
		.contents()
		.filter((_, node) => node.type === "comment")
		.remove();
	return (
		$.html()
			// An inline image or font can hold megabytes of base64 text.
			.replace(LONG_DATA_URI, "data:removed")
			// The Read tool of the agent cuts a long line, and a minified page is one line.
			.replaceAll("><", ">\n<")
			.slice(0, PAGE_HTML_MAX_CHARS)
	);
}

/** The style sheet URLs of the page, absolute, at most 8. No URL is there two times. */
export function styleSheetUrlsOf(rawHtml: string, pageUrl: string): string[] {
	const $ = cheerio.load(rawHtml);
	const baseUrl = baseUrlOf($, pageUrl);
	const urls = new Set<string>();
	for (const link of $('link[rel~="stylesheet" i][href]')) {
		const url = httpUrlOf($(link).attr("href"), baseUrl);
		if (url !== null) {
			urls.add(url);
		}
	}
	return [...urls].slice(0, MAX_STYLE_SHEETS);
}

/** The text of each inline <style> block that is not empty, in page order. */
export function inlineStylesOf(rawHtml: string): string[] {
	const $ = cheerio.load(rawHtml);
	return $("style")
		.toArray()
		.map((style) => $(style).text())
		.filter((css) => css.trim() !== "");
}

/** The first icon link of the page, absolute, or null. It does not read `/favicon.ico`. */
export function faviconUrlOf(rawHtml: string, pageUrl: string): string | null {
	const $ = cheerio.load(rawHtml);
	// `rel~="icon"` also finds `rel="shortcut icon"`. It does not find `apple-touch-icon`.
	const href = $('link[rel~="icon" i][href]').first().attr("href");
	return httpUrlOf(href, baseUrlOf($, pageUrl));
}

/**
 * The size of a PNG, JPEG, WebP, AVIF, or GIF file, in px. Null when sharp
 * cannot read the file: the bytes are then not an image of these types.
 */
export async function rasterSizeOf(
	bytes: Uint8Array,
): Promise<{ width: number; height: number } | null> {
	try {
		const { height, width } = await sharp(
			bytes,
			SHARP_DECODE_OPTIONS,
		).metadata();
		return { height, width };
	} catch {
		// sharp throws on bytes that are not an image. The caller skips the file.
		return null;
	}
}
