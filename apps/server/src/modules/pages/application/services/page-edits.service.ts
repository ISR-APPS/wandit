/**
 * The write side of page editing (V2 spec §5/§7/§14): every mutation — an
 * inline-editor/theme-panel ops batch over HTTP, the chat agent's
 * replace_section, or a historical-version restore — copies source HTML,
 * applies the ops, re-stamps, uploads a NEW immutable version to R2, and flips
 * the artifact's active pointer in one transaction. No in-place mutation,
 * ever.
 */
import {
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import {
	type ApplyPageOpsBody,
	type ApplyPageOpsResponse,
	type EditOp,
	PAGE_TOKEN_NAMES,
	type RestorePageVersionBody,
	type RestorePageVersionResponse,
} from "@wandit/contracts";
import * as cheerio from "cheerio";

import {
	deleteObject,
	getPageHtml,
	isWanditHostedUrl,
	pageHtmlKey,
	putPageHtml,
} from "../../../../infrastructure/storage/r2";
import {
	type ApplyOpsContext,
	applyOps,
	extractRootTokens,
} from "../../domain/ops";
import { stampHtml } from "../../domain/stamp";
import {
	PagesRepository,
	VersionConflictError,
} from "../../infrastructure/persistence/pages.repository";

// The chat-tool path answers statuses, not HTTP exceptions — the model needs
// something relayable, never a thrown 4xx.
export type ApplyAiOpsResult =
	| { status: "applied"; versionNumber: number }
	| { status: "no-page" | "rejected"; message: string };

export type AiEditReceipt = {
	attemptId: string;
	kind: "image-generation-placement";
};

type MutationOutcome =
	| { ok: true; version: { createdAt: Date; id: string; number: number } }
	| { kind: "no-html"; ok: false }
	| { index: number; kind: "op-failed"; ok: false; reason: string }
	| { activeVersionId: string | null; kind: "conflict"; ok: false };

@Injectable()
export class PageEditsService {
	private readonly logger = new Logger(PageEditsService.name);

	constructor(
		@Inject(PagesRepository)
		private readonly pagesRepository: PagesRepository,
	) {}

	// HTTP path (ownership-checked). Throws Nest exceptions the global filter
	// maps to the error envelope.
	async applyClientOps(
		userId: string,
		projectId: string,
		body: ApplyPageOpsBody,
	): Promise<ApplyPageOpsResponse> {
		const page = await this.pagesRepository.findActivePageByProject(
			userId,
			projectId,
		);

		// Missing project, artifact, or version all become 404 — never reveal
		// which (same posture as the read side).
		if (!page?.version) {
			throw new NotFoundException();
		}

		if (body.baseVersionId !== page.version.id) {
			throw new ConflictException({
				activeVersionId: page.version.id,
				code: "VERSION_CONFLICT",
			});
		}

		const hostedUrlFailure = validateHostedAssetUrls(body.ops);

		if (hostedUrlFailure) {
			throw new UnprocessableEntityException({
				code: "OP_FAILED",
				index: hostedUrlFailure.index,
				reason: hostedUrlFailure.reason,
			});
		}

		let context: ApplyOpsContext | undefined;
		const resetIndex = body.ops.findIndex((op) => op.kind === "reset-tokens");

		if (resetIndex !== -1) {
			const builderVersion =
				await this.pagesRepository.findLatestBuilderVersion(page.artifactId);

			if (!builderVersion) {
				throw new UnprocessableEntityException({
					code: "OP_FAILED",
					index: resetIndex,
					reason: "no original theme found",
				});
			}

			const originalHtml = await getPageHtml(builderVersion.r2Key);

			if (originalHtml === null) {
				throw new UnprocessableEntityException({
					code: "OP_FAILED",
					index: resetIndex,
					reason: "the original version could not be loaded",
				});
			}

			const values = extractRootTokens(originalHtml);

			if (PAGE_TOKEN_NAMES.some((name) => values[name] === undefined)) {
				throw new UnprocessableEntityException({
					code: "OP_FAILED",
					index: resetIndex,
					reason: "the original page does not declare a complete theme",
				});
			}

			context = {
				originalTheme: {
					fontLinkHrefs: collectFontStylesheetHrefs(originalHtml),
					values,
				},
			};
		}

		const outcome = await this.mutate({
			artifactId: page.artifactId,
			baseVersion: page.version,
			context,
			expectedActiveVersionId: page.version.id,
			ops: body.ops,
			projectId,
			source: body.source,
		});

		if (!outcome.ok) {
			switch (outcome.kind) {
				case "no-html":
					throw new NotFoundException();
				case "op-failed":
					throw new UnprocessableEntityException({
						code: "OP_FAILED",
						index: outcome.index,
						reason: outcome.reason,
					});
				case "conflict":
					throw new ConflictException({
						activeVersionId: outcome.activeVersionId,
						code: "VERSION_CONFLICT",
					});
			}
		}

		return {
			version: {
				createdAt: outcome.version.createdAt.toISOString(),
				id: outcome.version.id,
				number: outcome.version.number,
			},
		};
	}

	// Restoring is copy-forward, never a pointer rewind: read the selected
	// historical version, then append its stamped HTML as a brand-new version.
	async restoreVersion(
		userId: string,
		projectId: string,
		versionId: string,
		body: RestorePageVersionBody,
	): Promise<RestorePageVersionResponse> {
		const page = await this.pagesRepository.findActivePageByProject(
			userId,
			projectId,
		);

		if (!page?.version) {
			throw new NotFoundException();
		}

		const version = await this.pagesRepository.findOwnedVersionById(
			userId,
			versionId,
		);

		// The version must belong to this exact project's landing artifact. An
		// owned version from another project is still foreign to this route.
		if (
			!version ||
			version.projectId !== projectId ||
			version.artifactId !== page.artifactId
		) {
			throw new NotFoundException();
		}

		if (body.expectedActiveVersionId !== page.version.id) {
			throw new ConflictException({
				activeVersionId: page.version.id,
				code: "VERSION_CONFLICT",
			});
		}

		const outcome = await this.mutate({
			artifactId: page.artifactId,
			baseVersion: version,
			expectedActiveVersionId: body.expectedActiveVersionId,
			ops: [],
			projectId,
			restoredFromVersionId: version.id,
			source: "restore",
		});

		if (!outcome.ok) {
			switch (outcome.kind) {
				case "no-html":
					throw new NotFoundException();
				case "op-failed":
					throw new UnprocessableEntityException({
						code: "OP_FAILED",
						index: outcome.index,
						reason: outcome.reason,
					});
				case "conflict":
					throw new ConflictException({
						activeVersionId: outcome.activeVersionId,
						code: "VERSION_CONFLICT",
					});
			}
		}

		return {
			version: {
				createdAt: outcome.version.createdAt.toISOString(),
				id: outcome.version.id,
				number: outcome.version.number,
			},
		};
	}

	// Chat-tool path (ownership pre-proven by the chat's controller query).
	// Always targets the CURRENT active version at execution time.
	async applyAiOps(
		projectId: string,
		ops: EditOp[],
		receipt?: AiEditReceipt,
	): Promise<ApplyAiOpsResult> {
		const page =
			await this.pagesRepository.findActivePageByProjectUnchecked(projectId);

		if (!page?.version) {
			return {
				message: "No page has been generated yet.",
				status: "no-page",
			};
		}

		const hostedUrlFailure = validateHostedAssetUrls(ops);

		if (hostedUrlFailure) {
			return {
				message: formatAiOpFailure(
					ops,
					hostedUrlFailure.index,
					hostedUrlFailure.reason,
				),
				status: "rejected",
			};
		}

		const outcome = await this.mutate({
			artifactId: page.artifactId,
			baseVersion: page.version,
			expectedActiveVersionId: page.version.id,
			ops,
			projectId,
			receipt,
			source: "ai-edit",
		});

		if (!outcome.ok) {
			switch (outcome.kind) {
				case "no-html":
					return {
						message: "The page's HTML could not be loaded.",
						status: "no-page",
					};
				case "op-failed": {
					return {
						message: formatAiOpFailure(ops, outcome.index, outcome.reason),
						status: "rejected",
					};
				}
				case "conflict":
					return {
						message:
							"The page changed mid-edit (another save landed first) — " +
							"re-read the section and retry.",
						status: "rejected",
					};
			}
		}

		return { status: "applied", versionNumber: outcome.version.number };
	}

	// Shared flow: load base HTML → apply ops → restamp → upload NEW version
	// object → insert row + flip pointer atomically.
	private async mutate(input: {
		artifactId: string;
		baseVersion: { id: string; r2Key: string };
		context?: ApplyOpsContext;
		expectedActiveVersionId: string;
		ops: readonly EditOp[];
		projectId: string;
		receipt?: AiEditReceipt;
		restoredFromVersionId?: string;
		source: "ai-edit" | "inline" | "restore" | "theme";
	}): Promise<MutationOutcome> {
		const html = await getPageHtml(input.baseVersion.r2Key);

		if (html === null) {
			return { kind: "no-html", ok: false };
		}

		// The preview, AI-read, and mutation paths all run this deterministic
		// pass so widened leaf eligibility resolves to the same stable wids.
		const baseHtml = stampHtml(html);
		const result = applyOps(baseHtml, input.ops, input.context);

		if (!result.ok) {
			return {
				index: result.index,
				kind: "op-failed",
				ok: false,
				reason: result.reason,
			};
		}

		const stamped = stampHtml(result.html);
		const newVersionId = crypto.randomUUID();
		const key = pageHtmlKey(input.projectId, newVersionId);

		// Upload BEFORE the transaction — a version row must never point at an
		// object that does not exist (same invariant as the Trigger task).
		await putPageHtml(key, stamped);

		try {
			const activation = await this.pagesRepository.insertVersionAndActivate({
				artifactId: input.artifactId,
				expectedActiveVersionId: input.expectedActiveVersionId,
				meta: {
					editedWids: result.editedWids,
					// Value-free audit summary — never the payloads.
					ops: input.ops.map((op) => ({
						kind: op.kind,
						...("wid" in op ? { wid: op.wid } : {}),
					})),
					parentVersionId: input.expectedActiveVersionId,
					...(input.receipt ? { receipt: input.receipt } : {}),
					...(input.restoredFromVersionId
						? { restoredFromVersionId: input.restoredFromVersionId }
						: {}),
					source: input.source,
				},
				projectId: input.projectId,
				...(input.receipt ? { receipt: input.receipt } : {}),
				r2Key: key,
				versionId: newVersionId,
			});

			if (activation.existingVersionId) {
				await this.deleteOrphanVersionObject(key);

				return {
					ok: true,
					version: {
						createdAt: activation.createdAt,
						id: activation.existingVersionId,
						number: activation.number,
					},
				};
			}

			return {
				ok: true,
				version: {
					createdAt: activation.createdAt,
					id: newVersionId,
					number: activation.number,
				},
			};
		} catch (error) {
			if (error instanceof VersionConflictError) {
				await this.deleteOrphanVersionObject(key);

				return {
					activeVersionId: error.activeVersionId,
					kind: "conflict",
					ok: false,
				};
			}

			throw error;
		}
	}

	private async deleteOrphanVersionObject(key: string): Promise<void> {
		try {
			await deleteObject(key);
		} catch (cleanupError) {
			this.logger.warn(
				`Failed to delete orphaned page version object ${key}`,
				cleanupError,
			);
		}
	}
}

function validateHostedAssetUrls(
	ops: readonly EditOp[],
): { index: number; reason: string } | undefined {
	// Image, brand-logo, and section background URLs must be Wandit-hosted assets
	// (contract §6). Parsed-origin comparison, never a raw prefix check.
	for (const [index, op] of ops.entries()) {
		if (op.kind === "image-src" && !isWanditHostedUrl(op.value)) {
			return {
				index,
				reason: "image URL must be a Wandit-hosted asset",
			};
		}

		if (
			op.kind === "brand-logo" &&
			op.value !== null &&
			!isWanditHostedUrl(op.value)
		) {
			return {
				index,
				reason: "brand logo URL must be a Wandit-hosted asset",
			};
		}

		if (
			op.kind === "section-style" &&
			op.value.backgroundImage !== undefined &&
			op.value.backgroundImage !== "none" &&
			!isWanditHostedUrl(op.value.backgroundImage)
		) {
			return {
				index,
				reason: "background image URL must be a Wandit-hosted asset",
			};
		}
	}
}

function formatAiOpFailure(
	ops: readonly EditOp[],
	index: number,
	reason: string,
): string {
	const failedOp = ops[index];
	const opDetails = failedOp
		? `${failedOp.kind}${
				"wid" in failedOp ? `, data-wid="${failedOp.wid}"` : ""
			}`
		: "unknown op";

	return `op ${index + 1} (${opDetails}): ${reason}`;
}

function collectFontStylesheetHrefs(html: string): string[] {
	const $ = cheerio.load(html);
	const hrefs = new Set<string>();

	$('head link[rel="stylesheet"][href]').each((_, node) => {
		const href = $(node).attr("href");

		if (!href) {
			return;
		}

		try {
			const url = new URL(href);

			if (
				url.username === "" &&
				url.password === "" &&
				(url.origin === "https://fonts.googleapis.com" ||
					url.origin === "https://api.fontshare.com")
			) {
				hrefs.add(url.href);
			}
		} catch {
			// Ignore malformed and relative links from stored page HTML.
		}
	});

	return [...hrefs];
}
