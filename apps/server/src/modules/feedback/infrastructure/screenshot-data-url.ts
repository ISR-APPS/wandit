export type ScreenshotContentType = "image/jpeg" | "image/png";

export type DecodedScreenshotDataUrl = {
	bytes: Buffer;
	contentType: ScreenshotContentType;
};

/** Decodes the PNG and JPEG data URLs accepted by the feedback contract. */
export function decodeScreenshotDataUrl(
	dataUrl: string,
): DecodedScreenshotDataUrl | null {
	const match = /^data:(image\/(?:png|jpeg));base64,(.+)$/s.exec(dataUrl);
	const contentType = match?.[1] as ScreenshotContentType | undefined;
	const base64 = match?.[2];

	if (!contentType || !base64) {
		return null;
	}

	const bytes = Buffer.from(base64, "base64");

	return bytes.byteLength > 0 ? { bytes, contentType } : null;
}
