import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
	IMAGE_TO_VIDEO_DURATION_SECONDS,
	type MediaGenerationAttempt,
} from "@wandit/contracts";

import {
	getObjectBytes,
	getObjectContentType,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import {
	type MediaGenerationAttemptRow,
	MediaGenerationsRepository,
} from "../../infrastructure/persistence/media-generations.repository";

const GENERATION_STALE_AFTER_MS = 15 * 60 * 1_000;
const QUEUED_STALE_AFTER_MS = 30 * 60 * 1_000;
const STALE_GENERATION_ERROR =
	"The video did not finish. Please try animating the image again.";
const STALE_QUEUED_ERROR =
	"The video request did not reach the background generator. Please try again.";

@Injectable()
export class MediaGenerationsService {
	constructor(
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
	) {}

	async attempt(
		userId: string,
		attemptId: string,
	): Promise<MediaGenerationAttempt> {
		let row = await this.mediaGenerationsRepository.findOwnedAttempt(
			userId,
			attemptId,
		);

		if (!row) {
			throw new NotFoundException();
		}

		const staleCutoff = new Date(Date.now() - GENERATION_STALE_AFTER_MS);
		const queuedStaleCutoff = new Date(Date.now() - QUEUED_STALE_AFTER_MS);

		if (row.status === "queued" && row.createdAt < queuedStaleCutoff) {
			await this.mediaGenerationsRepository.markStaleQueuedAttemptFailed(
				row.id,
				queuedStaleCutoff,
				STALE_QUEUED_ERROR,
			);
			row = await this.mediaGenerationsRepository.findOwnedAttempt(
				userId,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		if (
			row.status === "generating" &&
			row.startedAt !== null &&
			row.startedAt < staleCutoff
		) {
			const recovered = await this.recoverStoredVideo(row);

			if (!recovered) {
				await this.mediaGenerationsRepository.markStaleGeneratingAttemptFailed(
					row.id,
					staleCutoff,
					STALE_GENERATION_ERROR,
				);
			}
			row = await this.mediaGenerationsRepository.findOwnedAttempt(
				userId,
				attemptId,
			);

			if (!row) {
				throw new NotFoundException();
			}
		}

		// All failure paths converge here. The operation is idempotent, so a
		// transient refund failure is retried by the next poll without ever
		// granting the same reservation twice.
		if (row.status === "failed") {
			await this.generationPolicyService.refundGenerationReservation(
				userId,
				row.id,
			);
		}

		return mapAttemptRow(row);
	}

	private async recoverStoredVideo(
		row: MediaGenerationAttemptRow,
	): Promise<boolean> {
		for (const candidate of [
			{ extension: "mp4", mediaType: "video/mp4" },
			{ extension: "webm", mediaType: "video/webm" },
		] as const) {
			const key = siteVideoKey(row.projectId, row.id, 1, candidate.extension);
			const storedMediaType = await getObjectContentType(key);

			if (!storedMediaType) {
				continue;
			}

			await this.mediaGenerationsRepository.markGeneratingAttemptSucceeded(
				row.id,
				publicAssetUrl(key),
				storedMediaType.startsWith("video/")
					? storedMediaType
					: candidate.mediaType,
			);

			return true;
		}

		return false;
	}

	async download(
		userId: string,
		attemptId: string,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		const row = await this.mediaGenerationsRepository.findOwnedAttempt(
			userId,
			attemptId,
		);
		const key = row?.videoUrl ? publicAssetKeyFromUrl(row.videoUrl) : null;

		if (row?.status !== "succeeded" || !key || !row.videoMediaType) {
			throw new NotFoundException();
		}

		const bytes = await getObjectBytes(key);

		if (!bytes) {
			throw new NotFoundException();
		}

		return {
			bytes,
			fileName:
				row.videoMediaType === "video/webm"
					? "wandit-animation.webm"
					: "wandit-animation.mp4",
			mediaType: row.videoMediaType,
		};
	}
}

function mapAttemptRow(row: MediaGenerationAttemptRow): MediaGenerationAttempt {
	return {
		aspect: row.aspect,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		durationSeconds: IMAGE_TO_VIDEO_DURATION_SECONDS,
		error: row.error,
		id: row.id,
		motion: row.motion,
		prompt: row.prompt,
		sourceImageUrl: row.sourceImageUrl,
		sourceMediaType: row.sourceMediaType,
		status: row.status,
		videoMediaType: row.videoMediaType,
		videoUrl: row.videoUrl,
	};
}
