/**
 * Cloudflare R2 storage for generated page HTML.
 *
 * Plain functions, NO NestJS on purpose: the Trigger.dev background task
 * (apps/server/src/trigger/) runs outside the Nest app, and both sides must
 * share exactly one storage implementation. R2 speaks the S3 protocol, so
 * the AWS SDK is the client.
 *
 * All R2_* env vars are optional (the server boots before credentials
 * exist), so callers MUST check isR2Configured() before touching storage.
 */
import { randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
	CopyObjectCommand,
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { DesktopPlatform } from "@wandit/contracts";
import { env } from "@wandit/env/server";

// True only when every credential needed to reach the bucket is present.
export function isR2Configured(): boolean {
	return Boolean(
		env.R2_ACCOUNT_ID &&
			env.R2_ACCESS_KEY_ID &&
			env.R2_SECRET_ACCESS_KEY &&
			env.R2_BUCKET,
	);
}

let client: S3Client | null = null;

// Lazy singleton: only constructed when configured AND first used, so an
// unconfigured server never builds a client with empty credentials.
function r2Client(): S3Client {
	if (!client) {
		client = new S3Client({
			credentials: {
				accessKeyId: env.R2_ACCESS_KEY_ID ?? "",
				secretAccessKey: env.R2_SECRET_ACCESS_KEY ?? "",
			},
			endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			// R2 ignores AWS regions; "auto" is what Cloudflare documents.
			region: "auto",
			// The AWS SDK ships checksum defaults ahead of R2 support (the
			// Jan 2025 CRC32 incident broke uploads) — only checksum when the
			// specific operation requires it.
			requestChecksumCalculation: "WHEN_REQUIRED",
			responseChecksumValidation: "WHEN_REQUIRED",
		});
	}

	return client;
}

// One canonical key layout, documented in the versions schema:
// sites/{project_id}/{version_id}/index.html
export function pageHtmlKey(projectId: string, versionId: string): string {
	return `sites/${projectId}/${versionId}/index.html`;
}

// Non-entry files of a generated site live beside its index.html:
// sites/{project_id}/{version_id}/{relative_path}
export function siteFileKey(
	projectId: string,
	versionId: string,
	path: string,
): string {
	return `sites/${projectId}/${versionId}/${path}`;
}

// The live published bytes for a project. One stable, mutable key per
// project — overwritten on every publish, deleted on unpublish — so the
// edge worker and the KV pointer never need to know a version id.
// published/{project_id}/current.html
export function publishedCurrentKey(projectId: string): string {
	return `published/${projectId}/current.html`;
}

// Immutable archive of each publish attempt, for rollback and audit:
// published/{project_id}/v/{deployment_id}.html
export function publishedArchiveKey(
	projectId: string,
	deploymentId: string,
): string {
	return `published/${projectId}/v/${deploymentId}.html`;
}

/**
 * Stored output of one V2 app build (WANDIT-178): gzip JSON of the Worker
 * modules and the static assets. A rollback uploads it again.
 * published/{project_id}/builds/{build_id}.json.gz
 */
export function publishedAppBuildKey(
	projectId: string,
	buildId: string,
): string {
	return `published/${projectId}/builds/${buildId}.json.gz`;
}

// Images the builder generates mid-build live under the attempt, not a
// version (they exist before any version does):
// sites/{project_id}/assets/{attempt_id}/img-{n}.{ext}
export function siteAssetKey(
	projectId: string,
	attemptId: string,
	index: number,
	extension: string,
): string {
	return `sites/${projectId}/assets/${attemptId}/img-${index}.${extension}`;
}

// Review screenshots the build publishes for the chat progress card. Under
// sites/{id}/shots/ — NOT sites/{id}/assets/ — so the Assets tab's
// build-asset prefix listing never picks them up as user assets:
// sites/{project_id}/shots/{attempt_id}/p{pass}-{n}.jpg
export function siteShotKey(
	projectId: string,
	attemptId: string,
	pass: number,
	index: number,
): string {
	return `sites/${projectId}/shots/${attemptId}/p${pass}-${index}.jpg`;
}

// Dashboard card cover. V1: the final build's hero screenshot, keyed by the
// page version. V2: the `capture-project-thumbnail` screenshot after a
// committed turn, keyed by the commit sha. Versioned key (immutable,
// cache-safe: a new capture writes a NEW key, so no cache-buster is needed).
// Deliberately NOT under sites/{id}/assets/ (Assets tab) nor
// sites/{id}/shots/ (chat-card strips).
export function projectThumbnailKey(
	projectId: string,
	versionId: string,
): string {
	return `sites/${projectId}/thumbnails/${versionId}.jpg`;
}

// Standalone images from the chat's generate_image tool live under their own
// root — NOT under sites/{id}/assets/, so the Assets tab's build-asset prefix
// listing never double-counts them:
// images/{project_id}/{attempt_id}/img-{n}.{ext}
export function imageGenerationKey(
	projectId: string,
	attemptId: string,
	index: number,
	extension: string,
): string {
	return `images/${projectId}/${attemptId}/img-${index}.${extension}`;
}

// Finished marketing HTML documents (Marketing tab cards):
// marketing/{project_id}/{asset_id}/index.html
export function marketingAssetKey(projectId: string, assetId: string): string {
	return `marketing/${projectId}/${assetId}/index.html`;
}

// Exported lead-scrape workbooks live under their attempt. The object is
// served through an ownership-checked download endpoint (contact exports are
// personal data), so the key is persisted instead of a public URL:
// lead-scrapes/{project_id}/{attempt_id}/{filename}
export function leadScrapeFileKey(
	projectId: string,
	attemptId: string,
	filename: string,
): string {
	return `lead-scrapes/${projectId}/${attemptId}/${filename}`;
}

// User-uploaded attachments (product photos, logos, docs) are user-scoped —
// they exist before any project does (dashboard composer uploads):
// uploads/{user_id}/{uuid}/{sanitized-filename}
export function userUploadKey(
	userId: string,
	uuid: string,
	filename: string,
): string {
	return `uploads/${userId}/${uuid}/${filename}`;
}

// Admin-panel copy of the in-app feedback screenshot. Each feedback row owns
// one object, so a retry safely replaces the same key.
export function feedbackScreenshotKey(
	feedbackId: string,
	extension: "png" | "jpg",
): string {
	return `feedback/${feedbackId}/screenshot.${extension}`;
}

/**
 * Updater manifest that installed desktop apps of one platform read
 * (docs/v2/desktop-apps.md section 10). One manifest per platform, because
 * the updater signs one version per file. A release rewrites it; a staff
 * suspension deletes it.
 * desktop/{project_id}/latest.json (Windows) or latest-macos.json (macOS)
 */
export function desktopManifestKey(
	projectId: string,
	platform: DesktopPlatform,
): string {
	return platform === "windows"
		? `desktop/${projectId}/latest.json`
		: `desktop/${projectId}/latest-macos.json`;
}

/**
 * File name of the stable download of one platform: `<binary>-setup.exe` on
 * Windows, `<binary>.dmg` on macOS. The release also puts it in the download header.
 */
export function desktopStableFileName(
	binaryName: string,
	platform: DesktopPlatform,
): string {
	return platform === "windows"
		? `${binaryName}-setup.exe`
		: `${binaryName}.dmg`;
}

/**
 * Stable download link of one platform: a copy of its current download file,
 * rewritten on each release of that platform.
 * desktop/{project_id}/{desktopStableFileName}
 */
export function desktopStableInstallerKey(
	projectId: string,
	binaryName: string,
	platform: DesktopPlatform,
): string {
	return `desktop/${projectId}/${desktopStableFileName(binaryName, platform)}`;
}

/**
 * Folder of the signed files of one build. The runtime appends the file
 * names. Each call answers a new folder. The random part keeps the public
 * objects unknown until the `ready` row stores their keys, so a build that
 * stops before `ready` leaks no file (audit A1). It stays under
 * `desktop/{project_id}/`, which a suspend and a delete remove.
 * desktop/{project_id}/builds/{build_id}-{random}
 */
export function desktopBuildFolderKey(
	projectId: string,
	buildId: string,
): string {
	return `desktop/${projectId}/builds/${buildId}-${unguessableSuffix()}`;
}

// 128 random bits. The bucket is public, so only an unguessable key keeps
// the build input, the staged files, and an unreleased build private.
function unguessableSuffix(): string {
	return randomBytes(16).toString("hex");
}

// The prefix of the temporary build objects. An R2 lifecycle rule on it
// deletes each object 1 day after its upload (runbook, desktop "Setup"). So
// a late CI upload or a crashed task leaves no object for good.
const DESKTOP_TEMP_PREFIX = "desktop-temp";

/**
 * Build input archive that the CI downloads with a presigned GET.
 * Each call answers a new key.
 * desktop-temp/{project_id}/inputs/{build_id}-{random}.tar.gz
 */
export function desktopInputKey(projectId: string, buildId: string): string {
	return `${DESKTOP_TEMP_PREFIX}/${projectId}/inputs/${buildId}-${unguessableSuffix()}.tar.gz`;
}

/**
 * Unsigned file that the CI uploads with a presigned PUT. The task checks
 * and signs it, then deletes it. Each call answers a new key. The URL check
 * of build.yml and build-macos.yml matches these names.
 * desktop-temp/{project_id}/staging/{build_id}-{random}.{extension}
 */
export function desktopStagingKey(
	projectId: string,
	buildId: string,
	/** `exe`: the Windows setup. `dmg`: the macOS disk image. `app.tar.gz`: the macOS update archive. */
	extension: "exe" | "dmg" | "app.tar.gz",
): string {
	return `${DESKTOP_TEMP_PREFIX}/${projectId}/staging/${buildId}-${unguessableSuffix()}.${extension}`;
}

/**
 * Public URL of a `desktop/` key on the updates host:
 * DESKTOP_UPDATES_BASE_URL, else R2_PUBLIC_BASE_URL. Null when both are
 * unset. Every installed app holds the manifest URL, so the base never changes.
 */
export function desktopUpdatesUrl(key: string): string | null {
	const base = env.DESKTOP_UPDATES_BASE_URL ?? env.R2_PUBLIC_BASE_URL;
	return base === undefined ? null : `${base.replace(/\/+$/, "")}/${key}`;
}

// Narrower renditions of an image object live BESIDE it, in the same
// directory, so every key keeps its segment count:
// {directory}/{stem}.w{width}.webp
// Same-directory matters: isUserUploadUrl / isWanditUploadUrl and
// brief-user-photos both require uploads/ keys to be exactly 4 segments, and
// an extra segment would silently drop a user photo from the builder's view.
export function variantKey(baseKey: string, width: number): string {
	const slash = baseKey.lastIndexOf("/");
	const directory = slash >= 0 ? baseKey.slice(0, slash + 1) : "";
	const filename = baseKey.slice(slash + 1);
	const dot = filename.lastIndexOf(".");
	const stem = dot > 0 ? filename.slice(0, dot) : filename;

	return `${directory}${stem}.w${width}.webp`;
}

// The shape variantKey writes. Prefix listings (the Assets tab) use it to
// keep renditions out of the user-facing file list.
export const VARIANT_FILENAME_PATTERN = /\.w\d+\.webp$/;

// Cache header for uuid-addressed media objects (uploads, build assets,
// generated media). A given key is written ONCE and never rewritten,
// which is what makes "immutable" honest.
//
// CONSEQUENCE for any future backfill: re-optimizing an existing object must
// write a NEW key and repoint the HTML at it. Rewriting bytes in place would
// leave every edge and browser serving the old copy for a year.
export const IMMUTABLE_ASSET_CACHE_CONTROL =
	"public, max-age=31536000, immutable";

// Browser-reachable URL for an object key, through the bucket's public base
// URL (Cloudflare public dev URL or custom domain). Callers MUST check that
// env.R2_PUBLIC_BASE_URL is set first — same contract as isR2Configured().
export function publicAssetUrl(key: string): string {
	const base = (env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

	return `${base}/${key}`;
}

/**
 * Is this URL one of OUR public R2 objects? Every place that accepts an
 * asset URL from outside (file parts, image-src ops,
 * project attachments) must use this — a raw startsWith(base) check is
 * prefix-confusable: with base https://assets.example.com,
 * https://assets.example.com.attacker.test/x.png would pass. This parses
 * both sides and compares the ORIGIN exactly plus the path boundary.
 */
export function isWanditHostedUrl(url: string): boolean {
	return publicAssetKeyFromUrl(url) !== null;
}

/**
 * Resolve one public R2 URL back to its object key. Returns null for another
 * origin, credentials in the URL, a path outside the configured public-base
 * boundary, or malformed percent encoding.
 */
export function publicAssetKeyFromUrl(url: string): string | null {
	const base = env.R2_PUBLIC_BASE_URL;

	if (!base) {
		return null;
	}

	let parsedBase: URL;
	let parsed: URL;

	try {
		parsedBase = new URL(base);
		parsed = new URL(url);
	} catch {
		return null;
	}

	// Credentials in an asset URL are never legitimate.
	if (parsed.username !== "" || parsed.password !== "") {
		return null;
	}

	if (parsed.origin !== parsedBase.origin) {
		return null;
	}

	// Path boundary: base path must be a whole-segment prefix — a base of
	// /bucket must not accept /bucket-evil/x.
	const basePath = parsedBase.pathname.replace(/\/+$/, "");

	if (
		basePath !== "" &&
		parsed.pathname !== basePath &&
		!parsed.pathname.startsWith(`${basePath}/`)
	) {
		return null;
	}

	const encodedKey = parsed.pathname.slice(basePath.length).replace(/^\/+/, "");

	try {
		return decodeURIComponent(encodedKey);
	} catch {
		return null;
	}
}

/**
 * Stronger guard for standalone media generation: the source must be an
 * attachment uploaded under the authenticated user's own R2 prefix, not just
 * any publicly reachable Wandit object.
 */
export function isUserUploadUrl(url: string, userId: string): boolean {
	const key = publicAssetKeyFromUrl(url);
	if (!key) return false;

	const [root, owner, uploadId, filename] = key.split("/");
	return (
		root === "uploads" &&
		owner === userId &&
		Boolean(uploadId) &&
		Boolean(filename)
	);
}

/**
 * Any authenticated user's R2 upload, owner unchecked. Only for re-validating
 * PERSISTED chat history, where a shared org chat legitimately carries other
 * members' attachments that passed the strict per-user check when their
 * author submitted them. New content must always use isUserUploadUrl.
 */
export function isWanditUploadUrl(url: string): boolean {
	const key = publicAssetKeyFromUrl(url);
	if (!key) return false;

	const [root, owner, uploadId, filename] = key.split("/");
	return (
		root === "uploads" &&
		Boolean(owner) &&
		Boolean(uploadId) &&
		Boolean(filename)
	);
}

// The V2 asset upload (WANDIT-200) also reads this map: a Vite build emits
// avif, gif, mjs, wasm, webmanifest, woff, and xml files. The edge sends
// nosniff, so a module script needs a JavaScript type.
const CONTENT_TYPES: Record<string, string> = {
	avif: "image/avif",
	css: "text/css; charset=utf-8",
	gif: "image/gif",
	html: "text/html; charset=utf-8",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	js: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	mp4: "video/mp4",
	png: "image/png",
	svg: "image/svg+xml",
	txt: "text/plain; charset=utf-8",
	wasm: "application/wasm",
	webm: "video/webm",
	webmanifest: "application/manifest+json",
	webp: "image/webp",
	woff: "font/woff",
	woff2: "font/woff2",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	xml: "application/xml; charset=utf-8",
};

// Best-effort by extension; octet-stream keeps unknown files downloadable
// instead of failing the upload.
export function contentTypeFor(path: string): string {
	const extension = path.split(".").pop()?.toLowerCase() ?? "";

	return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

// Upload one file of a generated site (the builder may emit more than just
// index.html). Same overwrite semantics as putPageHtml.
//
// cacheControl is opt-in per call, NOT derived from the content type: page
// screenshots and dashboard thumbnails are images too, and they are not the
// long-lived page assets that earn IMMUTABLE_ASSET_CACHE_CONTROL.
export async function putSiteFile(
	key: string,
	body: string | Uint8Array,
	contentType: string,
	cacheControl?: string,
): Promise<void> {
	await r2Client().send(
		new PutObjectCommand({
			Body: body,
			Bucket: env.R2_BUCKET,
			...(cacheControl ? { CacheControl: cacheControl } : {}),
			ContentType: contentType,
			Key: key,
		}),
	);
}

/** HTTP headers that R2 stores with an object and sends on every GET. */
export type ObjectHeaders = {
	cacheControl: string;
	contentType: string;
	/** `attachment; filename="..."` makes the browser save the file. Unset: the browser decides. */
	contentDisposition?: string;
};

/** What `putObject` uploads: a text in memory, or a local file streamed from disk. */
export type ObjectBody =
	| { kind: "text"; text: string }
	| { kind: "file"; filePath: string };

// Header injection guard: the file name goes inside a quoted header value.
const DOWNLOAD_FILE_NAME_PATTERN = /^[A-Za-z0-9._-]{1,120}$/;

// The content type of each desktop build file, by the end of its name.
const DESKTOP_DOWNLOAD_CONTENT_TYPES = [
	{
		contentType: "application/vnd.microsoft.portable-executable",
		suffix: ".exe",
	},
	{ contentType: "application/x-apple-diskimage", suffix: ".dmg" },
	{ contentType: "application/gzip", suffix: ".app.tar.gz" },
] as const;

/**
 * Headers of a desktop build file (setup exe, disk image, or update
 * archive): always a download, never a page, and never cached. Throws for a
 * file name with a quote, a space, or a control character, and for any
 * other file type.
 */
export function desktopDownloadHeaders(fileName: string): ObjectHeaders {
	const known = DESKTOP_DOWNLOAD_CONTENT_TYPES.find(({ suffix }) =>
		fileName.endsWith(suffix),
	);
	if (!DOWNLOAD_FILE_NAME_PATTERN.test(fileName) || known === undefined) {
		throw new Error(`Unsafe download file name: ${fileName.slice(0, 120)}`);
	}
	return {
		// A staff takedown deletes the object. An edge copy would keep the
		// file downloadable after it (security audit A7).
		cacheControl: "no-cache",
		contentDisposition: `attachment; filename="${fileName}"`,
		contentType: known.contentType,
	};
}

/**
 * Uploads one object with explicit headers. A file body streams from disk
 * with its size, so a 300 MB installer never sits in memory.
 */
export async function putObject(
	key: string,
	body: ObjectBody,
	headers: ObjectHeaders,
): Promise<void> {
	const payload =
		body.kind === "text"
			? { Body: body.text }
			: {
					Body: createReadStream(body.filePath),
					// The SDK needs the length of a stream body before it sends it.
					ContentLength: (await stat(body.filePath)).size,
				};
	await r2Client().send(
		new PutObjectCommand({
			...payload,
			Bucket: env.R2_BUCKET,
			CacheControl: headers.cacheControl,
			ContentDisposition: headers.contentDisposition,
			ContentType: headers.contentType,
			Key: key,
		}),
	);
}

/**
 * Copies one object inside the bucket with new headers. R2 copies the
 * bytes on its side; nothing passes through this process.
 */
export async function copyObject(
	sourceKey: string,
	destinationKey: string,
	headers: ObjectHeaders,
): Promise<void> {
	await r2Client().send(
		new CopyObjectCommand({
			Bucket: env.R2_BUCKET,
			CacheControl: headers.cacheControl,
			ContentDisposition: headers.contentDisposition,
			ContentType: headers.contentType,
			// S3 reads the source as `<bucket>/<key>`, URL-encoded per segment.
			CopySource: `${env.R2_BUCKET}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
			Key: destinationKey,
			// REPLACE: the copy takes the headers above, not those of the source.
			MetadataDirective: "REPLACE",
		}),
	);
}

/**
 * Presigned GET URL of one object, valid for `expiresInSeconds` (SigV4
 * allows at most 7 days). The URL is a credential: never log it.
 */
export function presignedGetUrl(
	key: string,
	expiresInSeconds: number,
): Promise<string> {
	return getSignedUrl(
		r2Client(),
		new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		{ expiresIn: expiresInSeconds },
	);
}

/**
 * Presigned PUT URL of one object, valid for `expiresInSeconds`. The URL
 * signs no content type. The CI upload steps in
 * tooling/desktop-builder/.github/workflows/build.yml and build-macos.yml send
 * `application/octet-stream`. If you sign a content type, use that value.
 * Never log the URL.
 */
export function presignedPutUrl(
	key: string,
	expiresInSeconds: number,
): Promise<string> {
	return getSignedUrl(
		r2Client(),
		new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		{ expiresIn: expiresInSeconds },
	);
}

// Upload one finished page. Overwrites are harmless: version ids are unique,
// so a retry writes the same content to the same key.
export async function putPageHtml(key: string, html: string): Promise<void> {
	await r2Client().send(
		new PutObjectCommand({
			Body: html,
			Bucket: env.R2_BUCKET,
			ContentType: "text/html; charset=utf-8",
			Key: key,
		}),
	);
}

// Delete one object. Missing keys are fine: unpublish retries and races
// must be idempotent, so NoSuchKey is swallowed on purpose.
export async function deleteObject(key: string): Promise<void> {
	try {
		await r2Client().send(
			new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);
	} catch (error) {
		if (error instanceof NoSuchKey) {
			return;
		}

		throw error;
	}
}

// Fetch one object's raw bytes (lead-scrape workbook downloads). Returns
// null when the object does not exist so the caller can answer 404.
export async function getObjectBytes(key: string): Promise<Uint8Array | null> {
	try {
		const result = await r2Client().send(
			new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);
		const bytes = await result.Body?.transformToByteArray();

		return bytes ?? null;
	} catch (error) {
		if (error instanceof NoSuchKey) {
			return null;
		}

		throw error;
	}
}

/**
 * Stream one object directly to a local file. Video-processing workers use
 * this instead of getObjectBytes so source clips and segments never coexist
 * as full in-memory buffers. A partial destination is removed on any failure.
 */
export async function downloadObjectToFile(
	key: string,
	destinationPath: string,
): Promise<boolean> {
	try {
		const result = await r2Client().send(
			new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);

		if (!(result.Body instanceof Readable)) {
			throw new Error(`R2 object ${key} did not provide a readable body.`);
		}

		try {
			await pipeline(
				result.Body,
				createWriteStream(destinationPath, { flags: "wx" }),
			);
		} catch (error) {
			await rm(destinationPath, { force: true }).catch(() => undefined);
			throw error;
		}

		return true;
	} catch (error) {
		if (
			error instanceof NoSuchKey ||
			(isAwsNotFoundError(error) && error.$metadata.httpStatusCode === 404)
		) {
			return false;
		}

		throw error;
	}
}

/**
 * Read one object's content type without downloading its body. A media worker
 * uses this to recover after a crash between the deterministic R2 upload and
 * the database's succeeded transition.
 */
export async function getObjectContentType(
	key: string,
): Promise<string | null> {
	try {
		const result = await r2Client().send(
			new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);

		return result.ContentType ?? contentTypeFor(key);
	} catch (error) {
		if (
			error instanceof NoSuchKey ||
			(isAwsNotFoundError(error) && error.$metadata.httpStatusCode === 404)
		) {
			return null;
		}

		throw error;
	}
}

/**
 * Does this object exist? A HEAD, so no body is transferred. Answers false on
 * ANY error (missing key, credentials, network): callers use it to decide
 * whether to reference an optional object such as an image rendition, and a
 * storage hiccup must degrade to "do not reference it", never to a throw.
 */
export async function r2ObjectExists(key: string): Promise<boolean> {
	try {
		await r2Client().send(
			new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);

		return true;
	} catch {
		return false;
	}
}

// Fetch one page's HTML. Returns null when the object does not exist so the
// caller can turn it into a 404 instead of a 500.
export async function getPageHtml(key: string): Promise<string | null> {
	try {
		const result = await r2Client().send(
			new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }),
		);

		return (await result.Body?.transformToString("utf-8")) ?? null;
	} catch (error) {
		if (error instanceof NoSuchKey) {
			return null;
		}

		throw error;
	}
}

export type StoredObject = {
	key: string;
	lastModified: Date | null;
	sizeBytes: number | null;
};

// Paginated prefix listing (Assets tab: build images/videos have no DB rows,
// the bucket itself is their source of truth). Capped so one project can
// never turn a tab load into an unbounded scan.
export async function listObjectsByPrefix(
	prefix: string,
	maxObjects = 500,
): Promise<StoredObject[]> {
	const objects: StoredObject[] = [];
	let continuationToken: string | undefined;

	while (objects.length < maxObjects) {
		const result = await r2Client().send(
			new ListObjectsV2Command({
				Bucket: env.R2_BUCKET,
				ContinuationToken: continuationToken,
				MaxKeys: Math.min(1_000, maxObjects - objects.length),
				Prefix: prefix,
			}),
		);

		for (const item of result.Contents ?? []) {
			if (!item.Key) {
				continue;
			}

			objects.push({
				key: item.Key,
				lastModified: item.LastModified ?? null,
				sizeBytes: typeof item.Size === "number" ? item.Size : null,
			});
		}

		if (!result.IsTruncated || !result.NextContinuationToken) {
			break;
		}

		continuationToken = result.NextContinuationToken;
	}

	return objects;
}

function isAwsNotFoundError(
	error: unknown,
): error is { $metadata: { httpStatusCode?: number } } {
	return (
		typeof error === "object" &&
		error !== null &&
		"$metadata" in error &&
		typeof error.$metadata === "object" &&
		error.$metadata !== null
	);
}

/**
 * R2 prefixes one `v2_app` project owns. Writers: the `commit-turn.ts`
 * patches under `git/`, the generate_image host tool of WANDIT-169 under
 * `sites/<id>/assets/`, the `capture-project-thumbnail` task under
 * `sites/<id>/thumbnails/`, the `publish-app` task (WANDIT-178) under
 * `published/<id>/builds/`, the desktop release under `desktop/<id>/`, and
 * the desktop build under `desktop-temp/<id>/`. Never the whole
 * `published/<id>/` prefix: the V1 page files of a migrated project live
 * there too.
 */
export function v2ProjectPrefixes(projectId: string): string[] {
	return [
		`git/${projectId}/`,
		`sites/${projectId}/assets/`,
		`sites/${projectId}/thumbnails/`,
		`published/${projectId}/builds/`,
		`desktop/${projectId}/`,
		`${DESKTOP_TEMP_PREFIX}/${projectId}/`,
	];
}

/**
 * Deletes the objects directly under `desktop/<projectId>/`: `latest.json`,
 * `latest-macos.json`, and the stable files of both platforms. Installed
 * apps then find no update. The build files under `builds/` stay.
 * `DesktopBuildsService.release` calls it when a suspension lands during its
 * writes; the suspension deletes the rest.
 */
export async function deleteDesktopReleaseObjects(
	projectId: string,
): Promise<number> {
	let deleted = 0;
	let continuationToken: string | undefined;
	do {
		// The "/" delimiter lists only the top-level objects. The `builds/`
		// folder comes back as a common prefix.
		const page = await r2Client().send(
			new ListObjectsV2Command({
				Bucket: env.R2_BUCKET,
				ContinuationToken: continuationToken,
				Delimiter: "/",
				Prefix: `desktop/${projectId}/`,
			}),
		);
		for (const item of page.Contents ?? []) {
			if (item.Key) {
				await deleteObject(item.Key);
				deleted += 1;
			}
		}
		continuationToken = page.IsTruncated
			? page.NextContinuationToken
			: undefined;
	} while (continuationToken !== undefined);
	return deleted;
}

/**
 * Deletes every object under `prefix` and answers the count.
 * The `delete-app-project` runtime and the staff suspend of a desktop app
 * call it; a spec passes a fake `io`.
 */
export async function deleteObjectsByPrefix(
	prefix: string,
	io: { list: typeof listObjectsByPrefix; remove: typeof deleteObject } = {
		list: listObjectsByPrefix,
		remove: deleteObject,
	},
): Promise<number> {
	let deleted = 0;
	// R2 lists at most 1,000 keys per call; the loop drains the prefix page
	// by page. A short page is the last one.
	for (;;) {
		const page = await io.list(prefix, 1_000);
		for (const object of page) {
			await io.remove(object.key);
		}
		deleted += page.length;
		if (page.length < 1_000) {
			return deleted;
		}
	}
}
