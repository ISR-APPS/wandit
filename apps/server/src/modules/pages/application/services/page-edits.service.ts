/**
 * The write side of page editing (V2 spec §5/§7/§14): every mutation — an
 * inline-editor/theme-panel ops batch over HTTP, or the chat agent's
 * replace_section — copies the ACTIVE version's HTML, applies the ops,
 * re-stamps, uploads a NEW immutable version to R2, and flips the artifact's
 * active pointer in one transaction. No in-place mutation, ever.
 */
import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type {
	ApplyPageOpsBody,
	ApplyPageOpsResponse,
	EditOp,
} from "@wandit/contracts";

import {
	getPageHtml,
	isWanditHostedUrl,
	pageHtmlKey,
	putPageHtml,
} from "../../../../infrastructure/storage/r2";
import { applyOps } from "../../domain/ops";
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

type MutationOutcome =
	| { ok: true; version: { createdAt: Date; id: string; number: number } }
	| { kind: "no-html"; ok: false }
	| { index: number; kind: "op-failed"; ok: false; reason: string }
	| { activeVersionId: string | null; kind: "conflict"; ok: false };

@Injectable()
export class PageEditsService {
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

		// image-src and section background URLs must be Wandit-hosted assets
		// (contract §6) — the ops module stays env-free, so the origin checks
		// live here. Parsed-origin comparison, never a raw prefix check
		// (prefix confusion).
		for (const [index, op] of body.ops.entries()) {
			if (op.kind === "image-src" && !isWanditHostedUrl(op.value)) {
				throw new UnprocessableEntityException({
					code: "OP_FAILED",
					index,
					reason: "image URL must be a Wandit-hosted asset",
				});
			}

			if (
				op.kind === "section-style" &&
				op.value.backgroundImage !== undefined &&
				op.value.backgroundImage !== "none" &&
				!isWanditHostedUrl(op.value.backgroundImage)
			) {
				throw new UnprocessableEntityException({
					code: "OP_FAILED",
					index,
					reason: "background image URL must be a Wandit-hosted asset",
				});
			}
		}

		const outcome = await this.mutate({
			artifactId: page.artifactId,
			ops: body.ops,
			projectId,
			source: body.source,
			version: page.version,
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
	): Promise<ApplyAiOpsResult> {
		const page =
			await this.pagesRepository.findActivePageByProjectUnchecked(projectId);

		if (!page?.version) {
			return {
				message: "No page has been generated yet.",
				status: "no-page",
			};
		}

		const outcome = await this.mutate({
			artifactId: page.artifactId,
			ops,
			projectId,
			source: "ai-edit",
			version: page.version,
		});

		if (!outcome.ok) {
			switch (outcome.kind) {
				case "no-html":
					return {
						message: "The page's HTML could not be loaded.",
						status: "no-page",
					};
				case "op-failed":
					return { message: outcome.reason, status: "rejected" };
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
		ops: readonly EditOp[];
		projectId: string;
		source: "ai-edit" | "inline" | "theme";
		version: { id: string; number: number; r2Key: string };
	}): Promise<MutationOutcome> {
		const html = await getPageHtml(input.version.r2Key);

		if (html === null) {
			return { kind: "no-html", ok: false };
		}

		// Legacy pre-V2 versions carry no wids: stamp-on-read so the wids the
		// outline showed (also stamped in memory) resolve — the stamper is
		// deterministic, so both sides agree. This edit then PERSISTS stamped
		// HTML for good.
		const baseHtml = html.includes("data-wid=") ? html : stampHtml(html);
		const result = applyOps(baseHtml, input.ops);

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
			const { createdAt, number } =
				await this.pagesRepository.insertVersionAndActivate({
					artifactId: input.artifactId,
					expectedActiveVersionId: input.version.id,
					meta: {
						editedWids: result.editedWids,
						// Value-free audit summary — never the payloads.
						ops: input.ops.map((op) => ({
							kind: op.kind,
							...("wid" in op ? { wid: op.wid } : {}),
						})),
						parentVersionId: input.version.id,
						source: input.source,
					},
					projectId: input.projectId,
					r2Key: key,
					versionId: newVersionId,
				});

			return {
				ok: true,
				version: { createdAt, id: newVersionId, number },
			};
		} catch (error) {
			if (error instanceof VersionConflictError) {
				return {
					activeVersionId: error.activeVersionId,
					kind: "conflict",
					ok: false,
				};
			}

			throw error;
		}
	}
}
