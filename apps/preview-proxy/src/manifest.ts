/**
 * Rewrites the Expo manifest that Metro sends to Expo Go on a phone host.
 * Called by src/index.ts. It puts the phone host over the fixed Metro host
 * and writes the Expo Go username of the phone link into the manifest.
 */
import { expoGoManifestSchema } from "@wandit/contracts";

/** Paths where Expo CLI answers the manifest (`ManifestMiddleware`, SDK 57). */
const MANIFEST_PATHS = new Set(["/", "/manifest", "/index.exp"]);

/** Values of one manifest rewrite. All come from the phone host and its KV row. */
export type ManifestRewrite = {
	/** `p-<projectId>.<domain>`. `EXPO_PACKAGER_PROXY_URL` puts this host in every manifest URL. */
	packagerHost: string;
	/** `m-<phoneId>--p-<projectId>.<domain>`: the host that Expo Go called. */
	phoneHost: string;
	/** Expo Go account that the user typed in the QR panel. Undefined when the user typed none. */
	expoUsername: string | undefined;
};

/** True for a path where Metro can answer a manifest. */
export function isManifestPath(pathname: string): boolean {
	return MANIFEST_PATHS.has(pathname);
}

/**
 * True for the three manifest formats that Expo Go accepts. `text/plain`
 * is the browser debug view of Expo CLI, so it stays unchanged.
 */
export function isManifestContentType(contentType: string): boolean {
	const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
	return (
		mediaType === "application/json" ||
		mediaType === "application/expo+json" ||
		mediaType === "multipart/mixed"
	);
}

/**
 * Rewrites one manifest body. A `multipart/mixed` body changes in its
 * `manifest` part only; the other bytes stay the same.
 */
export function rewriteManifestBody(
	body: string,
	contentType: string,
	rewrite: ManifestRewrite,
): string {
	const withPhoneHost = body.replaceAll(
		rewrite.packagerHost,
		rewrite.phoneHost,
	);
	const { expoUsername } = rewrite;
	if (expoUsername === undefined) {
		return withPhoneHost;
	}
	if (!contentType.toLowerCase().startsWith("multipart/mixed")) {
		return withUsername(withPhoneHost, expoUsername);
	}
	const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
	if (boundary === undefined) {
		// Without the boundary the part cannot be found. Android still opens
		// the app; the iPhone shows the Expo Go sign-in error.
		console.error("preview-proxy manifest has no multipart boundary");
		return withPhoneHost;
	}
	return rewriteManifestPart(withPhoneHost, boundary, (json) =>
		withUsername(json, expoUsername),
	);
}

/**
 * Applies `rewritePart` to the body of the part named `manifest`. The
 * multitars encoder of Expo CLI writes `--<boundary>`, the headers, an
 * empty line, the body, and a CRLF before the next delimiter.
 */
function rewriteManifestPart(
	body: string,
	boundary: string,
	rewritePart: (json: string) => string,
): string {
	const delimiter = `--${boundary}`;
	return body
		.split(delimiter)
		.map((segment) => {
			const headerEnd = segment.indexOf("\r\n\r\n");
			if (headerEnd === -1) {
				return segment;
			}
			const headers = segment.slice(0, headerEnd);
			if (!/name="manifest"/i.test(headers)) {
				return segment;
			}
			const partBody = segment.slice(headerEnd + "\r\n\r\n".length);
			const trailer = partBody.endsWith("\r\n") ? "\r\n" : "";
			const json = partBody.slice(0, partBody.length - trailer.length);
			return `${headers}\r\n\r\n${rewritePart(json)}${trailer}`;
		})
		.join(delimiter);
}

/**
 * Writes `extra.expoGo.username`. The iPhone Expo Go opens a dev server
 * only when this name equals its signed-in account. A body that is not a
 * manifest returns unchanged, with a log line.
 */
function withUsername(manifestJson: string, expoUsername: string): string {
	let raw: unknown;
	try {
		raw = JSON.parse(manifestJson);
	} catch (error) {
		console.error("preview-proxy manifest is not JSON:", error);
		return manifestJson;
	}
	const manifest = expoGoManifestSchema.safeParse(raw);
	if (!manifest.success) {
		console.error("preview-proxy manifest has no extra.expoGo");
		return manifestJson;
	}
	manifest.data.extra.expoGo.username = expoUsername;
	return JSON.stringify(manifest.data);
}
