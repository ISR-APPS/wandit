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
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	NoSuchKey,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
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

// Dashboard card cover — the final build's hero screenshot. Versioned key
// (immutable, cache-safe: a new build writes a NEW key, so no cache-buster
// is needed). Deliberately NOT under sites/{id}/assets/ (Assets tab) nor
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

const CONTENT_TYPES: Record<string, string> = {
	css: "text/css; charset=utf-8",
	html: "text/html; charset=utf-8",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	js: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	mp4: "video/mp4",
	png: "image/png",
	svg: "image/svg+xml",
	txt: "text/plain; charset=utf-8",
	webm: "video/webm",
	webp: "image/webp",
	woff2: "font/woff2",
	xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
