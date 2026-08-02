import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ImageGenerationAttempt } from "@wandit/contracts";
import { and, eq, lt } from "@wandit/db";
import { imageGenerationAttempts } from "@wandit/db/schema/image-generation-attempts";
import { env } from "@wandit/env/server";
import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	captureGenerationCompleted,
	captureGenerationFailed,
} from "../../../../infrastructure/analytics/generation-events";
import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	getObjectBytes,
	getObjectContentType,
	imageGenerationKey,
	publicAssetKeyFromUrl,
	publicAssetUrl,
} from "../../../../infrastructure/storage/r2";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	type ImageGenerationAttemptRow,
	ImageGenerationsRepository,
} from "../../infrastructure/persistence/image-generations.repository";
import { createImageGenerationBilling } from "./image-generation-billing";

const GENERATION_STALE_AFTER_MS = 15 * 60 * 1_000;
const QUEUED_STALE_AFTER_MS = 30 * 60 * 1_000;
const STALE_GENERATION_ERROR =
	"The images did not finish. Please try generating them again.";
const STALE_QUEUED_ERROR =
	"The image request did not reach the background generator. Please try again.";

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

@Injectable()
export class ImageGenerationsService {
	constructor(
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		// Direct database access ONLY for the stale-generating settlement below —
		// the repository stays the single reader/writer for everything else.
		@Inject(DATABASE) private readonly db: Database,
		@Inject(AnalyticsService)
		private readonly analyticsService: AnalyticsService,
	) {}

	async attempt(
		userId: string,
		attemptId: string,
	): Promise<ImageGenerationAttempt> {
		let row = await this.imageGenerationsRepository.findOwnedAttempt(
			userId,
			attemptId,
		);

		if (!row) {
			throw new NotFoundException();
		}

		const staleCutoff = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
		const queuedStaleCutoff = new Date(Date.now() - QUEUED_STALE_AFTER_MS);

		if (row.status === "queued" && row.createdAt < queuedStaleCutoff) {
			await this.imageGenerationsRepository.markAttemptFailed(
				row.id,
				STALE_QUEUED_ERROR,
				userId,
				"stale_queued",
			);
			row = await this.imageGenerationsRepository.findOwnedAttempt(
				userId,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		if (
			row.status === "generating" &&
			row.completedAt === null &&
			(await this.settleStaleGenerating(row, staleCutoff, userId))
		) {
			row = await this.imageGenerationsRepository.findOwnedAttempt(
				userId,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		// All failure paths converge here; the refund is idempotent so a
		// transient failure is retried by the next poll without double-refunding.
		if (row.status === "failed") {
			await createImageGenerationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).refund(userId, row.id);
		}

		return mapAttemptRow(row);
	}

	async download(
		userId: string,
		attemptId: string,
		index: number,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		const row = await this.imageGenerationsRepository.findOwnedAttempt(
			userId,
			attemptId,
		);

		if (row?.status !== "succeeded" || !row.images) {
			throw new NotFoundException();
		}

		const image = row.images[index - 1];

		if (!image) {
			throw new NotFoundException();
		}

		const key = publicAssetKeyFromUrl(image.url);

		if (!key) {
			throw new NotFoundException();
		}

		const bytes = await getObjectBytes(key);

		if (!bytes) {
			throw new NotFoundException();
		}

		const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? "png";

		return {
			bytes,
			fileName: `${sanitizeFileName(row.title)}-${index}.${extension}`,
			mediaType: image.mediaType,
		};
	}

	/**
	 * A generating row past the stale window either recovers from its
	 * deterministic R2 objects or fails (status-guarded, so a concurrent
	 * worker settlement always wins).
	 */
	private async settleStaleGenerating(
		row: ImageGenerationAttemptRow,
		staleCutoff: Date,
		userId: string,
	): Promise<boolean> {
		const [stale] = await this.db
			.select({ startedAt: imageGenerationAttempts.startedAt })
			.from(imageGenerationAttempts)
			.where(
				and(
					eq(imageGenerationAttempts.id, row.id),
					eq(imageGenerationAttempts.status, "generating"),
					lt(imageGenerationAttempts.startedAt, staleCutoff),
				),
			)
			.limit(1);

		if (!stale) {
			return false;
		}

		const recovered = await this.recoverStoredImages(row);

		if (recovered) {
			// The deterministic upload proves provider work completed. Repair the
			// existing hold before publishing success; lookup avoids inventing an
			// unknown parent relationship for legacy/billing-off rows.
			await createImageGenerationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).settleExisting(userId, row.id, recovered.length);

			const [completed] = await this.db
				.update(imageGenerationAttempts)
				.set({
					completedAt: new Date(),
					error: null,
					images: recovered,
					status: "succeeded",
				})
				.where(
					and(
						eq(imageGenerationAttempts.id, row.id),
						eq(imageGenerationAttempts.status, "generating"),
					),
				)
				.returning({ projectId: imageGenerationAttempts.projectId });

			if (completed) {
				captureGenerationCompleted(
					this.analyticsService,
					userId,
					"image",
					completed.projectId,
					row.id,
				);
			}

			return true;
		}

		const [failed] = await this.db
			.update(imageGenerationAttempts)
			.set({
				completedAt: new Date(),
				error: STALE_GENERATION_ERROR,
				status: "failed",
			})
			.where(
				and(
					eq(imageGenerationAttempts.id, row.id),
					eq(imageGenerationAttempts.status, "generating"),
					lt(imageGenerationAttempts.startedAt, staleCutoff),
				),
			)
			.returning({ projectId: imageGenerationAttempts.projectId });

		if (failed) {
			captureGenerationFailed(
				this.analyticsService,
				userId,
				"image",
				failed.projectId,
				row.id,
				"stale_generation",
			);
		}

		return true;
	}

	private async recoverStoredImages(
		row: ImageGenerationAttemptRow,
	): Promise<{ mediaType: string; url: string }[] | null> {
		const images: { mediaType: string; url: string }[] = [];

		for (let index = 1; index <= row.count; index += 1) {
			let found: { mediaType: string; url: string } | null = null;

			for (const candidate of [
				{ extension: "png", mediaType: "image/png" },
				{ extension: "jpg", mediaType: "image/jpeg" },
				{ extension: "webp", mediaType: "image/webp" },
			] as const) {
				const key = imageGenerationKey(
					row.projectId,
					row.id,
					index,
					candidate.extension,
				);
				const storedMediaType = await getObjectContentType(key);

				if (!storedMediaType) {
					continue;
				}

				found = {
					mediaType: storedMediaType.startsWith("image/")
						? storedMediaType
						: candidate.mediaType,
					url: publicAssetUrl(key),
				};
				break;
			}

			if (!found) {
				break;
			}

			images.push(found);
		}

		return images.length > 0 ? images : null;
	}
}

function sanitizeFileName(title: string): string {
	const slug = title
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();

	return slug.length > 0 ? slug.slice(0, 60) : "wandit-image";
}

function mapAttemptRow(row: ImageGenerationAttemptRow): ImageGenerationAttempt {
	return {
		aspect: row.aspect,
		completedAt: row.completedAt?.toISOString() ?? null,
		count: row.count,
		createdAt: row.createdAt.toISOString(),
		error: row.error,
		id: row.id,
		images: row.images,
		prompt: row.prompt,
		sourceImageUrls: row.sourceImageUrls,
		status: row.status,
		title: row.title,
	};
}
