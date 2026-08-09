import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import {
	isUserUploadUrl,
	isWanditHostedUrl,
	isWanditUploadUrl,
	publicAssetKeyFromUrl,
} from "./r2";

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
		expect(isWanditUploadUrl("https://evil.example.net/uploads/u/i/f.png")).toBe(
			false,
		);
	});
});
