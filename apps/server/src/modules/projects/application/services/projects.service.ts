// Service for project actions.
//
// Important chat flow:
// - Creating a project only creates its first chat and saves the first user prompt.
// - The first AI reply happens later through POST /chats/:chatId/ai-stream.
// - Background jobs will use Trigger.dev when that flow is introduced.
//
// This is the "business flow" file. The controller receives HTTP, this service
// decides the steps, and the repository writes to the database.
import { randomUUID } from "node:crypto";

import {
	BadRequestException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type {
	CreateProjectBody,
	CreateProjectResponse,
	ListProjectsPageResponse,
	ListProjectsQuery,
	ListProjectsResponse,
	Project,
	UpdateProjectBody,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import {
	estimateAiChatTokenUsage,
	projectCreationMeteringKey,
	projectCreationReservationAttemptRef,
} from "../../../ai-chat/agent/chat-metering";
import { LifecycleEventsService } from "../../../lifecycle-events/application/services/lifecycle-events.service";
import { lifecycleEventIdempotencyKey } from "../../../lifecycle-events/domain/lifecycle-event";
import { MeteringService } from "../../../metering/application/services/metering.service";
import { ModelPricingService } from "../../../metering/application/services/model-pricing.service";
import { ModelPriceUnavailableError } from "../../../metering/domain/model-pricing";
import { operationPricing } from "../../../metering/domain/operation-registry";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../domain/project-scope";
import { mapProjectRow } from "../../infrastructure/mappers/project.mapper";
import { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";
import { ProjectTitleService } from "./project-title.service";

// `@Injectable()` lets Nest create this class and inject it into controllers.
@Injectable()
export class ProjectsService {
	private readonly logger = new Logger(ProjectsService.name);

	constructor(
		// `@Inject(...)` means "Nest, give me this dependency."
		@Inject(ProjectsRepository)
		private readonly projectsRepository: ProjectsRepository,
		@Inject(MeteringService)
		private readonly meteringService: MeteringService,
		@Inject(ModelPricingService)
		private readonly modelPricingService: ModelPricingService,
		@Inject(ProjectTitleService)
		private readonly projectTitleService: ProjectTitleService,
		@Inject(LifecycleEventsService)
		private readonly lifecycleEvents: LifecycleEventsService,
	) {}

	// List the workspace's projects for the dashboard.
	async list(scope: ProjectScope): Promise<ListProjectsResponse> {
		// Map DB rows into API response objects.
		const rows = await this.projectsRepository.listForScope(scope);

		return rows.map(mapProjectRow);
	}

	// Paginated listing behind the native drawer's infinite scroll + search.
	async listPaged(
		scope: ProjectScope,
		query: ListProjectsQuery,
	): Promise<ListProjectsPageResponse> {
		const page = await this.projectsRepository.listPageForScope(scope, query);

		return {
			items: page.items.map(mapProjectRow),
			page: page.page,
			pageSize: page.pageSize,
			total: page.total,
		};
	}

	// Load one project if it is accessible in this workspace scope.
	async get(scope: ProjectScope, projectId: string): Promise<Project> {
		const row = await this.projectsRepository.findByIdForScope(
			scope,
			projectId,
		);

		// Nest turns this exception into HTTP 404.
		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	// Create the project, its first chat, and the first user message.
	async create(
		scope: ProjectScope,
		body: CreateProjectBody,
	): Promise<CreateProjectResponse> {
		// Attachment URLs must be Wandit-hosted assets (contract §10.4) — the
		// composer uploads through /api/v1/attachments first, so anything else
		// is a forged reference. Uploads are actor-owned even in org scope.
		this.assertWanditHostedAttachments(scope.userId, body.attachments);

		const derivedName = deriveProjectName(body.prompt);
		const projectId = randomUUID();
		const chatId = randomUUID();
		const messageId = randomUUID();
		const usageEvent =
			env.GENERATION_BILLING_MODE === "off"
				? null
				: await this.reserveCreation({
						body,
						chatId,
						messageId,
						projectId,
						scope,
					});

		// Create project + chat + first message in one DB transaction.
		let created: Awaited<
			ReturnType<ProjectsRepository["createWithChatAndFirstMessage"]>
		>;

		try {
			created = await this.projectsRepository.createWithChatAndFirstMessage({
				attachments: body.attachments,
				chatId,
				composer: body.composer,
				messageId,
				name: derivedName,
				prompt: body.prompt,
				projectId,
				scope,
			});
		} catch (error) {
			try {
				if (usageEvent) {
					await this.meteringService.refund(
						usageEvent.id,
						"project_creation_failed",
					);
				}
			} catch (refundError) {
				const message =
					refundError instanceof Error
						? refundError.message
						: String(refundError);
				this.logger.error(
					`Project creation reservation refund failed for ${usageEvent?.id ?? "unknown"}: ${message}`,
				);
			}

			throw error;
		}

		try {
			await this.lifecycleEvents.enqueue({
				event: "first_prompt_sent",
				idempotencyKey: lifecycleEventIdempotencyKey(
					"first_prompt_sent",
					scope.userId,
				),
				userId: scope.userId,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.error(
				`First prompt lifecycle enqueue failed for user ${scope.userId}: ${message}`,
			);
		}

		// The transaction has committed. Title generation is best-effort and must
		// never add latency or failure to the create response.
		void this.generateAndPersistTitle({
			attachments: body.attachments,
			derivedName,
			projectId: created.projectId,
			prompt: body.prompt,
			scope,
			usageEventId: usageEvent?.id,
		}).catch((error) => {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.warn(`Background project title update failed: ${message}`);
		});

		// The frontend can now open the workspace and start AI streaming separately.
		return {
			chatId: created.chatId,
			projectId: created.projectId,
		};
	}

	private async reserveCreation(input: {
		body: CreateProjectBody;
		chatId: string;
		messageId: string;
		projectId: string;
		scope: ProjectScope;
	}) {
		const estimate = await this.estimateCreationCredits(
			input.body,
			input.messageId,
		);

		return this.meteringService.reserve(
			"chat",
			meteringSubjectFrom(input.scope),
			{
				attemptRef: projectCreationReservationAttemptRef(input.projectId),
				chatId: input.chatId,
				credits: estimate.credits,
				estimatedCostUsdMicros: estimate.costUsdMicros,
				idempotencyKey: projectCreationMeteringKey(input.projectId),
				messageId: input.messageId,
				model: env.AI_CHAT_MODEL,
			},
		);
	}

	private async estimateCreationCredits(
		body: CreateProjectBody,
		messageId: string,
	): Promise<{ costUsdMicros: number | null; credits: number }> {
		const modelBoundMessage = {
			id: messageId,
			parts: [
				...(body.attachments ?? []).map((attachment) => ({
					...(attachment.filename ? { filename: attachment.filename } : {}),
					mediaType: attachment.mediaType,
					type: "file",
					url: attachment.url,
				})),
				...(body.prompt.trim().length > 0
					? [{ state: "done", text: body.prompt, type: "text" }]
					: []),
			],
			role: "user",
		};

		try {
			const quote = await this.modelPricingService.quoteTokenUsage(
				env.AI_CHAT_MODEL,
				estimateAiChatTokenUsage([modelBoundMessage]),
			);

			return {
				costUsdMicros: quote.costUsdMicros,
				credits: Math.max(
					operationPricing("chat").reserveFloorCredits,
					quote.credits,
				),
			};
		} catch (error) {
			if (!(error instanceof ModelPriceUnavailableError)) {
				throw error;
			}

			this.logger.warn(
				`Chat pricing unavailable for project creation (${env.AI_CHAT_MODEL}); reserving the registry floor`,
			);

			return {
				costUsdMicros: null,
				credits: operationPricing("chat").reserveFloorCredits,
			};
		}
	}

	private async generateAndPersistTitle(input: {
		attachments: CreateProjectBody["attachments"];
		derivedName: string;
		projectId: string;
		prompt: string;
		scope: ProjectScope;
		usageEventId?: string;
	}): Promise<void> {
		const generatedTitle = await this.projectTitleService.generate({
			attachments: input.attachments,
			fallbackTitle: input.derivedName,
			organizationId:
				input.scope.kind === "org" ? input.scope.organizationId : null,
			prompt: input.prompt,
			usageEventId: input.usageEventId,
			userId: input.scope.userId,
		});

		if (generatedTitle === input.derivedName) {
			return;
		}

		// expectedName makes this a single atomic guard: a manual rename that lands
		// first wins, and the background title update becomes a no-op.
		await this.projectsRepository.updateByIdForScope(
			input.scope,
			input.projectId,
			{ name: generatedTitle },
			{ expectedName: input.derivedName },
		);
	}

	// Update editable project fields.
	async update(
		scope: ProjectScope,
		projectId: string,
		body: UpdateProjectBody,
	): Promise<Project> {
		if (body.logoUrl !== undefined && body.logoUrl !== null) {
			// Logo uploads are actor-owned even in org scope.
			this.assertValidLogoUrl(scope.userId, body.logoUrl);
		}

		const row = await this.projectsRepository.updateByIdForScope(
			scope,
			projectId,
			body,
		);

		// Missing or not owned both become 404.
		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	private assertValidLogoUrl(userId: string, logoUrl: string): void {
		let pathname = "";

		try {
			pathname = new URL(logoUrl).pathname;
		} catch {
			// The shared HTTP schema catches malformed URLs. Keep the service guard
			// defensive for direct callers and unit-level use.
		}

		if (
			!isUserUploadUrl(logoUrl, userId) ||
			!/[.](?:jpe?g|png|webp|gif|avif)$/i.test(pathname)
		) {
			throw new BadRequestException({
				code: "INVALID_LOGO_URL",
				message:
					"Project logo must be a Wandit-uploaded JPEG, PNG, WebP, GIF, or AVIF image",
			});
		}
	}

	// Reject any attachment reference that is not one of our own R2 objects.
	// Parsed origin + path boundary, never a raw prefix check.
	private assertWanditHostedAttachments(
		userId: string,
		attachments: CreateProjectBody["attachments"],
	): void {
		for (const attachment of attachments ?? []) {
			if (!isUserUploadUrl(attachment.url, userId)) {
				throw new BadRequestException({
					code: "INVALID_FILE_PART",
					message: "Attachments must be uploaded through Wandit",
				});
			}
		}
	}

	// Soft-delete: mark as deleted, do not physically remove the row.
	async delete(scope: ProjectScope, projectId: string): Promise<void> {
		const deleted = await this.projectsRepository.softDeleteByIdForScope(
			scope,
			projectId,
		);

		// Controller returns 204 when this succeeds.
		if (!deleted) {
			throw new NotFoundException();
		}
	}
}

// Build the first project name from the user's prompt.
export function deriveProjectName(prompt: string): string {
	// Replace newlines/tabs/multiple spaces with one space.
	const normalized = prompt.replace(/\s+/g, " ").trim();

	if (!normalized) {
		return "Untitled project";
	}

	// Short prompts can be used directly.
	if (normalized.length <= 40) {
		return normalized;
	}

	// Prefer to stop at a word boundary.
	const words = normalized.split(" ");
	let name = "";

	for (const word of words) {
		const next = name ? `${name} ${word}` : word;

		if (next.length > 40) {
			break;
		}

		name = next;
	}

	// If the first word is too long, hard cut it.
	return name || normalized.slice(0, 40).trim();
}
