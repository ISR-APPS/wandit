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
import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
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

// Videos the builder animates mid-build, beside the images:
// sites/{project_id}/assets/{attempt_id}/vid-{n}.{ext}
export function siteVideoKey(
	projectId: string,
	attemptId: string,
	index: number,
	extension: string,
): string {
	return `sites/${projectId}/assets/${attemptId}/vid-${index}.${extension}`;
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

// Browser-reachable URL for an object key, through the bucket's public base
// URL (Cloudflare public dev URL or custom domain). Callers MUST check that
// env.R2_PUBLIC_BASE_URL is set first — same contract as isR2Configured().
export function publicAssetUrl(key: string): string {
	const base = (env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

	return `${base}/${key}`;
}

/**
 * Is this URL one of OUR public R2 objects? Every place that accepts an
 * asset URL from outside (file parts, image-src ops, animate_image inputs,
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
export async function putSiteFile(
	key: string,
	body: string | Uint8Array,
	contentType: string,
): Promise<void> {
	await r2Client().send(
		new PutObjectCommand({
			Body: body,
			Bucket: env.R2_BUCKET,
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
