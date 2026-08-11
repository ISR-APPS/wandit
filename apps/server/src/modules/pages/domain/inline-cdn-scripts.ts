/**
 * Publish-time self-containment pass: replaces known GSAP CDN <script src>
 * tags with the vendored inline sources, so a published page never blanks its
 * reveal-hidden content because one of two CDN requests stalled or failed.
 *
 * Idempotent — already-inlined pages contain no matching src tags and pass
 * through unchanged. Unknown scripts stay untouched (the site validators
 * decide their fate). Plain module, NO NestJS imports: the Trigger.dev build
 * task and the sites publish pipeline both share it.
 */

import { GSAP_MIN_JS } from "./vendor/gsap-min-js";
import { SCROLLTRIGGER_MIN_JS } from "./vendor/scrolltrigger-min-js";

const VENDORED_GSAP_VERSION = "3.12.5";

// GSAP 3.x only — a hypothetical @2 or @4 URL must never silently become 3.12.5.
const GSAP_3_VERSION_SOURCE = String.raw`3(?:\.\d+){0,2}`;

// jsdelivr/unpkg serve /gsap@<v>/dist/<file>; cdnjs serves /ajax/libs/gsap/<v>/<file>.
function knownCdnUrlPattern(fileSource: string): RegExp {
	return new RegExp(
		"^(?:https?:)?//(?:" +
			String.raw`(?:cdn\.jsdelivr\.net/npm|unpkg\.com)/gsap@${GSAP_3_VERSION_SOURCE}/dist` +
			String.raw`|cdnjs\.cloudflare\.com/ajax/libs/gsap/${GSAP_3_VERSION_SOURCE}` +
			String.raw`)/${fileSource}(?:[?#][^\s]*)?$`,
		"i",
	);
}

const GSAP_CORE_URL_PATTERN =
	knownCdnUrlPattern(String.raw`gsap(?:\.min)?\.js`);
const SCROLLTRIGGER_URL_PATTERN = knownCdnUrlPattern(
	String.raw`ScrollTrigger(?:\.min)?\.js`,
);

const SCRIPT_OPEN_TAG_PATTERN = /<script\b[^>]*>/gi;
const SCRIPT_CLOSE_TAG_PATTERN = /<\/script\s*>/gi;
// src preceded by whitespace, so data-src and friends never match.
const SRC_ATTRIBUTE_PATTERN =
	/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

function inlineReplacementFor(src: string): string | undefined {
	if (GSAP_CORE_URL_PATTERN.test(src)) {
		return `<script>/*gsap core ${VENDORED_GSAP_VERSION} inlined*/${GSAP_MIN_JS}</script>`;
	}

	if (SCROLLTRIGGER_URL_PATTERN.test(src)) {
		return `<script>/*gsap ScrollTrigger ${VENDORED_GSAP_VERSION} inlined*/${SCROLLTRIGGER_MIN_JS}</script>`;
	}

	return undefined;
}

/**
 * Replace every known GSAP 3.x core/ScrollTrigger CDN script tag with an
 * inline <script> carrying the vendored 3.12.5 source — whatever the tag
 * shape: a real closing tag, a self-closing tag, even inline fallback body
 * content (which is dropped: the vendored source IS the fallback). Other
 * HTML — inline scripts, unknown CDNs, other libraries, other GSAP majors —
 * is byte-untouched, and a page with no sanctioned CDN tag is returned as
 * the identical string.
 *
 * Attribute-driven but textual on purpose: only the matched script elements
 * are rewritten, never the whole document reserialized, so publish output
 * stays byte-stable for pages that need no inlining.
 */
export function inlineKnownCdnScripts(html: string): string {
	const pieces: string[] = [];
	let consumed = 0;

	SCRIPT_OPEN_TAG_PATTERN.lastIndex = 0;

	let openMatch = SCRIPT_OPEN_TAG_PATTERN.exec(html);

	while (openMatch !== null) {
		const openTag = openMatch[0];
		const start = openMatch.index;
		let end = start + openTag.length;

		// Per HTML tokenization, everything up to the first </script> is script
		// text — skip it so body content (or an inlined vendored source) is
		// never mistaken for markup. A self-closing tag has no body to skip.
		if (!/\/\s*>$/.test(openTag)) {
			SCRIPT_CLOSE_TAG_PATTERN.lastIndex = end;

			const closeMatch = SCRIPT_CLOSE_TAG_PATTERN.exec(html);

			if (!closeMatch) {
				// Unterminated script: the rest of the document is script text.
				break;
			}

			end = closeMatch.index + closeMatch[0].length;
			SCRIPT_OPEN_TAG_PATTERN.lastIndex = end;
		}

		const src = SRC_ATTRIBUTE_PATTERN.exec(openTag);
		const url = src ? ((src[1] ?? src[2] ?? src[3]) as string).trim() : "";
		const replacement = url ? inlineReplacementFor(url) : undefined;

		if (replacement !== undefined) {
			pieces.push(html.slice(consumed, start), replacement);
			consumed = end;
		}

		openMatch = SCRIPT_OPEN_TAG_PATTERN.exec(html);
	}

	if (pieces.length === 0) {
		return html;
	}

	pieces.push(html.slice(consumed));

	return pieces.join("");
}
