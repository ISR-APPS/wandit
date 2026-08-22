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
import {
	isLegActivityTrackedGeneration,
	isMediaGenerationGeneratingStale,
	MEDIA_GENERATION_STALE_GENERATING_MS,
	MEDIA_GENERATION_STALE_QUEUED_MS,
} from "./media-generation-staleness";
import { createVideoBilling } from "./video-billing";

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

		const now = new Date();
		const staleCutoff = new Date(
			now.getTime() - MEDIA_GENERATION_STALE_GENERATING_MS[row.kind],
		);
		const queuedStaleCutoff = new Date(
			now.getTime() - MEDIA_GENERATION_STALE_QUEUED_MS,
		);

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

		const latestLegActivityAt =
			row.status === "generating" && isLegActivityTrackedGeneration(row.kind)
				? await this.mediaGenerationsRepository.latestLegActivityAt(row.id)
				: null;

		if (
			row.status === "generating" &&
			isMediaGenerationGeneratingStale(
				{
					kind: row.kind,
					latestLegActivityAt,
					startedAt: row.startedAt,
				},
				now,
			)
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
			const billing = createVideoBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			});
			const deliveredUnits = await this.deliveredExtensionUnits(row);

			if (deliveredUnits !== 0) {
				await billing.settleExisting(
					meteringSubjectFrom(scope),
					row.id,
					deliveredUnits,
				);
			} else {
				await billing.refund(meteringSubjectFrom(scope), row.id, row.kind);
			}
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
			const billing = createVideoBilling({
				isBillingDisabled: () => env.GENERATION_BILLING_MODE === "off",
				meteringService: this.meteringService,
			});
			const plannedUnits = await this.plannedUnits(row);
			await billing.settleExisting(
				meteringSubjectFrom(scope),
				row.id,
				plannedUnits,
			);

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

	private async deliveredExtensionUnits(
		row: MediaGenerationAttemptRow,
	): Promise<0 | 1 | 2 | 3> {
		const storedUnits =
			row.kind === "video-extension"
				? (await this.mediaGenerationsRepository.listLegs(row.id)).filter(
						(leg) => leg.status === "succeeded",
					).length
				: 0;
		const evidenceUnits =
			await this.mediaGenerationsRepository.providerEvidenceUnits(row.id);
		return videoUnits(Math.max(storedUnits, evidenceUnits), true);
	}

	private async plannedUnits(
		row: MediaGenerationAttemptRow,
	): Promise<1 | 2 | 3> {
		if (row.kind !== "video-extension") {
			return 1;
		}

		return videoUnits(
			(await this.mediaGenerationsRepository.listLegs(row.id)).length,
			false,
		);
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

		const baseName = downloadBaseName(row.kind);

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

function downloadBaseName(kind: MediaGenerationAttemptRow["kind"]): string {
	switch (kind) {
		case "image-animation":
			return "wandit-animation";
		case "text-to-video":
			return "wandit-video";
		case "video-edit":
			return "wandit-video-edit";
		case "video-extension":
			return "wandit-video-extension";
	}
}

function videoUnits(count: number, allowZero: true): 0 | 1 | 2 | 3;
function videoUnits(count: number, allowZero: false): 1 | 2 | 3;
function videoUnits(count: number, allowZero: boolean): 0 | 1 | 2 | 3 {
	if (
		!Number.isSafeInteger(count) ||
		count > 3 ||
		count < (allowZero ? 0 : 1)
	) {
		throw new Error("Video extension must have between one and three legs");
	}

	return count as 0 | 1 | 2 | 3;
}

function mapAttemptRow(row: MediaGenerationAttemptRow): MediaGenerationAttempt {
	return {
		aspect: row.aspect,
		completedAt: row.completedAt?.toISOString() ?? null,
		createdAt: row.createdAt.toISOString(),
		durationSeconds:
			row.actualDurationMs === null
				? row.durationSeconds
				: Math.round(row.actualDurationMs / 1_000),
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
