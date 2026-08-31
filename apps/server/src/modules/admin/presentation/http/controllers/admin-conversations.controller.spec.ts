import { BadRequestException } from "@nestjs/common";
import {
	GUARDS_METADATA,
	PATH_METADATA,
	ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import type { AuthUser } from "@wandit/auth";
import type { FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { ZodValidationPipe } from "../../../../../infrastructure/http/zod-validation.pipe";
import type { AdminConversationsService } from "../../../application/services/admin-conversations.service";
import { ADMIN_PERMISSION_KEY } from "../decorators/admin-permission.decorator";
import { AdminGuard } from "../guards/admin.guard";
import { AdminConversationsController } from "./admin-conversations.controller";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const QUERY = { page: 1, pageSize: 20 };

function setup() {
	const service = {
		getChatDetail: vi.fn(),
		getGenerationAttempt: vi.fn(),
		listAiFailures: vi.fn(),
		listChatCalls: vi.fn(),
		listChatMessages: vi.fn(),
		listProjectChats: vi.fn(),
		listUserChats: vi.fn(),
	};
	const controller = new AdminConversationsController(
		service as unknown as AdminConversationsService,
	);

	return { controller, service };
}

function routePipe(
	method: keyof AdminConversationsController,
	parameterIndex: number,
): ZodValidationPipe<unknown> {
	const routeArguments = Reflect.getMetadata(
		ROUTE_ARGS_METADATA,
		AdminConversationsController,
		method,
	) as Record<string, { index: number; pipes?: unknown[] }>;
	const argument = Object.values(routeArguments).find(
		(candidate) => candidate.index === parameterIndex,
	);
	const pipe = argument?.pipes?.find(
		(candidate) => candidate instanceof ZodValidationPipe,
	);

	if (!(pipe instanceof ZodValidationPipe)) {
		throw new Error(`${String(method)}[${parameterIndex}] is missing a pipe`);
	}

	return pipe;
}

describe("AdminConversationsController", () => {
	it("protects every route with conversations:read", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, AdminConversationsController),
		).toEqual([AdminGuard]);
		expect(
			Reflect.getMetadata(ADMIN_PERMISSION_KEY, AdminConversationsController),
		).toEqual({ conversations: ["read"] });
	});

	it("derives every HTTP path from the shared admin routes", () => {
		expect(
			Reflect.getMetadata(PATH_METADATA, AdminConversationsController),
		).toBe("v1/admin");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.listProjectChats,
			),
		).toBe("projects/:projectId/chats");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.listUserChats,
			),
		).toBe("users/:userId/chats");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.getChatDetail,
			),
		).toBe("chats/:chatId");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.listChatMessages,
			),
		).toBe("chats/:chatId/messages");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.listChatCalls,
			),
		).toBe("chats/:chatId/calls");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.listAiFailures,
			),
		).toBe("ai-failures");
		expect(
			Reflect.getMetadata(
				PATH_METADATA,
				AdminConversationsController.prototype.getGenerationAttempt,
			),
		).toBe("generations/:surface/:attemptId");
	});

	it("passes the acting admin role and request id to transcript reads", async () => {
		const { controller, service } = setup();
		const admin = { id: "admin_1", role: "admin" } as AuthUser;
		const request = { id: "request_1" } as FastifyRequest;

		await controller.listChatMessages(CHAT_ID, QUERY, admin, request);

		expect(service.listChatMessages).toHaveBeenCalledWith(CHAT_ID, QUERY, {
			admin: { id: "admin_1", role: "admin" },
			requestId: "request_1",
		});
	});

	it("delegates the remaining conversation inspector reads", async () => {
		const { controller, service } = setup();

		await controller.listProjectChats(PROJECT_ID, QUERY);
		await controller.listUserChats("user_1", QUERY);
		await controller.getChatDetail(CHAT_ID);
		await controller.listChatCalls(CHAT_ID, QUERY);
		await controller.listAiFailures({
			kind: "timeout",
			page: 2,
			pageSize: 20,
		});
		await controller.getGenerationAttempt("image", "attempt_1");

		expect(service.listProjectChats).toHaveBeenCalledWith(PROJECT_ID, QUERY);
		expect(service.listUserChats).toHaveBeenCalledWith("user_1", QUERY);
		expect(service.getChatDetail).toHaveBeenCalledWith(CHAT_ID);
		expect(service.listChatCalls).toHaveBeenCalledWith(CHAT_ID, QUERY);
		expect(service.listAiFailures).toHaveBeenCalledWith({
			kind: "timeout",
			page: 2,
			pageSize: 20,
		});
		expect(service.getGenerationAttempt).toHaveBeenCalledWith(
			"image",
			"attempt_1",
		);
	});

	it("attaches the shared pagination, filter, UUID, and surface schemas", () => {
		expect(
			routePipe("listProjectChats", 1).transform(
				{ page: "2", pageSize: "50" },
				{ type: "query" },
			),
		).toEqual({ page: 2, pageSize: 50 });
		expect(() =>
			routePipe("getChatDetail", 0).transform("not-a-uuid", {
				type: "param",
			}),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("listAiFailures", 0).transform(
				{ page: 1, pageSize: 20, surface: "unknown" },
				{ type: "query" },
			),
		).toThrow(BadRequestException);
		expect(() =>
			routePipe("getGenerationAttempt", 0).transform("chat", {
				type: "param",
			}),
		).toThrow(BadRequestException);
	});
});
