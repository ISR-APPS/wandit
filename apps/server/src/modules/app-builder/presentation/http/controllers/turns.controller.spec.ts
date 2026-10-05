import { EventEmitter } from "node:events";
import { NotFoundException } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";
import { WORKSPACE_PERMISSION_KEY } from "../../../../workspaces/presentation/http/decorators/workspace.decorators";
import type { TurnStreamRelayService } from "../../../application/services/turn-stream-relay.service";
import type { TurnsService } from "../../../application/services/turns.service";
import { RATE_LIMIT_OPTIONS } from "../guards/redis-rate-limit.guard";
import { TurnsController } from "./turns.controller";

function setup() {
	const turns = {
		assertStreamAccess: vi.fn(),
		cancel: vi.fn(),
		create: vi.fn(),
		findActiveTurn: vi.fn(),
		handleTurnEnded: vi.fn(),
	};
	const relay = {
		relay: vi.fn(async () => undefined),
		releaseStreamSlot: vi.fn(async () => undefined),
	};
	const controller = new TurnsController(
		turns as unknown as TurnsService,
		relay as unknown as TurnStreamRelayService,
	);

	return { controller, relay, turns };
}

// Fake logged-in user for controller method calls (same shape as V1 specs).
const user = {
	banned: false,
	createdAt: new Date("2026-01-01T00:00:00.000Z"),
	email: "user@example.com",
	emailVerified: true,
	id: "user_1",
	name: "User",
	role: "user",
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} satisfies Parameters<TurnsController["create"]>[2];

const workspace = { kind: "personal" } as const satisfies Parameters<
	TurnsController["create"]
>[3];

// One `x-forwarded-for` hop and no trusted proxy list: `readClientIp`
// answers the hop.
const CLIENT_IP = "203.0.113.9";

function fakeSseRequest() {
	// SAFETY: the controller forwards the request to the relay and reads only
	// its headers and `ip` for the client IP.
	return {
		headers: { "x-forwarded-for": CLIENT_IP },
		ip: "10.0.0.2",
		raw: new EventEmitter(),
	} as unknown as FastifyRequest;
}

function fakeReply() {
	// SAFETY: the controller uses only `code` and `send` on the 204 path,
	// and `elapsedTime` on the create path.
	const reply = {
		code: vi.fn(),
		elapsedTime: 40,
		send: vi.fn(async () => reply),
	};
	reply.code.mockReturnValue(reply);
	return reply as unknown as FastifyReply;
}

// The controller only forwards the row's triggerRunId/projectId/id; the
// service fakes above are untyped `vi.fn`s, so a lean fixture suffices.
const turnRow = (overrides: Record<string, null | string> = {}) => ({
	id: "turn-1",
	projectId: "project-1",
	runner: "trigger",
	triggerRunId: "run-1",
	...overrides,
});

describe("TurnsController", () => {
	it("create delegates with the personal scope and streams through the relay", async () => {
		const { controller, relay, turns } = setup();
		const body = {
			chatId: "00000000-0000-0000-0000-000000000001",
			message: "build it",
		};
		const created = {
			chatId: body.chatId,
			estimate: { basis: "fixed", credits: 10 },
			runId: "run-1",
			status: "queued",
			streamUrl: "/api/v2/projects/p/turns/active/stream",
			turnId: "turn-1",
		};
		turns.create.mockResolvedValue(created);
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.create("project-1", body, user, workspace, request, reply);

		expect(turns.create).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
			body,
			{ ip: CLIENT_IP, requestStartedAt: expect.any(Number) },
		);
		// The create response rides as the first frame; the create guard
		// took a count slot, so the relay must not release a stream slot.
		expect(relay.relay).toHaveBeenCalledWith(
			expect.objectContaining({
				first: created,
				releaseSlot: false,
				reply,
				request,
				triggerRunId: "run-1",
				turnId: "turn-1",
			}),
		);
	});

	it("streams the turn's run through the relay", async () => {
		const { controller, relay, turns } = setup();
		turns.assertStreamAccess.mockResolvedValue(turnRow());
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.stream(
			"project-1",
			"turn-1",
			user,
			workspace,
			request,
			reply,
		);

		expect(turns.assertStreamAccess).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
			"turn-1",
		);
		expect(relay.relay).toHaveBeenCalledWith(
			expect.objectContaining({
				reply,
				request,
				triggerRunId: "run-1",
				turnId: "turn-1",
			}),
		);
	});

	it("answers 204 and frees the slot when the turn has no run yet", async () => {
		const { controller, relay, turns } = setup();
		turns.assertStreamAccess.mockResolvedValue(turnRow({ triggerRunId: null }));
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.stream(
			"project-1",
			"turn-1",
			user,
			workspace,
			request,
			reply,
		);

		expect(relay.relay).not.toHaveBeenCalled();
		expect(relay.releaseStreamSlot).toHaveBeenCalledWith(request);
		expect(reply.code).toHaveBeenCalledWith(204);
	});

	it("relays a host turn, which never has a Trigger run id", async () => {
		const { controller, relay, turns } = setup();
		turns.assertStreamAccess.mockResolvedValue(
			turnRow({ runner: "host", triggerRunId: null }),
		);
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.stream(
			"project-1",
			"turn-1",
			user,
			workspace,
			request,
			reply,
		);

		expect(relay.relay).toHaveBeenCalledWith(
			expect.objectContaining({ triggerRunId: null, turnId: "turn-1" }),
		);
	});

	it("answers 204 on the active stream when nothing is running", async () => {
		const { controller, relay, turns } = setup();
		turns.findActiveTurn.mockResolvedValue(null);
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.activeStream("project-1", user, workspace, request, reply);

		expect(relay.relay).not.toHaveBeenCalled();
		expect(relay.releaseStreamSlot).toHaveBeenCalledWith(request);
		expect(reply.code).toHaveBeenCalledWith(204);
	});

	it("streams an active turn with no run id through the relay poll", async () => {
		const { controller, relay, turns } = setup();
		// A queued row whose run id is not written yet: the relay polls
		// until the starter call lands it instead of answering 204.
		turns.findActiveTurn.mockResolvedValue(turnRow({ triggerRunId: null }));
		const request = fakeSseRequest();
		const reply = fakeReply();

		await controller.activeStream("project-1", user, workspace, request, reply);

		expect(relay.relay).toHaveBeenCalledWith(
			expect.objectContaining({
				reply,
				request,
				triggerRunId: null,
				turnId: "turn-1",
			}),
		);
		expect(relay.releaseStreamSlot).not.toHaveBeenCalled();
	});

	// Without the frame the browser has no turn id after a reload, and Stop
	// leaves the turn running and spending credits.
	it("sends the turn-created frame first on the active stream", async () => {
		const { controller, relay, turns } = setup();
		turns.findActiveTurn.mockResolvedValue(
			turnRow({ chatId: "chat-1", status: "running" }),
		);

		await controller.activeStream(
			"project-1",
			user,
			workspace,
			fakeSseRequest(),
			fakeReply(),
		);

		expect(relay.relay).toHaveBeenCalledWith(
			expect.objectContaining({
				first: {
					chatId: "chat-1",
					runId: "run-1",
					status: "running",
					streamUrl: "/api/v2/projects/project-1/turns/active/stream",
					turnId: "turn-1",
				},
			}),
		);
	});

	it("frees the open slot when the stream lookup rejects with a 404", async () => {
		const { controller, relay, turns } = setup();
		turns.assertStreamAccess.mockRejectedValue(new NotFoundException());
		const request = fakeSseRequest();

		await expect(
			controller.stream(
				"project-1",
				"turn-1",
				user,
				workspace,
				request,
				fakeReply(),
			),
		).rejects.toBeInstanceOf(NotFoundException);

		expect(relay.relay).not.toHaveBeenCalled();
		expect(relay.releaseStreamSlot).toHaveBeenCalledWith(request);
	});

	it("frees the open slot when the active-turn lookup rejects", async () => {
		const { controller, relay, turns } = setup();
		turns.findActiveTurn.mockRejectedValue(new NotFoundException());
		const request = fakeSseRequest();

		await expect(
			controller.activeStream(
				"project-1",
				user,
				workspace,
				request,
				fakeReply(),
			),
		).rejects.toBeInstanceOf(NotFoundException);

		expect(relay.relay).not.toHaveBeenCalled();
		expect(relay.releaseStreamSlot).toHaveBeenCalledWith(request);
	});

	it("frees the open slot when the relay fails before it can start", async () => {
		// A throw before the relay's own finally (e.g. a dead socket on
		// hijack) would leak the counted slot without the catch.
		const { controller, relay, turns } = setup();
		turns.assertStreamAccess.mockResolvedValue(turnRow());
		relay.relay.mockRejectedValue(new Error("socket gone"));
		const request = fakeSseRequest();

		await expect(
			controller.stream(
				"project-1",
				"turn-1",
				user,
				workspace,
				request,
				fakeReply(),
			),
		).rejects.toThrow("socket gone");

		expect(relay.releaseStreamSlot).toHaveBeenCalledWith(request);
	});

	it("cancel delegates with scope, project and turn ids, and the client IP", async () => {
		const { controller, turns } = setup();
		turns.cancel.mockResolvedValue({ status: "canceled", turnId: "turn-1" });

		const result = await controller.cancel(
			"project-1",
			"turn-1",
			user,
			workspace,
			fakeSseRequest(),
		);

		expect(turns.cancel).toHaveBeenCalledWith(
			{ kind: "personal", userId: "user_1" },
			"project-1",
			"turn-1",
			CLIENT_IP,
		);
		expect(result).toEqual({ status: "canceled", turnId: "turn-1" });
	});
});

describe("TurnsController route metadata", () => {
	it("gates create and cancel on project:update with a rate limit, and create also per IP", () => {
		// WANDIT-181: one person with many accounts on one IP still hits a cap.
		expect(
			Reflect.getMetadata(RATE_LIMIT_OPTIONS, TurnsController.prototype.create),
		).toMatchObject({ ipLimit: expect.any(Number), key: "turn-create" });
		expect(
			Reflect.getMetadata(RATE_LIMIT_OPTIONS, TurnsController.prototype.cancel),
		).toMatchObject({ key: "turn-cancel" });

		for (const handler of [
			TurnsController.prototype.create,
			TurnsController.prototype.cancel,
		]) {
			expect(Reflect.getMetadata(WORKSPACE_PERMISSION_KEY, handler)).toEqual({
				actions: ["update"],
				resource: "project",
			});
		}
	});

	it("counts open slots on the two SSE routes", () => {
		for (const handler of [
			TurnsController.prototype.activeStream,
			TurnsController.prototype.stream,
		]) {
			expect(Reflect.getMetadata(RATE_LIMIT_OPTIONS, handler)).toMatchObject({
				key: "turn-stream",
				mode: "open",
			});
		}
	});
});
