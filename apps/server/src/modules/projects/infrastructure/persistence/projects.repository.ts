// Database helper for projects.
//
// Repository means this file owns database queries. Services call these methods
// instead of writing SQL directly.
//
// Project creation also creates the first chat and first user message.
import { Inject, Injectable } from "@nestjs/common";
import type {
	ComposerMetadata,
	FileRef,
	UpdateProjectBody,
} from "@wandit/contracts";
// Drizzle is the TypeScript SQL builder/ORM used in this project.
import { and, asc, desc, eq, isNull, sql } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import {
	type ProjectScope,
	projectOwnerColumns,
	projectScopePredicate,
} from "../../domain/project-scope";

// Raw DB row shape before mapping to the API Project shape.
export type ProjectQueryRow = {
	activeSlug: string | null;
	createdAt: Date;
	hideWanditBadge: boolean;
	id: string;
	leadCount: number;
	logoUrl: string | null;
	metaPixelId: string | null;
	name: string;
	pendingDeploymentCount: number;
	previewImageUrl: string | null;
	prompt: string;
	tiktokPixelId: string | null;
	updatedAt: Date;
};

// Ids created when a new project starts from a prompt.
export type CreatedProjectChat = {
	chatId: string;
	messageId: string;
	projectId: string;
};

// `@Injectable()` lets Nest inject this repository into ProjectsService.
@Injectable()
export class ProjectsRepository {
	// DATABASE is a Symbol token, so `@Inject(DATABASE)` tells Nest what to pass.
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	// List the scope's non-deleted projects (personal or org workspace).
	listForScope(scope: ProjectScope): Promise<ProjectQueryRow[]> {
		return this.projectSelect()
			.where(and(projectScopePredicate(scope), isNull(projects.deletedAt)))
			.orderBy(desc(projects.updatedAt), desc(projects.createdAt));
	}

	// Find one non-deleted project accessible in this scope.
	async findByIdForScope(
		scope: ProjectScope,
		projectId: string,
	): Promise<ProjectQueryRow | null> {
		// Drizzle returns an array even with limit(1).
		const [row] = await this.projectSelect()
			.where(
				and(
					projectScopePredicate(scope),
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	// Create project + chat + first user message together.
	async createWithChatAndFirstMessage(input: {
		attachments?: FileRef[];
		chatId: string;
		composer?: ComposerMetadata;
		messageId: string;
		name: string;
		prompt: string;
		projectId: string;
		scope: ProjectScope;
	}): Promise<CreatedProjectChat> {
		// Transaction means all writes succeed together or all roll back.
		return this.db.transaction(async (tx) => {
			// Insert project first because chat needs project.id.
			const [project] = await tx
				.insert(projects)
				.values({
					id: input.projectId,
					name: input.name,
					// Org projects record the creator in userId (provenance) and the
					// workspace in organizationId (authorization).
					...projectOwnerColumns(input.scope),
				})
				.returning({ id: projects.id });

			// Defensive check: INSERT ... RETURNING should return one row.
			if (!project) {
				throw new Error("Project write did not return a row");
			}

			// Create the first chat for the project.
			const [chat] = await tx
				.insert(chats)
				.values({ id: input.chatId, projectId: project.id })
				.returning({ id: chats.id });

			// Defensive check: cannot continue without chat id.
			if (!chat) {
				throw new Error("Chat write did not return a row");
			}

			// Store the first user prompt as the first chat message.
			const [message] = await tx
				.insert(messages)
				.values({
					chatId: chat.id,
					id: input.messageId,
					metadata: input.composer ?? null,
					// Messages use AI SDK "parts". Uploaded attachments become file
					// parts placed BEFORE the text part (contract §10.4), so the
					// hydrate + autostart flow carries them to the agent unchanged.
					// Attachment-only creations skip the text part entirely — an
					// empty text block would be rejected by some providers.
					parts: [
						...(input.attachments ?? []).map((attachment) => ({
							...(attachment.filename ? { filename: attachment.filename } : {}),
							mediaType: attachment.mediaType,
							type: "file",
							url: attachment.url,
						})),
						...(input.prompt.trim().length > 0
							? [
									{
										state: "done",
										text: input.prompt,
										type: "text",
									},
								]
							: []),
					],
					role: "user",
				})
				.returning({ id: messages.id });

			// The queue job needs the message id.
			if (!message) {
				throw new Error("Message write did not return a row");
			}

			// Service uses these ids for the API response and the queue job.
			return {
				chatId: chat.id,
				messageId: message.id,
				projectId: project.id,
			};
		});
	}

	// Update editable fields, then re-read the full project row.
	async updateByIdForScope(
		scope: ProjectScope,
		projectId: string,
		body: UpdateProjectBody,
		options: { expectedName?: string } = {},
	): Promise<ProjectQueryRow | null> {
		// Only update fields that were actually sent in the PATCH body.
		const [row] = await this.db
			.update(projects)
			.set({
				...(body.name !== undefined ? { name: body.name } : {}),
				// null clears the value; undefined means "do not change it".
				...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
				...(body.metaPixelId !== undefined
					? { metaPixelId: body.metaPixelId }
					: {}),
				...(body.tiktokPixelId !== undefined
					? { tiktokPixelId: body.tiktokPixelId }
					: {}),
				...(body.hideWanditBadge !== undefined
					? { hideWanditBadge: body.hideWanditBadge }
					: {}),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
					options.expectedName === undefined
						? undefined
						: eq(projects.name, options.expectedName),
				),
			)
			.returning({ id: projects.id });

		// No row means missing, deleted, or outside this scope.
		if (!row) {
			return null;
		}

		// Return the same full shape used by get/list.
		return this.findByIdForScope(scope, row.id);
	}

	// Soft-delete: mark deletedAt instead of deleting the row.
	async softDeleteByIdForScope(
		scope: ProjectScope,
		projectId: string,
	): Promise<boolean> {
		// Use the same timestamp for deletedAt and updatedAt.
		const now = new Date();
		const [row] = await this.db
			.update(projects)
			.set({
				deletedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(projects.id, projectId),
					projectScopePredicate(scope),
					isNull(projects.deletedAt),
				),
			)
			.returning({ id: projects.id });

		// Returned row means a live in-scope project was updated.
		return row !== undefined;
	}

	// Shared SELECT builder used by list/get/update.
	private projectSelect() {
		// Get the first user message text for each project.
		const firstMessages = this.db
			.selectDistinctOn([chats.projectId], {
				projectId: chats.projectId,
				// Read the first TEXT part from the JSONB parts column — attachment
				// file parts sit BEFORE the text part (contract §10.4), so a plain
				// parts[0] lookup would show an empty prompt for those projects.
				prompt: sql<string>`coalesce((
					select part->>'text'
					from jsonb_array_elements(${messages.parts}) as part
					where part->>'type' = 'text'
					limit 1
				), '')`.as("prompt"),
			})
			.from(chats)
			.innerJoin(messages, eq(messages.chatId, chats.id))
			.where(eq(messages.role, "user"))
			.orderBy(chats.projectId, asc(messages.seq))
			.as("first_messages");
		// Count leads per project.
		const leadCounts = this.db
			.select({
				leadCount: sql<number>`count(${leads.id})::int`.as("lead_count"),
				projectId: leads.projectId,
			})
			.from(leads)
			.groupBy(leads.projectId)
			.as("lead_counts");
		// Summarize deployment state for the dashboard.
		const deploymentAgg = this.db
			.select({
				// There should be at most one active deployment.
				activeSlug: sql<
					string | null
				>`max(${deployments.slug}) filter (where ${deployments.status} = 'active')`.as(
					"active_slug",
				),
				// Count only pending deployments.
				pendingDeploymentCount:
					sql<number>`count(*) filter (where ${deployments.status} = 'pending')::int`.as(
						"pending_deployment_count",
					),
				projectId: deployments.projectId,
			})
			.from(deployments)
			.groupBy(deployments.projectId)
			.as("deployment_agg");

		// Final row: project + optional joined/aggregated data.
		return this.db
			.select({
				activeSlug: deploymentAgg.activeSlug,
				createdAt: projects.createdAt,
				hideWanditBadge: projects.hideWanditBadge,
				id: projects.id,
				// coalesce turns missing joins into friendly default values.
				leadCount: sql<number>`coalesce(${leadCounts.leadCount}, 0)::int`,
				logoUrl: projects.logoUrl,
				metaPixelId: projects.metaPixelId,
				name: projects.name,
				pendingDeploymentCount: sql<number>`coalesce(${deploymentAgg.pendingDeploymentCount}, 0)::int`,
				previewImageUrl: projects.previewImageUrl,
				prompt: sql<string>`coalesce(${firstMessages.prompt}, '')`,
				tiktokPixelId: projects.tiktokPixelId,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(firstMessages, eq(firstMessages.projectId, projects.id))
			.leftJoin(leadCounts, eq(leadCounts.projectId, projects.id))
			.leftJoin(deploymentAgg, eq(deploymentAgg.projectId, projects.id));
	}
}
