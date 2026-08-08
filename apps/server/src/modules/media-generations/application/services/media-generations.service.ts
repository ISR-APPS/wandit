import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { MediaGenerationAttempt } from "@wandit/contracts";
import { env } from "@wandit/env/server";
import {
	getObjectBytes,
	getObjectContentType,
	publicAssetKeyFromUrl,
	publicAssetUrl,
	siteVideoKey,
} from "../../../../infrastructure/storage/r2";
import { MeteringService } from "../../../metering/application/services/metering.service";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import {
	type MediaGenerationAttemptRow,
	MediaGenerationsRepository,
} from "../../infrastructure/persistence/media-generations.repository";
import { createImageAnimationBilling } from "./image-animation-billing";

const GENERATION_STALE_AFTER_MS = 15 * 60 * 1_000;
const QUEUED_STALE_AFTER_MS = 30 * 60 * 1_000;
const STALE_GENERATION_ERROR = "The video did not finish. Please try again.";
const STALE_QUEUED_ERROR =
	"The video request did not reach the background generator. Please try again.";

@Injectable()
export class MediaGenerationsService {
	constructor(
		@Inject(MediaGenerationsRepository)
		private readonly mediaGenerationsRepository: MediaGenerationsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
	) {}

	async attempt(
		scope: ProjectScope,
		attemptId: string,
	): Promise<MediaGenerationAttempt> {
		const userId = scope.userId;
		let row = await this.mediaGenerationsRepository.findAccessibleAttempt(
			scope,
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
				userId,
			);
			row = await this.mediaGenerationsRepository.findAccessibleAttempt(
				scope,
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
			const recovered = await this.recoverStoredVideo(row, scope);

			if (!recovered) {
				await this.mediaGenerationsRepository.markStaleGeneratingAttemptFailed(
					row.id,
					staleCutoff,
					STALE_GENERATION_ERROR,
					userId,
				);
			}
			row = await this.mediaGenerationsRepository.findAccessibleAttempt(
				scope,
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
			await createImageAnimationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).refund(meteringSubjectFrom(scope), row.id);
		}

		return mapAttemptRow(row);
	}

	private async recoverStoredVideo(
		row: MediaGenerationAttemptRow,
		scope: ProjectScope,
	): Promise<boolean> {
		const userId = scope.userId;
		for (const candidate of [
			{ extension: "mp4", mediaType: "video/mp4" },
			{ extension: "webm", mediaType: "video/webm" },
		] as const) {
			const key = siteVideoKey(row.projectId, row.id, 1, candidate.extension);
			const storedMediaType = await getObjectContentType(key);

			if (!storedMediaType) {
				continue;
			}

			// Storage is durable proof that provider work completed. Settle any
			// existing hold before making the recovered video visible.
			await createImageAnimationBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			}).settleExisting(meteringSubjectFrom(scope), row.id);

			await this.mediaGenerationsRepository.markGeneratingAttemptSucceeded(
				row.id,
				publicAssetUrl(key),
				storedMediaType.startsWith("video/")
					? storedMediaType
					: candidate.mediaType,
				userId,
			);

			return true;
		}

		return false;
	}

	async download(
		scope: ProjectScope,
		attemptId: string,
	): Promise<{ bytes: Uint8Array; fileName: string; mediaType: string }> {
		const row = await this.mediaGenerationsRepository.findAccessibleAttempt(
			scope,
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

		const baseName =
			row.kind === "text-to-video" ? "wandit-video" : "wandit-animation";

		return {
			bytes,
			fileName:
				row.videoMediaType === "video/webm"
					? `${baseName}.webm`
					: `${baseName}.mp4`,
			mediaType: row.videoMediaType,
		};
	}
}

function mapAttemptRow(row: MediaGenerationAttemptRow): MediaGenerationAttempt {
	return {
		aspect: row.aspect,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		durationSeconds: row.durationSeconds === 10 ? 10 : 5,
		error: row.error,
		id: row.id,
		kind: row.kind,
		motion: row.motion,
		prompt: row.prompt,
		sourceImageUrl: row.sourceImageUrl,
		sourceMediaType: row.sourceMediaType,
		status: row.status,
		title: row.title,
		videoMediaType: row.videoMediaType,
		videoUrl: row.videoUrl,
		voiceover: row.voiceover,
	};
}
