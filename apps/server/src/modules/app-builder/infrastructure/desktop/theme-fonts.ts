/**
 * Puts the theme fonts into the desktop installer (docs/v2/desktop-apps.md section 9).
 * The shell CSP allows only local fonts, so `desktop-build.runtime.ts` calls `bundleThemeFonts`
 * before it writes the build input. It fetches the Google Fonts or Fontshare css of theme.json,
 * downloads the font files, and writes a new css with local urls. A failure only logs.
 */
import { createHash } from "node:crypto";

import type { AppThemeFile } from "@wandit/contracts/v2/app-theme";
import { getErrorMessage } from "@wandit/observability/error";

import type { SandboxLogger } from "../../domain/ports/sandbox-provider";
import type { DesktopBuildInputFile } from "./desktop-build-input";

/** The folder of the bundled fonts in `dist/`. The host owns it; the template loads `theme.css` from it. */
export const THEME_FONTS_DIR = "wandit-fonts";

// Google Fonts answers woff2 only to a browser that it knows. Chrome on Windows matches the WebView2 of the app.
const DESKTOP_BROWSER_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
// One deadline for every fetch of one build, so the fonts never hold the build for long.
const BUNDLE_TIMEOUT_MS = 60_000;
// The css of one family with 4 weights is about 25 KB.
const MAX_CSS_BYTES = 512 * 1024;
// About 7 subsets for each of the 4 or 5 theme faces.
// LIMIT: a cap drops the faces after it in css order, a latin subset too. Upgrade: fetch the subsets of the app languages first.
const MAX_FONT_FILES = 40;
// A Google subset file is under 200 KB, a whole Fontshare woff2 under 1 MB. The total keeps the installer small.
const MAX_FONT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FONT_TOTAL_BYTES = 8 * 1024 * 1024;
// Google Fonts serves its files from fonts.gstatic.com, Fontshare from cdn.fontshare.com.
const FONT_FILE_HOSTS = new Set(["fonts.gstatic.com", "cdn.fontshare.com"]);
// The first 4 bytes of each accepted font format.
const FONT_SIGNATURES = { woff: "wOFF", woff2: "wOF2" } as const;
// The hex digits of the sha256 in a file name: 64 bits, unique enough for 40 files.
const FILE_NAME_HASH_LENGTH = 16;

// Security: only these descriptors pass, and each value must match its pattern.
// So no other css text of the remote host reaches the app.
const DESCRIPTOR_PATTERNS = {
	"font-family": /^(["']?)[A-Za-z0-9 ]{1,40}\1$/,
	"font-style":
		/^(?:normal|italic|oblique(?: -?\d{1,2}(?:\.\d{1,3})?deg){0,2})$/,
	"font-weight": /^(?:normal|bold|[1-9]\d{0,3}(?: [1-9]\d{0,3})?)$/,
	"font-stretch":
		/^(?:normal|(?:ultra-|extra-|semi-)?(?:condensed|expanded)|\d{1,3}(?:\.\d{1,3})?%(?: \d{1,3}(?:\.\d{1,3})?%)?)$/,
	"font-display": /^(?:auto|block|swap|fallback|optional)$/,
	"unicode-range":
		/^U\+[0-9A-F?]{1,6}(?:-[0-9A-F]{1,6})?(?:, ?U\+[0-9A-F?]{1,6}(?:-[0-9A-F]{1,6})?)*$/i,
} as const;

// The body of one @font-face block. A brace inside the body ends the match, so no block nests.
const FONT_FACE_BLOCK = /@font-face\s*\{([^{}]*)\}/g;
// One `url(...)` of a src list, with its optional `format(...)` hint.
const SRC_ITEM =
	/url\(\s*(["']?)([^"'()\s]+)\1\s*\)(?:\s*format\(\s*(["']?)([\w-]+)\3\s*\))?/gi;

/** What `bundleThemeFonts` calls. The runtime passes its own deps. */
export type ThemeFontsDeps = {
	/** `globalThis.fetch` in production; the spec passes a fake. */
	fetch: typeof fetch;
	logger: SandboxLogger;
	/** The ids on each warning line. */
	logFields: { buildId: string; projectId: string };
};

type FontDescriptor = keyof typeof DESCRIPTOR_PATTERNS;
type FontFormat = keyof typeof FONT_SIGNATURES;

/** One @font-face block that passed the checks. */
type FontFace = {
	/** The checked descriptors in source order, without `src`. */
	descriptors: [FontDescriptor, string][];
	/** The https url of the font file, on a host of FONT_FILE_HOSTS. */
	fileUrl: string;
	format: FontFormat;
};

/**
 * Answers the files of `dist/wandit-fonts/`: the font files, named by their sha256, and `theme.css`.
 * `theme.css` is always there, empty without a font, so the template link never fails.
 * A null theme, a fetch error, a cap, or a bad answer drops that font and logs a warning. It never throws.
 */
export async function bundleThemeFonts(
	deps: ThemeFontsDeps,
	theme: AppThemeFile | null,
): Promise<DesktopBuildInputFile[]> {
	const signal = AbortSignal.timeout(BUNDLE_TIMEOUT_MS);
	// Two theme faces with one href load once, as in fontLinksOf of the template.
	const cssUrls =
		theme === null
			? []
			: [
					...new Set(
						Object.values(theme.resolved.fonts).flatMap((font) =>
							font === undefined ? [] : [font.href],
						),
					),
				];
	const faces: FontFace[] = [];
	for (const cssUrl of cssUrls) {
		try {
			const css = new TextDecoder().decode(
				await fetchBytes(deps.fetch, cssUrl, MAX_CSS_BYTES, signal),
			);
			faces.push(...parseFontFaces(css, cssUrl));
		} catch (error) {
			deps.logger.warn("desktop-build.font-css-failed", {
				...deps.logFields,
				error: getErrorMessage(error),
				url: cssUrl,
			});
		}
	}

	// The local name of each remote file, or null after a failed download.
	const localNames = new Map<string, string | null>();
	const files = new Map<string, Uint8Array>();
	let totalBytes = 0;
	let facesOverCountCap = 0;
	const blocks: string[] = [];
	for (const face of faces) {
		let name = localNames.get(face.fileUrl);
		if (name === undefined) {
			if (localNames.size >= MAX_FONT_FILES) {
				facesOverCountCap += 1;
				continue;
			}
			name = null;
			try {
				const content = await fetchBytes(
					deps.fetch,
					face.fileUrl,
					Math.min(MAX_FONT_FILE_BYTES, MAX_FONT_TOTAL_BYTES - totalBytes),
					signal,
				);
				const signature = new TextDecoder().decode(content.subarray(0, 4));
				if (signature !== FONT_SIGNATURES[face.format]) {
					throw new Error(`the file is not ${face.format}`);
				}
				const hash = createHash("sha256").update(content).digest("hex");
				name = `${hash.slice(0, FILE_NAME_HASH_LENGTH)}.${face.format}`;
				if (!files.has(name)) {
					files.set(name, content);
					totalBytes += content.byteLength;
				}
			} catch (error) {
				deps.logger.warn("desktop-build.font-file-failed", {
					...deps.logFields,
					error: getErrorMessage(error),
					url: face.fileUrl,
				});
			}
			localNames.set(face.fileUrl, name);
		}
		if (name !== null) {
			blocks.push(fontFaceCss(face, name));
		}
	}
	if (facesOverCountCap > 0) {
		deps.logger.warn("desktop-build.font-count-cap", {
			...deps.logFields,
			droppedFaces: String(facesOverCountCap),
		});
	}
	return [
		...[...files].map(([name, content]) => ({
			content,
			path: `${THEME_FONTS_DIR}/${name}`,
		})),
		{
			content: new TextEncoder().encode(blocks.join("\n")),
			path: `${THEME_FONTS_DIR}/theme.css`,
		},
	];
}

/**
 * Reads the @font-face blocks of `css`. A block keeps only the descriptors of DESCRIPTOR_PATTERNS
 * whose value matches, and one font file on an allowed https host. A block without a family or
 * without such a file is dropped. Every other rule of the css, `@import` too, is dropped.
 */
function parseFontFaces(css: string, cssUrl: string): FontFace[] {
	const faces: FontFace[] = [];
	for (const [, body = ""] of css.matchAll(FONT_FACE_BLOCK)) {
		const descriptors: [FontDescriptor, string][] = [];
		let file: { url: string; format: FontFormat } | null = null;
		for (const declaration of body.split(";")) {
			const colon = declaration.indexOf(":");
			if (colon === -1) {
				continue;
			}
			const name = declaration.slice(0, colon).trim().toLowerCase();
			const value = declaration.slice(colon + 1).trim();
			if (name === "src") {
				file = pickFontFile(value, cssUrl);
			} else if (
				isFontDescriptor(name) &&
				DESCRIPTOR_PATTERNS[name].test(value)
			) {
				// The family pattern allows one pair of quotes. The output always uses double quotes.
				descriptors.push([
					name,
					name === "font-family" ? `"${value.replace(/["']/g, "")}"` : value,
				]);
			}
		}
		if (
			file !== null &&
			descriptors.some(([descriptor]) => descriptor === "font-family")
		) {
			faces.push({ descriptors, fileUrl: file.url, format: file.format });
		}
	}
	return faces;
}

function isFontDescriptor(name: string): name is FontDescriptor {
	return Object.hasOwn(DESCRIPTOR_PATTERNS, name);
}

/**
 * The best font file of one src list: the first woff2, else the first woff.
 * A url resolves against the css url, as a browser does: Fontshare writes `//cdn.fontshare.com/...`.
 */
function pickFontFile(
	src: string,
	cssUrl: string,
): { url: string; format: FontFormat } | null {
	const candidates = [...src.matchAll(SRC_ITEM)].flatMap(
		([, , rawUrl = "", , hint]) => {
			const url = allowedFontUrl(rawUrl, cssUrl);
			const format = fontFormatOf(rawUrl, hint);
			return url === null || format === null ? [] : [{ format, url }];
		},
	);
	return (
		candidates.find((candidate) => candidate.format === "woff2") ??
		candidates[0] ??
		null
	);
}

// Security: the task fetches only https files of the two font hosts. Any other host,
// an http url, or a port is dropped before a request.
function allowedFontUrl(rawUrl: string, cssUrl: string): string | null {
	let url: URL;
	try {
		url = new URL(rawUrl, cssUrl);
	} catch {
		// A url that does not parse names no file that the task could fetch.
		return null;
	}
	return url.protocol === "https:" && FONT_FILE_HOSTS.has(url.host)
		? url.href
		: null;
}

// The format() hint wins. Without a hint, the extension of the url path decides.
function fontFormatOf(
	rawUrl: string,
	hint: string | undefined,
): FontFormat | null {
	const format =
		hint?.toLowerCase() ?? /\.(woff2?)(?:[?#]|$)/i.exec(rawUrl)?.[1];
	return format === "woff2" || format === "woff" ? format : null;
}

// One @font-face block with the local file. Every value passed its pattern above.
function fontFaceCss(face: FontFace, fileName: string): string {
	const lines = [
		...face.descriptors.map(([name, value]) => `\t${name}: ${value};`),
		`\tsrc: url("/${THEME_FONTS_DIR}/${fileName}") format("${face.format}");`,
	];
	return `@font-face {\n${lines.join("\n")}\n}\n`;
}

/**
 * GETs one url with a byte cap. Throws on a redirect (fetch refuses it), a non-200 answer,
 * a body above `maxBytes`, or the deadline of `signal`.
 */
async function fetchBytes(
	fetchFn: typeof fetch,
	url: string,
	maxBytes: number,
	signal: AbortSignal,
): Promise<Uint8Array> {
	const response = await fetchFn(url, {
		headers: { "user-agent": DESKTOP_BROWSER_USER_AGENT },
		redirect: "error",
		signal,
	});
	if (response.status !== 200 || response.body === null) {
		await response.body?.cancel();
		throw new Error(`the answer is ${response.status}`);
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	// The loop ends at the end of the body, or throws at the cap.
	while (true) {
		const { done, value } = await reader.read();
		if (done) {
			return Buffer.concat(chunks);
		}
		bytes += value.byteLength;
		if (bytes > maxBytes) {
			await reader.cancel();
			throw new Error(`the answer is larger than ${maxBytes} bytes`);
		}
		chunks.push(value);
	}
}
