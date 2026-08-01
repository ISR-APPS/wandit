// Service for project actions.
//
// Important chat flow:
// - Creating a project only creates its first chat and saves the first user prompt.
// - The first AI reply happens later through POST /chats/:chatId/ai-stream.
// - Background jobs will use Trigger.dev when that flow is introduced.
//
// This is the "business flow" file. The controller receives HTTP, this service
// decides the steps, and the repository writes to the database.
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
	ListProjectsResponse,
	Project,
	UpdateProjectBody,
} from "@wandit/contracts";

import { isUserUploadUrl } from "../../../../infrastructure/storage/r2";
import { GenerationPolicyService } from "../../../generation/application/services/generation-policy.service";
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
		@Inject(GenerationPolicyService)
		private readonly generationPolicyService: GenerationPolicyService,
		@Inject(ProjectTitleService)
		private readonly projectTitleService: ProjectTitleService,
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

	// Create the project, its first chat, and the first user message.
	async create(
		userId: string,
		body: CreateProjectBody,
	): Promise<CreateProjectResponse> {
		// Check credits/subscription before writing anything.
		await this.generationPolicyService.assertCanGenerate(
			userId,
			body.composer?.mode === "video"
				? "videoGeneration"
				: "landingPageGeneration",
		);

		// Attachment URLs must be Wandit-hosted assets (contract §10.4) — the
		// composer uploads through /api/v1/attachments first, so anything else
		// is a forged reference.
		this.assertWanditHostedAttachments(userId, body.attachments);

		const derivedName = deriveProjectName(body.prompt);

		// Create project + chat + first message in one DB transaction.
		const created = await this.projectsRepository.createWithChatAndFirstMessage(
			{
				attachments: body.attachments,
				composer: body.composer,
				name: derivedName,
				prompt: body.prompt,
				userId,
			},
		);

		// The transaction has committed. Title generation is best-effort and must
		// never add latency or failure to the create response.
		void this.generateAndPersistTitle({
			attachments: body.attachments,
			derivedName,
			projectId: created.projectId,
			prompt: body.prompt,
			userId,
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

	private async generateAndPersistTitle(input: {
		attachments: CreateProjectBody["attachments"];
		derivedName: string;
		projectId: string;
		prompt: string;
		userId: string;
	}): Promise<void> {
		const generatedTitle = await this.projectTitleService.generate({
			attachments: input.attachments,
			fallbackTitle: input.derivedName,
			prompt: input.prompt,
		});

		if (generatedTitle === input.derivedName) {
			return;
		}

		// expectedName makes this a single atomic guard: a manual rename that lands
		// first wins, and the background title update becomes a no-op.
		await this.projectsRepository.updateByIdForUser(
			input.userId,
			input.projectId,
			{ name: generatedTitle },
			{ expectedName: input.derivedName },
		);
	}

	// Update editable project fields.
	async update(
		userId: string,
		projectId: string,
		body: UpdateProjectBody,
	): Promise<Project> {
		if (body.logoUrl !== undefined && body.logoUrl !== null) {
			this.assertValidLogoUrl(userId, body.logoUrl);
		}

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
