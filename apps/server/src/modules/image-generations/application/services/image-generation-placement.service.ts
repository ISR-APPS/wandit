import { Inject, Injectable } from "@nestjs/common";
import {
	type GenerateImagePlacement,
	generateImagePlacementSchema,
} from "@wandit/contracts";
import * as cheerio from "cheerio";

import { getPageHtml } from "../../../../infrastructure/storage/r2";
import {
	type AiEditReceipt,
	PageEditsService,
} from "../../../pages/application/services/page-edits.service";
import { stampHtml } from "../../../pages/domain/stamp";
import { PagesRepository } from "../../../pages/infrastructure/persistence/pages.repository";
import {
	ImageGenerationsRepository,
	type PersistedImagePlacement,
} from "../../infrastructure/persistence/image-generations.repository";

type PlacementAttempt = {
	id: string;
	projectDeletedAt?: Date | null;
	projectId: string;
	spec: Record<string, unknown> | null;
};

type PlacementImage = {
	url: string;
};

type PendingImagePlacement = GenerateImagePlacement & {
	status: "pending";
};

type StoredImagePlacement = GenerateImagePlacement & {
	status: "applied" | "failed" | "pending";
};

export type ImagePlacementDependencies = {
	findReceipt: (
		projectId: string,
		attemptId: string,
	) => Promise<{ number: number } | null>;
	loadCurrentPageHtml: (projectId: string) => Promise<string | null>;
	pageEditsService: Pick<PageEditsService, "applyAiOps">;
	updatePlacement: (
		attempt: PlacementAttempt,
		placement: PersistedImagePlacement,
	) => Promise<void>;
};

@Injectable()
export class ImageGenerationPlacementService {
	constructor(
		@Inject(ImageGenerationsRepository)
		private readonly imageGenerationsRepository: ImageGenerationsRepository,
		@Inject(PageEditsService)
		private readonly pageEditsService: PageEditsService,
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
	) {}

	async settle(
		attempt: PlacementAttempt,
		images: readonly PlacementImage[],
	): Promise<boolean> {
		return settleImagePlacement(attempt, images, {
			findReceipt: (projectId, attemptId) =>
				this.pagesRepository.findAiEditVersionByReceipt(projectId, attemptId),
			loadCurrentPageHtml: async (projectId) => {
				const page =
					await this.pagesRepository.findActivePageByProjectUnchecked(
						projectId,
					);

				return page?.version ? getPageHtml(page.version.r2Key) : null;
			},
			pageEditsService: this.pageEditsService,
			updatePlacement: (currentAttempt, placement) =>
				this.imageGenerationsRepository.updatePlacement(
					currentAttempt.id,
					currentAttempt.projectId,
					placement,
				),
		});
	}
}

/**
 * Settle one optional generated-image placement. The immutable page-version
 * receipt is authoritative: retries check all history before each CAS attempt,
 * so a later edit can never make an old generation overwrite newer work.
 */
export async function settleImagePlacement(
	attempt: PlacementAttempt,
	images: readonly PlacementImage[],
	dependencies: ImagePlacementDependencies,
): Promise<boolean> {
	const storedPlacement = readImagePlacement(attempt.spec);

	if (!storedPlacement || storedPlacement.status === "applied") {
		return false;
	}

	if (storedPlacement.status === "failed") {
		const receiptVersion = await dependencies.findReceipt(
			attempt.projectId,
			attempt.id,
		);

		if (!receiptVersion) {
			return false;
		}

		await dependencies.updatePlacement(attempt, {
			...storedPlacement,
			status: "applied",
			versionNumber: receiptVersion.number,
		});
		return true;
	}

	const placement: PendingImagePlacement = {
		...storedPlacement,
		status: "pending",
	};

	if (attempt.projectDeletedAt) {
		await settlePlacementFailure(
			attempt,
			placement,
			"The project was deleted before the generated image could be applied.",
			dependencies,
		);
		return true;
	}

	const image = images[placement.imageIndex - 1];
	const receipt: AiEditReceipt = {
		attemptId: attempt.id,
		kind: "image-generation-placement",
	};

	for (let editAttempt = 0; editAttempt < 2; editAttempt += 1) {
		const receiptVersion = await dependencies.findReceipt(
			attempt.projectId,
			attempt.id,
		);

		if (receiptVersion) {
			await dependencies.updatePlacement(attempt, {
				...placement,
				status: "applied",
				versionNumber: receiptVersion.number,
			});
			return true;
		}

		if (!image) {
			await settlePlacementFailure(
				attempt,
				placement,
				`Generated image ${placement.imageIndex} is unavailable.`,
				dependencies,
			);
			return true;
		}

		const target = await inspectCurrentImageTarget(
			attempt.projectId,
			placement.wid,
			dependencies.loadCurrentPageHtml,
		);

		if (typeof target === "object") {
			await settlePlacementFailure(
				attempt,
				placement,
				target.reason,
				dependencies,
			);
			return true;
		}

		const result = await dependencies.pageEditsService.applyAiOps(
			attempt.projectId,
			[{ kind: "image-src", value: image.url, wid: placement.wid }],
			receipt,
		);

		if (result.status === "applied") {
			await dependencies.updatePlacement(attempt, {
				...placement,
				status: "applied",
				versionNumber: result.versionNumber,
			});
			return true;
		}

		if (
			editAttempt === 0 &&
			result.status === "rejected" &&
			result.message.startsWith("The page changed mid-edit")
		) {
			continue;
		}

		await settlePlacementFailure(
			attempt,
			placement,
			result.message,
			dependencies,
		);
		return true;
	}

	return true;
}

async function settlePlacementFailure(
	attempt: PlacementAttempt,
	placement: PendingImagePlacement,
	reason: string,
	dependencies: ImagePlacementDependencies,
): Promise<void> {
	// Another worker or the polling fallback may have committed the receipt
	// after this caller's initial check. A durable page version always wins over
	// a stale terminal failure observation.
	const receiptVersion = await dependencies.findReceipt(
		attempt.projectId,
		attempt.id,
	);

	if (receiptVersion) {
		await dependencies.updatePlacement(attempt, {
			...placement,
			status: "applied",
			versionNumber: receiptVersion.number,
		});
		return;
	}

	await dependencies.updatePlacement(attempt, {
		...placement,
		reason,
		status: "failed",
	});
}

async function inspectCurrentImageTarget(
	projectId: string,
	wid: string,
	loadCurrentPageHtml: ImagePlacementDependencies["loadCurrentPageHtml"],
): Promise<"ready" | { reason: string }> {
	const html = await loadCurrentPageHtml(projectId);

	if (html === null) {
		return { reason: "The current page HTML is no longer available." };
	}

	// PageEditsService stamps the same source before applying its op. Inspect
	// that exact working shape so legacy unstamped pages behave consistently.
	const $ = cheerio.load(stampHtml(html));
	const target = $(`[data-wid="${wid}"]`);

	if (target.length === 0) {
		return { reason: `No element with data-wid="${wid}" remains on the page.` };
	}

	if (target.length !== 1) {
		return { reason: `The data-wid "${wid}" is no longer unique on the page.` };
	}

	if (!target.is("img")) {
		return {
			reason: `The element with data-wid="${wid}" is no longer an <img>.`,
		};
	}

	return "ready";
}

function readImagePlacement(
	spec: Record<string, unknown> | null,
): StoredImagePlacement | null {
	if (!spec) {
		return null;
	}

	const parsed = generateImagePlacementSchema.safeParse(spec.placement);

	if (!parsed.success || typeof spec.placement !== "object") {
		return null;
	}

	const status = (spec.placement as Record<string, unknown>).status;

	if (status !== "pending" && status !== "applied" && status !== "failed") {
		return null;
	}

	return { ...parsed.data, status };
}
