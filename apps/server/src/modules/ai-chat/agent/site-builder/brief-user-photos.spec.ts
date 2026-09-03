import { describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
	R2_PUBLIC_BASE_URL: "https://assets.example.com/public",
}));

vi.mock("@wandit/env/server", () => ({ env: mockEnv }));

import { extractBriefUserPhotoUrls } from "./brief-user-photos";

const BASE_URL = "https://assets.example.com/public";

function uploadUrl(
	filename: string,
	userId = "user_1",
	uploadId = "upload_1",
): string {
	return `${BASE_URL}/uploads/${userId}/${uploadId}/${filename}`;
}

describe("extractBriefUserPhotoUrls", () => {
	it("extracts image uploads from prose, markdown, and parentheses", () => {
		const prose = uploadUrl("front.JPG");
		const markdown = uploadUrl("side.png", "user_2", "upload_2");
		const parenthesized = uploadUrl("detail.webp", "user_3", "upload_3");
		const brief = [
			`Front photo: ${prose},`,
			`Side photo: [view](${markdown}).`,
			`Detail photo (${parenthesized}).`,
		].join("\n");

		expect(extractBriefUserPhotoUrls(brief)).toEqual([
			prose,
			markdown,
			parenthesized,
		]);
	});

	it("ignores non-upload R2 assets, external URLs, and non-image uploads", () => {
		const valid = uploadUrl("product.jpeg");
		const brief = [
			`${BASE_URL}/sites/project_1/assets/attempt_1/img-1.webp`,
			"https://outside.example.com/uploads/user_1/upload_1/photo.jpg",
			uploadUrl("animation.gif", "user_1", "upload_2"),
			uploadUrl("source.avif", "user_1", "upload_3"),
			uploadUrl("catalog.pdf", "user_1", "upload_4"),
			uploadUrl("notes.docx", "user_1", "upload_5"),
			valid,
		].join("\n");

		expect(extractBriefUserPhotoUrls(brief)).toEqual([valid]);
	});

	it("deduplicates while preserving first-seen order", () => {
		const first = uploadUrl("front.jpg", "user_1", "upload_1");
		const second = uploadUrl("back.png", "user_2", "upload_2");

		expect(
			extractBriefUserPhotoUrls(`${first}. ${second}, [duplicate](${first})`),
		).toEqual([first, second]);
	});

	it("caps the result at six photos", () => {
		const photos = Array.from({ length: 8 }, (_, index) =>
			uploadUrl(`photo-${index + 1}.webp`, "user_1", `upload_${index + 1}`),
		);

		expect(extractBriefUserPhotoUrls(photos.join("\n"))).toEqual(
			photos.slice(0, 6),
		);
	});

	it("returns an empty list when the brief has no user photos", () => {
		expect(
			extractBriefUserPhotoUrls("Build a clean COD landing page."),
		).toEqual([]);
	});
});
