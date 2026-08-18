import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	R2_ACCESS_KEY_ID: "key",
	R2_ACCOUNT_ID: "account",
	R2_BUCKET: "bucket",
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
	R2_SECRET_ACCESS_KEY: "secret",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

// The S3 client is stubbed at the module boundary: these tests are about the
// commands r2.ts builds, never about the network.
const s3 = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("@aws-sdk/client-s3", () => ({
	DeleteObjectCommand: class {
		constructor(readonly input: unknown) {}
	},
	GetObjectCommand: class {
		constructor(readonly input: unknown) {}
	},
	HeadObjectCommand: class {
		constructor(readonly input: unknown) {}
	},
	ListObjectsV2Command: class {
		constructor(readonly input: unknown) {}
	},
	NoSuchKey: class extends Error {},
	PutObjectCommand: class {
		constructor(readonly input: unknown) {}
	},
	S3Client: class {
		send = s3.send;
	},
}));

import {
	IMMUTABLE_ASSET_CACHE_CONTROL,
	isUserUploadUrl,
	isWanditHostedUrl,
	isWanditUploadUrl,
	publicAssetKeyFromUrl,
	putPageHtml,
	putSiteFile,
	r2ObjectExists,
	VARIANT_FILENAME_PATTERN,
	variantKey,
} from "./r2";

beforeEach(() => {
	s3.send.mockReset().mockResolvedValue({});
});

describe("variantKey", () => {
	it("writes the rendition beside its primary, keeping the segment count", () => {
		expect(variantKey("uploads/user_1/upload_1/hero-photo.webp", 960)).toBe(
			"uploads/user_1/upload_1/hero-photo.w960.webp",
		);
		expect(
			variantKey("uploads/user_1/upload_1/hero-photo.webp", 960).split("/"),
		).toHaveLength(4);
	});

	it("replaces whatever extension the primary had", () => {
		expect(variantKey("sites/p/assets/a/img-1.png", 480)).toBe(
			"sites/p/assets/a/img-1.w480.webp",
		);
		expect(variantKey("images/p/a/img-1", 480)).toBe(
			"images/p/a/img-1.w480.webp",
		);
	});

	it("is recognized by the pattern the Assets tab filters with", () => {
		expect(
			VARIANT_FILENAME_PATTERN.test(
				variantKey("sites/p/assets/a/img-1.webp", 1600),
			),
		).toBe(true);
		expect(VARIANT_FILENAME_PATTERN.test("sites/p/assets/a/img-1.webp")).toBe(
			false,
		);
		// A user file that merely looks numeric must survive the filter.
		expect(VARIANT_FILENAME_PATTERN.test("uploads/u/i/photo-w960.webp")).toBe(
			false,
		);
	});
});

describe("putSiteFile cache headers", () => {
	it("sets the immutable header only when the caller asks for it", async () => {
		await putSiteFile(
			"uploads/u/i/photo.webp",
			new Uint8Array([1]),
			"image/webp",
		);
		expect(s3.send.mock.calls[0]?.[0].input).not.toHaveProperty("CacheControl");

		await putSiteFile(
			"uploads/u/i/photo.webp",
			new Uint8Array([1]),
			"image/webp",
			IMMUTABLE_ASSET_CACHE_CONTROL,
		);
		expect(s3.send.mock.calls[1]?.[0].input).toMatchObject({
			CacheControl: "public, max-age=31536000, immutable",
		});
	});

	it("never caches published HTML", async () => {
		await putPageHtml("published/p/current.html", "<!doctype html>");

		expect(s3.send.mock.calls[0]?.[0].input).not.toHaveProperty("CacheControl");
	});
});

describe("r2ObjectExists", () => {
	it("answers true when the HEAD succeeds", async () => {
		await expect(r2ObjectExists("uploads/u/i/photo.w960.webp")).resolves.toBe(
			true,
		);
	});

	it("answers false on ANY error instead of throwing", async () => {
		s3.send.mockRejectedValue(new Error("no such key"));

		await expect(r2ObjectExists("uploads/u/i/missing.webp")).resolves.toBe(
			false,
		);
	});
});

describe("public R2 URL guards", () => {
	it("resolves an exact-origin object beneath a configured base path", () => {
		expect(
			publicAssetKeyFromUrl(
				"https://assets.example.com/public/uploads/user_1/id/photo.png",
			),
		).toBe("uploads/user_1/id/photo.png");
	});

	it("rejects prefix-confusable hosts and base paths", () => {
		expect(
			isWanditHostedUrl(
				"https://assets.example.com.attacker.test/public/uploads/user_1/x/a.png",
			),
		).toBe(false);
		expect(
			isWanditHostedUrl(
				"https://assets.example.com/public-evil/uploads/user_1/x/a.png",
			),
		).toBe(false);
	});

	it("rejects malformed encoding and URL credentials", () => {
		expect(
			publicAssetKeyFromUrl("https://assets.example.com/public/%E0%A4%A"),
		).toBeNull();
		expect(
			publicAssetKeyFromUrl(
				"https://user:password@assets.example.com/public/uploads/user_1/x/a.png",
			),
		).toBeNull();
	});

	it("accepts only the authenticated user's upload key shape", () => {
		const own =
			"https://assets.example.com/public/uploads/user_1/upload_1/photo.webp";
		const anotherUser =
			"https://assets.example.com/public/uploads/user_2/upload_1/photo.webp";
		const generated =
			"https://assets.example.com/public/sites/project_1/assets/a/img-1.webp";

		expect(isUserUploadUrl(own, "user_1")).toBe(true);
		expect(isUserUploadUrl(anotherUser, "user_1")).toBe(false);
		expect(isUserUploadUrl(generated, "user_1")).toBe(false);
	});

	it("accepts any user's upload key shape for owner-agnostic history checks", () => {
		const anotherUser =
			"https://assets.example.com/public/uploads/user_2/upload_1/photo.webp";
		const generated =
			"https://assets.example.com/public/sites/project_1/assets/a/img-1.webp";
		const truncated = "https://assets.example.com/public/uploads/user_2";

		expect(isWanditUploadUrl(anotherUser)).toBe(true);
		expect(isWanditUploadUrl(generated)).toBe(false);
		expect(isWanditUploadUrl(truncated)).toBe(false);
		expect(
			isWanditUploadUrl("https://evil.example.net/uploads/u/i/f.png"),
		).toBe(false);
	});
});
