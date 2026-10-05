// Database helper for projects.
//
// Repository means this file owns database queries. Services call these methods
// instead of writing SQL directly.
//
// Project creation also creates the first chat and first user message.
import { Inject, Injectable } from "@nestjs/common";
import type {
	AppLanguage,
	ComposerMetadata,
	FileRef,
	ListProjectsQuery,
	PaginatedResult,
	ProjectEngine,
	TargetPlatform,
	UpdateProjectBody,
} from "@wandit/contracts";
// Drizzle is the TypeScript SQL builder/ORM used in this project.
import { and, asc, desc, eq, ilike, isNull, or, sql } from "@wandit/db";
import { builderSessions } from "@wandit/db/schema/builder-sessions";
import { chats, messages } from "@wandit/db/schema/chats";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";
import type { HarnessKind } from "../../../app-builder/domain/ports/builder-harness";
import {
	type ProjectScope,
	projectOwnerColumns,
	projectScopePredicate,
} from "../../domain/project-scope";

// Raw DB row shape before mapping to the API Project shape.
export type ProjectQueryRow = {
	activeSlug: string | null;
	createdAt: Date;
	// "v1_page" or "v2_app" (D11); the row carries it, never a derivation.
	engine: ProjectEngine;
	// App template stack id, for example "web-app"; null on V1 rows.
	framework: string | null;
	hideWanditBadge: boolean;
	id: string;
	// Languages the app builds in (D7); empty array on V1 rows.
	languages: string[];
	leadCount: number;
	logoUrl: string | null;
	metaPixelId: string | null;
	name: string;
	pendingDeploymentCount: number;
	previewImageUrl: string | null;
	prompt: string;
	// "web" or "mobile" on V2 rows; null on V1 rows.
	targetPlatform: TargetPlatform | null;
	// Template version the app was created from; null on V1 rows.
	templateVersion: string | null;
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

	// Paginated variant used by the native drawer's infinite list + search.
	async listPageForScope(
		scope: ProjectScope,
		query: ListProjectsQuery,
	): Promise<PaginatedResult<ProjectQueryRow>> {
		const firstMessages = this.firstMessagesSelect();
		const searchFilter = query.search
			? or(
					ilike(projects.name, `%${escapeLikePattern(query.search)}%`),
					ilike(firstMessages.prompt, `%${escapeLikePattern(query.search)}%`),
				)
			: undefined;
		const where = and(
			projectScopePredicate(scope),
			isNull(projects.deletedAt),
			searchFilter,
		);
		const offset = (query.page - 1) * query.pageSize;
		const [totalRow] = await this.db
			.select({ total: sql<number>`count(*)::int` })
			.from(projects)
			.leftJoin(firstMessages, eq(firstMessages.projectId, projects.id))
			.where(where);
		const items = await this.projectSelect(firstMessages)
			.where(where)
			.orderBy(
				desc(projects.updatedAt),
				desc(projects.createdAt),
				desc(projects.id),
			)
			.limit(query.pageSize)
			.offset(offset);

		return {
			items,
			page: query.page,
			pageSize: query.pageSize,
			total: totalRow?.total ?? 0,
		};
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

	/**
	 * Engine of one non-deleted project visible in this scope, or null.
	 * The V2 turn API uses it for the `v2_app` gate without loading the
	 * full `ProjectQueryRow` join shape.
	 */
	async findEngineByIdForScope(
		scope: ProjectScope,
		projectId: string,
	): Promise<"v1_page" | "v2_app" | null> {
		const [row] = await this.db
			.select({ engine: projects.engine })
			.from(projects)
			.where(
				and(
					projectScopePredicate(scope),
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row?.engine ?? null;
	}

	// Create project + chat + first user message together.
	async createWithChatAndFirstMessage(input: {
		// V2-only block (WANDIT-175): its presence makes the row `v2_app` and
		// writes the builder session. Absent keeps the V1 shape untouched.
		app?: {
			/** Coding agent that runs the turns (D17), from `V2_HARNESS`. */
			harness: HarnessKind;
			/** Languages the app builds in (D7): one to three of ar, fr, en. */
			languages: AppLanguage[];
			/** Default builder model id; null until WANDIT-151 picks one. */
			model: string | null;
			/** Device family the app targets, from the create body. */
			targetPlatform: TargetPlatform;
			/** Template archive prefix from `TEMPLATE_PROFILES`: "web-app" or "mobile-app". */
			framework: string;
			/** First line of `templates/<framework>/template_version`, for example "mobile-app@1.0.0". */
			templateVersion: string;
		};
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
					// The `app` block marks the row `v2_app`; without it the column
					// defaults keep the V1 shape.
					...(input.app
						? {
								engine: "v2_app" as const,
								framework: input.app.framework,
								languages: [...input.app.languages],
								targetPlatform: input.app.targetPlatform,
								templateVersion: input.app.templateVersion,
							}
						: {}),
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

			if (input.app) {
				// The session row exists before the first turn, so
				// TurnsService.ensureSession finds it by chatId.
				await tx.insert(builderSessions).values({
					chatId: chat.id,
					harness: input.app.harness,
					model: input.app.model,
					organizationId:
						input.scope.kind === "org" ? input.scope.organizationId : null,
					projectId: project.id,
					providerSessionId: null,
					templateVersion: input.app.templateVersion,
					userId: input.scope.userId,
				});
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

	// Soft-delete: mark deletedAt instead of deleting the row. Answers the
	// deleted row's engine so the caller can pick the right cleanup path.
	async softDeleteByIdForScope(
		scope: ProjectScope,
		projectId: string,
	): Promise<{ engine: ProjectEngine } | null> {
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
			.returning({ engine: projects.engine });

		// Returned row means a live in-scope project was updated.
		return row ?? null;
	}

	// Shared SELECT builder used by list/get/update.
	private firstMessagesSelect() {
		// Get the first user message text for each project.
		return this.db
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
	}

	private projectSelect(firstMessages = this.firstMessagesSelect()) {
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
				engine: projects.engine,
				framework: projects.framework,
				hideWanditBadge: projects.hideWanditBadge,
				id: projects.id,
				languages: projects.languages,
				// coalesce turns missing joins into friendly default values.
				leadCount: sql<number>`coalesce(${leadCounts.leadCount}, 0)::int`,
				logoUrl: projects.logoUrl,
				metaPixelId: projects.metaPixelId,
				name: projects.name,
				pendingDeploymentCount: sql<number>`coalesce(${deploymentAgg.pendingDeploymentCount}, 0)::int`,
				previewImageUrl: projects.previewImageUrl,
				prompt: sql<string>`coalesce(${firstMessages.prompt}, '')`,
				targetPlatform: projects.targetPlatform,
				templateVersion: projects.templateVersion,
				tiktokPixelId: projects.tiktokPixelId,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(firstMessages, eq(firstMessages.projectId, projects.id))
			.leftJoin(leadCounts, eq(leadCounts.projectId, projects.id))
			.leftJoin(deploymentAgg, eq(deploymentAgg.projectId, projects.id));
	}
}

function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
