import {
	type AdminBetaEnrollInput,
	adminBulkSetAccessResultSchema,
	type CreditBucket,
} from "@wandit/contracts";
import { describe, expect, it } from "vitest";

import type { CreditsService } from "../../../credits/application/services/credits.service";
import type { CreditOwner } from "../../../credits/domain/credit-owner";
import type {
	AdminRepository,
	AdminTransaction,
} from "../../infrastructure/persistence/admin.repository";
import { BetaAccessService } from "./beta-access.service";

type Grant = {
	amount: number;
	bucket: CreditBucket;
	idempotencyKey: string;
	userId: string;
};

type AccessEvent = {
	action: "granted" | "revoked";
	actorUserId: string;
	reason: string | null;
	userId: string;
};

class InMemoryAdminRepository {
	users = new Map<string, { earlyAccess: boolean; role: string }>([
		["user_1", { earlyAccess: false, role: "user" }],
	]);
	grants: Grant[] = [];
	events: AccessEvent[] = [];
	failEventInsert = false;
	failEventInsertUserIds = new Set<string>();

	async withUserTransaction<T>(
		_userId: string,
		fn: (tx: AdminTransaction) => Promise<T>,
	): Promise<T> {
		const users = new Map(
			[...this.users].map(([id, value]) => [id, { ...value }]),
		);
		const grants = this.grants.map((grant) => ({ ...grant }));
		const events = this.events.map((event) => ({ ...event }));

		try {
			return await fn({} as AdminTransaction);
		} catch (error) {
			this.users = users;
			this.grants = grants;
			this.events = events;
			throw error;
		}
	}

	async findUserAccess(userId: string) {
		const value = this.users.get(userId);
		return value
			? { earlyAccess: value.earlyAccess, id: userId, role: value.role }
			: null;
	}

	async setUserEarlyAccess(userId: string, earlyAccess: boolean) {
		const value = this.users.get(userId);

		if (!value) {
			throw new Error("missing user");
		}

		value.earlyAccess = earlyAccess;
	}

	async insertBetaAccessEvent(input: AccessEvent) {
		if (this.failEventInsert || this.failEventInsertUserIds.has(input.userId)) {
			throw new Error("event insert failed");
		}

		this.events.push(input);
	}
}

class InMemoryCreditsService {
	constructor(private readonly repository: InMemoryAdminRepository) {}

	async grantWithReplayStatus(
		owner: CreditOwner,
		amount: number,
		options: { bucket: CreditBucket; idempotencyKey?: string },
	) {
		if (owner.type !== "user") {
			throw new Error("test expects a personal credit owner");
		}
		if (!options.idempotencyKey) {
			throw new Error("test expects an idempotency key");
		}

		const userId = owner.userId;
		const existing = this.repository.grants.find(
			(grant) => grant.idempotencyKey === options.idempotencyKey,
		);

		if (existing) {
			if (
				existing.userId !== userId ||
				existing.amount !== amount ||
				existing.bucket !== options.bucket
			) {
				throw new Error("Credit grant idempotency replay conflict");
			}

			return { replayed: true, row: {} };
		}

		this.repository.grants.push({
			amount,
			bucket: options.bucket,
			idempotencyKey: options.idempotencyKey,
			userId,
		});

		return { replayed: false, row: {} };
	}
}

const INPUT: AdminBetaEnrollInput = {
	credits: 20,
	idempotencyKey: "11111111-1111-4111-8111-111111111111",
	reason: "Founding beta tester",
};

function setup() {
	const repository = new InMemoryAdminRepository();
	const credits = new InMemoryCreditsService(repository);
	const service = new BetaAccessService(
		repository as unknown as AdminRepository,
		credits as unknown as CreditsService,
	);

	return { repository, service };
}

describe("BetaAccessService", () => {
	it("rolls back the access flag, promo grant, and audit event together", async () => {
		const { repository, service } = setup();
		repository.failEventInsert = true;

		await expect(service.enroll("admin_1", "user_1", INPUT)).rejects.toThrow(
			"event insert failed",
		);
		expect(repository.users.get("user_1")?.earlyAccess).toBe(false);
		expect(repository.grants).toEqual([]);
		expect(repository.events).toEqual([]);
	});

	it("replays the same enrollment without a second grant or event", async () => {
		const { repository, service } = setup();

		await service.enroll("admin_1", "user_1", INPUT);
		await service.enroll("admin_1", "user_1", INPUT);

		expect(repository.users.get("user_1")?.earlyAccess).toBe(true);
		expect(repository.grants).toEqual([
			expect.objectContaining({
				amount: 20,
				bucket: "promo",
				idempotencyKey:
					"beta-enroll:user_1:11111111-1111-4111-8111-111111111111",
			}),
		]);
		expect(repository.events).toHaveLength(1);
	});

	it("rejects a replay whose amount does not match", async () => {
		const { repository, service } = setup();
		await service.enroll("admin_1", "user_1", INPUT);

		await expect(
			service.enroll("admin_1", "user_1", { ...INPUT, credits: 21 }),
		).rejects.toThrow("Credit grant idempotency replay conflict");
		expect(repository.grants).toHaveLength(1);
		expect(repository.events).toHaveLength(1);
	});

	it("audits existing manual access grants and revocations", async () => {
		const { repository, service } = setup();

		await service.setAccess("admin_1", "user_1", true);
		await service.setAccess("admin_1", "user_1", false);

		expect(repository.events).toEqual([
			{
				action: "granted",
				actorUserId: "admin_1",
				reason: "manual_admin_access",
				userId: "user_1",
			},
			{
				action: "revoked",
				actorUserId: "admin_1",
				reason: "manual_admin_access",
				userId: "user_1",
			},
		]);
	});

	it("bulk updates eligible users, skips unchanged and admin users, and continues after failures", async () => {
		const { repository, service } = setup();
		repository.users.set("already_granted", {
			earlyAccess: true,
			role: "user",
		});
		repository.users.set("admin_2", {
			earlyAccess: false,
			role: "user, admin",
		});
		repository.users.set("user_fails", {
			earlyAccess: false,
			role: "user",
		});
		repository.users.set("user_after_failure", {
			earlyAccess: false,
			role: "user",
		});
		repository.failEventInsertUserIds.add("user_fails");

		const result = await service.bulkSetAccess("admin_1", {
			granted: true,
			userIds: [
				"user_1",
				"already_granted",
				"admin_2",
				"missing",
				"user_fails",
				"user_after_failure",
				"user_1",
			],
		});

		expect(result).toEqual({
			updated: 2,
			skipped: 2,
			failed: 2,
			results: [
				{ userId: "user_1", status: "granted" },
				{
					userId: "already_granted",
					status: "skipped",
					reason: "already_granted",
				},
				{ userId: "admin_2", status: "skipped", reason: "admin_role" },
				{ userId: "missing", status: "failed", reason: "not_found" },
				{ userId: "user_fails", status: "failed", reason: "error" },
				{ userId: "user_after_failure", status: "granted" },
			],
		});
		expect(() => adminBulkSetAccessResultSchema.parse(result)).not.toThrow();
		expect(repository.users.get("user_1")?.earlyAccess).toBe(true);
		expect(repository.users.get("already_granted")?.earlyAccess).toBe(true);
		expect(repository.users.get("admin_2")?.earlyAccess).toBe(false);
		expect(repository.users.get("user_fails")?.earlyAccess).toBe(false);
		expect(repository.users.get("user_after_failure")?.earlyAccess).toBe(true);
		expect(repository.events).toEqual([
			{
				action: "granted",
				actorUserId: "admin_1",
				reason: "manual_admin_access",
				userId: "user_1",
			},
			{
				action: "granted",
				actorUserId: "admin_1",
				reason: "manual_admin_access",
				userId: "user_after_failure",
			},
		]);
		expect(repository.grants).toEqual([]);
	});

	it("reports a bulk revocation as a successful transition without duplicating unchanged audit events", async () => {
		const { repository, service } = setup();
		repository.users.set("user_1", { earlyAccess: true, role: "user" });
		repository.users.set("already_revoked", {
			earlyAccess: false,
			role: "user",
		});

		const result = await service.bulkSetAccess("admin_1", {
			granted: false,
			userIds: ["user_1", "already_revoked"],
		});

		expect(result).toEqual({
			updated: 1,
			skipped: 1,
			failed: 0,
			results: [
				{ userId: "user_1", status: "revoked" },
				{
					userId: "already_revoked",
					status: "skipped",
					reason: "already_revoked",
				},
			],
		});
		expect(repository.events).toEqual([
			{
				action: "revoked",
				actorUserId: "admin_1",
				reason: "manual_admin_access",
				userId: "user_1",
			},
		]);
	});
});
