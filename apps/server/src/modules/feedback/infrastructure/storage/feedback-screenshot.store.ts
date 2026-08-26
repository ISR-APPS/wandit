import { Injectable, Logger } from "@nestjs/common";
import { env } from "@wandit/env/server";

import {
	feedbackScreenshotKey,
	isR2Configured,
	publicAssetUrl,
	putSiteFile,
} from "../../../../infrastructure/storage/r2";
import { decodeScreenshotDataUrl } from "../screenshot-data-url";

@Injectable()
export class FeedbackScreenshotStore {
	private readonly logger = new Logger(FeedbackScreenshotStore.name);

	async store(feedbackId: string, dataUrl: string): Promise<string | null> {
		if (!isR2Configured() || !env.R2_PUBLIC_BASE_URL) {
			this.logger.warn("Feedback screenshot storage is not configured");
			return null;
		}

		const decoded = decodeScreenshotDataUrl(dataUrl);

		if (!decoded) {
			this.logger.warn("Feedback screenshot data URL could not be decoded");
			return null;
		}

		const extension = decoded.contentType === "image/png" ? "png" : "jpg";
		const key = feedbackScreenshotKey(feedbackId, extension);

		try {
			await putSiteFile(key, decoded.bytes, decoded.contentType);

			return publicAssetUrl(key);
		} catch (error) {
			this.logger.warn(
				`Feedback screenshot upload failed: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
			return null;
		}
	}
}
