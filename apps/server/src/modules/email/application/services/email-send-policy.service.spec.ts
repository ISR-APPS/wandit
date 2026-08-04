import blocklist from "disposable-email-domains";
import wildcardBlocklist from "disposable-email-domains/wildcard.json";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	AuthEmailSendKind,
	AuthEmailSendsRepository,
} from "../../infrastructure/persistence/auth-email-sends.repository";
import { EmailSendPolicyService } from "./email-send-policy.service";

type RecordedSend = {
	id: string;
	actorId: string | null;
	emailCanonical: string;
	ipHash: string | null;
	kind: AuthEmailSendKind;
	createdAt: Date;
};

// Mirrors the SQL row comparison (created_at, id) < (cursor…).
function isEarlier(
	row: { id: string; createdAt: Date },
	cursor: { id: string; createdAt: Date },
): boolean {
	if (row.createdAt.getTime() !== cursor.createdAt.getTime()) {
		return row.createdAt.getTime() < cursor.createdAt.getTime();
	}
	return row.id < cursor.id;
}

function makeFakeRepo() {
	const rows: RecordedSend[] = [];
	const repo = {
		record: vi.fn(
			async (input: {
				actorId: string | null;
				emailCanonical: string;
				ipHash: string | null;
				kind: AuthEmailSendKind;
			}) => {
				// Deterministic ids in insertion order so the (createdAt, id)
				// tiebreak the service relies on is exercised even when a
				// burst lands inside the same millisecond.
				const row = {
					...input,
					createdAt: new Date(),
					id: String(rows.length + 1).padStart(4, "0"),
				};
				rows.push(row);
				return { createdAt: row.createdAt, id: row.id };
			},
		),
		countEarlierForEmail: vi.fn(
			async (
				email: string,
				since: Date,
				kinds: AuthEmailSendKind[],
				cursor: { id: string; createdAt: Date },
			) =>
				rows.filter(
					(row) =>
						row.emailCanonical === email &&
						row.createdAt >= since &&
						kinds.includes(row.kind) &&
						isEarlier(row, cursor),
				).length,
		),
		countEarlierForIp: vi.fn(
			async (
				ipHash: string,
				since: Date,
				cursor: { id: string; createdAt: Date },
			) =>
				rows.filter(
					(row) =>
						row.ipHash === ipHash &&
						row.createdAt >= since &&
						isEarlier(row, cursor),
				).length,
		),
		countForEmailSince: vi.fn(
			async (email: string, since: Date, kinds: AuthEmailSendKind[]) =>
				rows.filter(
					(row) =>
						row.emailCanonical === email &&
						row.createdAt >= since &&
						kinds.includes(row.kind),
				).length,
		),
		lastSendAtForEmail: vi.fn(
			async (email: string, kinds: AuthEmailSendKind[]) => {
				const matches = rows
					.filter(
						(row) =>
							row.emailCanonical === email && kinds.includes(row.kind),
					)
					.map((row) => row.createdAt)
					.sort((a, b) => b.getTime() - a.getTime());
				return matches[0] ?? null;
			},
		),
		countForIpSince: vi.fn(
			async (ipHash: string, since: Date) =>
				rows.filter(
					(row) => row.ipHash === ipHash && row.createdAt >= since,
				).length,
		),
		countForActorSince: vi.fn(
			async (actorId: string, since: Date, kinds: AuthEmailSendKind[]) =>
				rows.filter(
					(row) =>
						row.actorId === actorId &&
						row.createdAt >= since &&
						kinds.includes(row.kind),
				).length,
		),
		deleteOlderThan: vi.fn(async () => {}),
	};
	return { repo: repo as unknown as AuthEmailSendsRepository, rows, fns: repo };
}

function service(repo: AuthEmailSendsRepository) {
	return new EmailSendPolicyService(repo);
}

const sendInput = (overrides: Partial<Parameters<EmailSendPolicyService["assertSignInSendAllowed"]>[0]> = {}) => ({
	email: "user@example.com",
	ipAddress: "203.0.113.7",
	kind: "magic-link" as const,
	...overrides,
});

describe("EmailSendPolicyService", () => {
	let fake: ReturnType<typeof makeFakeRepo>;
	let policy: EmailSendPolicyService;

	beforeEach(() => {
		fake = makeFakeRepo();
		policy = service(fake.repo);
	});

	it("rejects disposable domains from the exact blocklist", async () => {
		const domain = blocklist[0];
		expect(domain).toBeTruthy();
		await expect(
			policy.assertSignInSendAllowed(sendInput({ email: `x@${domain}` })),
		).rejects.toMatchObject({ body: { code: "EMAIL_DOMAIN_BLOCKED" } });
		// A vetoed request must not consume budget.
		expect(fake.rows).toHaveLength(0);
	});

	it("rejects subdomains of wildcard blocklist entries", async () => {
		const domain = wildcardBlocklist[0];
		expect(domain).toBeTruthy();
		await expect(
			policy.assertSignInSendAllowed(
				sendInput({ email: `x@deep.sub.${domain}` }),
			),
		).rejects.toMatchObject({ body: { code: "EMAIL_DOMAIN_BLOCKED" } });
	});

	it("allows a normal send and records it with a hashed ip", async () => {
		await policy.assertSignInSendAllowed(sendInput());
		expect(fake.rows).toHaveLength(1);
		expect(fake.rows[0]).toMatchObject({
			emailCanonical: "user@example.com",
			kind: "magic-link",
		});
		expect(fake.rows[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
		expect(fake.rows[0]?.ipHash).not.toContain("203.0.113.7");
	});

	it("enforces the min-gap per kind but lets the other kind through", async () => {
		await policy.assertSignInSendAllowed(sendInput());
		// Same kind immediately again: blocked.
		await expect(
			policy.assertSignInSendAllowed(sendInput()),
		).rejects.toMatchObject({ body: { code: "EMAIL_SEND_RATE_LIMITED" } });
		// "Email me a code instead" right after the link: allowed.
		await policy.assertSignInSendAllowed(sendInput({ kind: "otp" }));
		// Three rows for two permitted sends: the rejected attempt keeps its
		// row, which is what makes the cap check atomic under concurrency.
		expect(fake.rows).toHaveLength(3);
		expect(fake.rows.map((row) => row.kind)).toEqual([
			"magic-link",
			"magic-link",
			"otp",
		]);
	});

	it("rejects a concurrent burst that a check-then-write gate would let through", async () => {
		// All five start before any of them has finished: with the old
		// read-then-insert order every one of them read a count of zero.
		const results = await Promise.allSettled(
			Array.from({ length: 5 }, () =>
				policy.assertSignInSendAllowed(sendInput()),
			),
		);
		const allowed = results.filter((r) => r.status === "fulfilled");
		expect(allowed).toHaveLength(1);
		expect(results.filter((r) => r.status === "rejected")).toHaveLength(4);
	});

	it("pools the hourly cap across magic-link and otp sends", async () => {
		const kinds: AuthEmailSendKind[] = [
			"magic-link",
			"otp",
			"magic-link",
			"otp",
			"magic-link",
		];
		for (const kind of kinds) {
			fake.rows.push({
				actorId: null,
				id: `seed-${fake.rows.length}`,
				createdAt: new Date(Date.now() - 10 * 60 * 1000),
				emailCanonical: "user@example.com",
				ipHash: null,
				kind,
			});
		}
		await expect(
			policy.assertSignInSendAllowed(sendInput({ kind: "otp" })),
		).rejects.toMatchObject({ body: { code: "EMAIL_SEND_RATE_LIMITED" } });
	});

	it("enforces the per-ip daily cap across recipients", async () => {
		await policy.assertSignInSendAllowed(sendInput());
		const ipHash = fake.rows[0]?.ipHash ?? null;
		for (let i = 0; i < 29; i += 1) {
			fake.rows.push({
				actorId: null,
				id: `seed-${fake.rows.length}`,
				createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
				emailCanonical: `victim${i}@example.com`,
				ipHash,
				kind: "magic-link",
			});
		}
		await expect(
			policy.assertSignInSendAllowed(
				sendInput({ email: "victim99@example.com" }),
			),
		).rejects.toMatchObject({ body: { code: "EMAIL_SEND_RATE_LIMITED" } });
	});

	it("skips ip caps when no client ip is resolvable", async () => {
		await policy.assertSignInSendAllowed(sendInput({ ipAddress: null }));
		expect(fake.rows[0]?.ipHash).toBeNull();
	});

	describe("invitation sends", () => {
		it("suppresses disposable recipients without throwing", async () => {
			const domain = blocklist[0];
			await expect(
				policy.allowInvitationSend({ email: `x@${domain}`, inviterUserId: "user_1" }),
			).resolves.toBe(false);
			expect(fake.rows).toHaveLength(0);
		});

		it("caps invitation emails per recipient per day", async () => {
			for (let i = 0; i < 5; i += 1) {
				fake.rows.push({
					actorId: null,
					id: `seed-${fake.rows.length}`,
					createdAt: new Date(Date.now() - 60 * 60 * 1000),
					emailCanonical: "invitee@example.com",
					ipHash: null,
					kind: "invitation",
				});
			}
			await expect(
				policy.allowInvitationSend({
					email: "invitee@example.com",
					inviterUserId: "user_1",
				}),
			).resolves.toBe(false);
		});

		it("allows and records a normal invitation send", async () => {
			await expect(
				policy.allowInvitationSend({
					email: "invitee@example.com",
					inviterUserId: "user_1",
				}),
			).resolves.toBe(true);
			expect(fake.rows[0]).toMatchObject({
				emailCanonical: "invitee@example.com",
				kind: "invitation",
			});
		});

		it("keeps invitation budget separate from sign-in budget", async () => {
			for (let i = 0; i < 5; i += 1) {
				fake.rows.push({
					actorId: null,
					id: `seed-${fake.rows.length}`,
					createdAt: new Date(Date.now() - 60 * 60 * 1000),
					emailCanonical: "user@example.com",
					ipHash: null,
					kind: "invitation",
				});
			}
			// Five invitation emails today do not block a sign-in send.
			await policy.assertSignInSendAllowed(sendInput());
			expect(
				fake.rows.filter((row) => row.kind === "magic-link"),
			).toHaveLength(1);
		});
	});
});
