import { Inject, Injectable } from "@nestjs/common";
import type { ComposerMetadata, UpdateProjectBody } from "@wandit/contracts";
import { and, asc, desc, eq, isNull, sql } from "@wandit/db";
import { chats, messages } from "@wandit/db/schema/chats";
import { deployments } from "@wandit/db/schema/deployments";
import { leads } from "@wandit/db/schema/leads";
import { projects } from "@wandit/db/schema/projects";

import {
	DATABASE,
	type Database,
} from "../../../../infrastructure/database/database.constants";

export type ProjectQueryRow = {
	activeSlug: string | null;
	createdAt: Date;
	id: string;
	leadCount: number;
	name: string;
	pendingDeploymentCount: number;
	prompt: string;
	updatedAt: Date;
};

export type CreatedProjectChat = {
	chatId: string;
	messageId: string;
	projectId: string;
};

@Injectable()
export class ProjectsRepository {
	constructor(@Inject(DATABASE) private readonly db: Database) {}

	listByUser(userId: string): Promise<ProjectQueryRow[]> {
		return this.projectSelect()
			.where(and(eq(projects.userId, userId), isNull(projects.deletedAt)))
			.orderBy(desc(projects.updatedAt), desc(projects.createdAt));
	}

	async findByIdForUser(
		userId: string,
		projectId: string,
	): Promise<ProjectQueryRow | null> {
		const [row] = await this.projectSelect()
			.where(
				and(
					eq(projects.userId, userId),
					eq(projects.id, projectId),
					isNull(projects.deletedAt),
				),
			)
			.limit(1);

		return row ?? null;
	}

	async createWithChatAndFirstMessage(input: {
		composer?: ComposerMetadata;
		name: string;
		prompt: string;
		userId: string;
	}): Promise<CreatedProjectChat> {
		return this.db.transaction(async (tx) => {
			const [project] = await tx
				.insert(projects)
				.values({
					name: input.name,
					userId: input.userId,
				})
				.returning({ id: projects.id });

			if (!project) {
				throw new Error("Project write did not return a row");
			}

			const [chat] = await tx
				.insert(chats)
				.values({ projectId: project.id })
				.returning({ id: chats.id });

			if (!chat) {
				throw new Error("Chat write did not return a row");
			}

			const [message] = await tx
				.insert(messages)
				.values({
					chatId: chat.id,
					metadata: input.composer ?? null,
					parts: [
						{
							state: "done",
							text: input.prompt,
							type: "text",
						},
					],
					role: "user",
				})
				.returning({ id: messages.id });

			if (!message) {
				throw new Error("Message write did not return a row");
			}

			return {
				chatId: chat.id,
				messageId: message.id,
				projectId: project.id,
			};
		});
	}

	async updateByIdForUser(
		userId: string,
		projectId: string,
		body: UpdateProjectBody,
	): Promise<ProjectQueryRow | null> {
		const [row] = await this.db
			.update(projects)
			.set({
				...(body.name !== undefined ? { name: body.name } : {}),
				...(body.metaPixelId !== undefined
					? { metaPixelId: body.metaPixelId }
					: {}),
				...(body.tiktokPixelId !== undefined
					? { tiktokPixelId: body.tiktokPixelId }
					: {}),
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(projects.id, projectId),
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.returning({ id: projects.id });

		if (!row) {
			return null;
		}

		return this.findByIdForUser(userId, row.id);
	}

	async softDeleteByIdForUser(
		userId: string,
		projectId: string,
	): Promise<boolean> {
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
					eq(projects.userId, userId),
					isNull(projects.deletedAt),
				),
			)
			.returning({ id: projects.id });

		return row !== undefined;
	}

	private projectSelect() {
		const firstMessages = this.db
			.selectDistinctOn([chats.projectId], {
				projectId: chats.projectId,
				prompt: sql<string>`coalesce(${messages.parts}->0->>'text', '')`.as(
					"prompt",
				),
			})
			.from(chats)
			.innerJoin(messages, eq(messages.chatId, chats.id))
			.where(eq(messages.role, "user"))
			.orderBy(chats.projectId, asc(messages.seq))
			.as("first_messages");
		const leadCounts = this.db
			.select({
				leadCount: sql<number>`count(${leads.id})::int`.as("lead_count"),
				projectId: leads.projectId,
			})
			.from(leads)
			.groupBy(leads.projectId)
			.as("lead_counts");
		const deploymentAgg = this.db
			.select({
				activeSlug: sql<
					string | null
				>`max(${deployments.slug}) filter (where ${deployments.status} = 'active')`.as(
					"active_slug",
				),
				pendingDeploymentCount:
					sql<number>`count(*) filter (where ${deployments.status} = 'pending')::int`.as(
						"pending_deployment_count",
					),
				projectId: deployments.projectId,
			})
			.from(deployments)
			.groupBy(deployments.projectId)
			.as("deployment_agg");

		return this.db
			.select({
				activeSlug: deploymentAgg.activeSlug,
				createdAt: projects.createdAt,
				id: projects.id,
				leadCount: sql<number>`coalesce(${leadCounts.leadCount}, 0)::int`,
				name: projects.name,
				pendingDeploymentCount: sql<number>`coalesce(${deploymentAgg.pendingDeploymentCount}, 0)::int`,
				prompt: sql<string>`coalesce(${firstMessages.prompt}, '')`,
				updatedAt: projects.updatedAt,
			})
			.from(projects)
			.leftJoin(firstMessages, eq(firstMessages.projectId, projects.id))
			.leftJoin(leadCounts, eq(leadCounts.projectId, projects.id))
			.leftJoin(deploymentAgg, eq(deploymentAgg.projectId, projects.id));
	}
}
