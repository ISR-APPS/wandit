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
	GetObjectCommand,
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

// Browser-reachable URL for an object key, through the bucket's public base
// URL (Cloudflare public dev URL or custom domain). Callers MUST check that
// env.R2_PUBLIC_BASE_URL is set first — same contract as isR2Configured().
export function publicAssetUrl(key: string): string {
	const base = (env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");

	return `${base}/${key}`;
}

const CONTENT_TYPES: Record<string, string> = {
	css: "text/css; charset=utf-8",
	html: "text/html; charset=utf-8",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	js: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	png: "image/png",
	svg: "image/svg+xml",
	txt: "text/plain; charset=utf-8",
	webp: "image/webp",
	woff2: "font/woff2",
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
