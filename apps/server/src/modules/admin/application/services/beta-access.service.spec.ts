import type { AdminBetaEnrollInput, CreditBucket } from "@wandit/contracts";
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
		return value ? { id: userId, role: value.role } : null;
	}

	async setUserEarlyAccess(userId: string, earlyAccess: boolean) {
		const value = this.users.get(userId);

		if (!value) {
			throw new Error("missing user");
		}

		value.earlyAccess = earlyAccess;
	}

	async insertBetaAccessEvent(input: AccessEvent) {
		if (this.failEventInsert) {
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
});
