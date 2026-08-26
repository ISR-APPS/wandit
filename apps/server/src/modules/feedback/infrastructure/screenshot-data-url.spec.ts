import { describe, expect, it } from "vitest";

import { decodeScreenshotDataUrl } from "./screenshot-data-url";

describe("decodeScreenshotDataUrl", () => {
	it("decodes PNG and JPEG data URLs", () => {
		const png = decodeScreenshotDataUrl("data:image/png;base64,aGVsbG8=");
		const jpeg = decodeScreenshotDataUrl("data:image/jpeg;base64,d29ybGQ=");

		expect(png).toEqual({
			bytes: Buffer.from("hello"),
			contentType: "image/png",
		});
		expect(jpeg).toEqual({
			bytes: Buffer.from("world"),
			contentType: "image/jpeg",
		});
	});

	it("rejects unsupported, empty, and malformed data URLs", () => {
		expect(
			decodeScreenshotDataUrl("data:image/webp;base64,aGVsbG8="),
		).toBeNull();
		expect(decodeScreenshotDataUrl("data:image/png;base64,")).toBeNull();
		expect(decodeScreenshotDataUrl("data:image/png;base64,%%%%")).toBeNull();
		expect(decodeScreenshotDataUrl("not a data URL")).toBeNull();
	});
});
