import { describe, expect, it } from "vitest";

import { composeBuildStartMessages } from "./build-start-messages";

describe("composeBuildStartMessages", () => {
	it("preserves photo order and omits only an unusable file part", () => {
		const firstUrl = "https://assets.example.com/uploads/u/one/photo.jpg";
		const secondUrl = "https://assets.example.com/uploads/u/two/photo.webp";
		const thirdUrl = "https://assets.example.com/uploads/u/three/photo.png";
		// Distinct bytes expose any change to the source order.
		const firstBytes = new Uint8Array([4, 5, 6]);
		const bytes = new Uint8Array([1, 2, 3]);

		const messages = composeBuildStartMessages({
			brief: "Use the supplied product photos.",
			title: "Photo page",
			userPhotos: [
				{
					bytes: firstBytes,
					kind: "bytes",
					mediaType: "image/jpeg",
					url: firstUrl,
				},
				{ bytes, kind: "bytes", mediaType: "image/webp", url: secondUrl },
				{ kind: "unusable", reason: "object missing", url: thirdUrl },
			],
		});
		const content = messages[0]?.content;

		if (!Array.isArray(content)) {
			throw new Error("Expected a content array");
		}

		expect(content.slice(1, 6)).toEqual([
			{
				text: `[User photo 1 — URL: ${firstUrl}]`,
				type: "text",
			},
			{ data: firstBytes, mediaType: "image/jpeg", type: "file" },
			{
				text: `[User photo 2 — URL: ${secondUrl}]`,
				type: "text",
			},
			{ data: bytes, mediaType: "image/webp", type: "file" },
			{
				text:
					`[User photo 3 — URL: ${thirdUrl}] — this photo could not be ` +
					"loaded for viewing (object missing); place it by URL only",
				type: "text",
			},
		]);
		expect(content).toHaveLength(7);
		expect(content[6]).toMatchObject({
			text: expect.stringContaining("except the ones marked as not loadable"),
			type: "text",
		});
	});
});
