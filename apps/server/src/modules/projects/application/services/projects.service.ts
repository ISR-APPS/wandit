// Service for project actions.
//
// Important chat flow:
// - Creating a project also creates its first chat.
// - It saves the first user prompt as a message.
// - It then starts the first AI generation by putting a job in BullMQ.
//
// This is the "business flow" file. The controller receives HTTP, this service
// decides the steps, and the repository writes to the database.
import { randomUUID } from "node:crypto";
import {
	type HttpException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
import type {
	CreateProjectBody,
	CreateProjectResponse,
	ListProjectsResponse,
	Project,
	UpdateProjectBody,
} from "@wandit/contracts";

import { GenerationActivityService } from "../../../generation/application/services/generation-activity.service";
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
import { GenerationQueueService } from "../../../generation/application/services/generation-queue.service";
import { GenerationActiveError } from "../../../generation/domain/errors/generation-active.error";
import { mapProjectRow } from "../../infrastructure/mappers/project.mapper";
import { ProjectsRepository } from "../../infrastructure/persistence/projects.repository";

// `@Injectable()` lets Nest create this class and inject it into controllers.
@Injectable()
export class ProjectsService {
	// Logger writes logs with this class name.
	private readonly logger = new Logger(ProjectsService.name);

	constructor(
		// `@Inject(...)` means "Nest, give me this dependency."
		@Inject(ProjectsRepository)
		private readonly projectsRepository: ProjectsRepository,
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		@Inject(GenerationQueueService)
		private readonly generationQueueService: GenerationQueueService,
		@Inject(GenerationActivityService)
		private readonly generationActivityService: GenerationActivityService,
	) {}

	// List projects for the dashboard.
	async list(userId: string): Promise<ListProjectsResponse> {
		// Map DB rows into API response objects.
		const rows = await this.projectsRepository.listByUser(userId);

		return rows.map(mapProjectRow);
	}

	// Load one project if it belongs to this user.
	async get(userId: string, projectId: string): Promise<Project> {
		const row = await this.projectsRepository.findByIdForUser(
			userId,
			projectId,
		);

		// Nest turns this exception into HTTP 404.
		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	// Create project, first chat, first user message, and queue first generation.
	async create(
		userId: string,
		body: CreateProjectBody,
	): Promise<CreateProjectResponse> {
		// Check credits/subscription before writing anything.
		await this.generationPolicyService.assertCanGenerate(
			userId,
			"landingPageGeneration",
		);

		// One job id connects Redis, BullMQ, logs, and the assistant message.
		const jobId = randomUUID();
		// Create project + chat + first message in one DB transaction.
		const created = await this.projectsRepository.createWithChatAndFirstMessage(
			{
				composer: body.composer,
				name: deriveProjectName(body.prompt),
				prompt: body.prompt,
				userId,
			},
		);
		// Mark the chat as busy before adding the queue job.
		const reserved = await this.generationActivityService.reserveActive(
			created.chatId,
			jobId,
		);

		// At this point the DB rows already exist. We do not delete them here.
		if (!reserved) {
			throw new GenerationActiveError();
		}

		try {
			// Add the first generation job for the worker.
			await this.generationQueueService.enqueueGenerateCopy({
				action: "landingPageGeneration",
				chatId: created.chatId,
				composer: body.composer,
				jobId,
				messageId: created.messageId,
				projectId: created.projectId,
				prompt: body.prompt,
				userId,
			});
		} catch (error) {
			// Keep the created workspace, but clear the Redis busy flag.
			await this.releaseReservation(created.chatId, jobId);
			throw this.queueUnavailable(error);
		}

		// The frontend navigates immediately. The assistant answer streams later.
		return {
			chatId: created.chatId,
			projectId: created.projectId,
		};
	}

	// Update editable project fields.
	async update(
		userId: string,
		projectId: string,
		body: UpdateProjectBody,
	): Promise<Project> {
		const row = await this.projectsRepository.updateByIdForUser(
			userId,
			projectId,
			body,
		);

		// Missing or not owned both become 404.
		if (!row) {
			throw new NotFoundException();
		}

		return mapProjectRow(row);
	}

	// Soft-delete: mark as deleted, do not physically remove the row.
	async delete(userId: string, projectId: string): Promise<void> {
		const deleted = await this.projectsRepository.softDeleteByIdForUser(
			userId,
			projectId,
		);

		// Controller returns 204 when this succeeds.
		if (!deleted) {
			throw new NotFoundException();
		}
	}

	// Try to clear Redis busy flag after queueing fails.
	private async releaseReservation(
		chatId: string,
		jobId: string,
	): Promise<void> {
		try {
			await this.generationActivityService.releaseActive(chatId, jobId);
		} catch (error) {
			this.logger.error(
				`Failed to release project generation reservation ${jobId}`,
				error instanceof Error ? error.stack : String(error),
			);
		}
	}

	// Convert queue failures into HTTP 503.
	private queueUnavailable(error: unknown): HttpException {
		if (error instanceof ServiceUnavailableException) {
			return error;
		}

		return new ServiceUnavailableException({
			code: "GENERATION_QUEUE_UNAVAILABLE",
			message: "Generation queue could not be reached",
		});
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
