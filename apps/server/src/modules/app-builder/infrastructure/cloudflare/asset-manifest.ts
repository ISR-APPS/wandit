/**
 * Builds the asset manifest of one publish from the build output files.
 * The publish task (WANDIT-178) passes `manifest` to
 * `createAssetUploadSession` and `byHash` to `uploadAssets` of the
 * Workers for Platforms client. Pure: no network, no file system.
 */
import { createHash } from "node:crypto";

import type { AssetManifest } from "@wandit/contracts";

import { contentTypeFor } from "../../../../infrastructure/storage/r2";

/** One static file of the build output. */
export type AssetFile = {
	/** URL path of the file, for example `/assets/app.js`. A missing leading `/` is added. */
	path: string;
	/** The file bytes. */
	content: Uint8Array;
};

/**
 * Hashes every file and answers the manifest plus a hash-to-file map.
 * Throws for an empty, duplicate, backslash, or `..` path. Two files with
 * the same bytes and the same content type in one project share one hash
 * and one `byHash` entry.
 */
export function assetManifest(
	projectId: string,
	files: AssetFile[],
): { manifest: AssetManifest; byHash: Map<string, AssetFile> } {
	const manifest: AssetManifest = {};
	const byHash = new Map<string, AssetFile>();
	for (const file of files) {
		const path = file.path.startsWith("/") ? file.path : `/${file.path}`;
		// A `..` segment or a backslash could address a file outside the app.
		if (path === "/" || path.includes("\\") || path.split("/").includes("..")) {
			throw new Error(`asset path "${file.path}" is not allowed`);
		}
		if (manifest[path] !== undefined) {
			throw new Error(`asset path "${path}" appears twice`);
		}
		// Cloudflare shares an asset between all scripts of a namespace by
		// hash, so the project id keeps two projects from sharing one (docs:
		// cloudflare-for-platforms/workers-for-platforms/configuration/static-assets).
		// One asset has one content type, so the type is in the hash too:
		// empty app.js and app.css files must not share one asset. The \0
		// bytes keep the three parts apart.
		const hash = createHash("sha256")
			.update(projectId)
			.update("\0")
			.update(contentTypeFor(path))
			.update("\0")
			.update(file.content)
			.digest("hex")
			// Cloudflare requires a hash of 32 hex characters.
			.slice(0, 32);
		manifest[path] = { hash, size: file.content.byteLength };
		byHash.set(hash, { content: file.content, path });
	}
	return { byHash, manifest };
}
