import { describe, expect, it, vi } from "vitest";

import {
	DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
	DomainsRepository,
} from "./domains.repository";

const DOMAIN_ID = "22222222-2222-4222-8222-222222222222";
const NONCE = "purchase:11111111-1111-4111-8111-111111111111";

type QueryCall = [text: string, values: unknown[]];

function repositoryWithQuery(rows: unknown[]): {
	query: ReturnType<typeof vi.fn>;
	repository: DomainsRepository;
} {
	const query = vi.fn(async () => ({ rows }));
	const repository = new DomainsRepository({
		$client: { query },
	} as never);

	return { query, repository };
}

function compactSql(query: ReturnType<typeof vi.fn>): string {
	const [text] = query.mock.calls[0] as QueryCall;

	return text.replace(/\s+/g, " ").trim();
}

function queryValues(query: ReturnType<typeof vi.fn>): unknown[] {
	const [, values] = query.mock.calls[0] as QueryCall;

	return values;
}

function selectBuilder(result: unknown[] = []) {
	const builder = {
		from: vi.fn(),
		innerJoin: vi.fn(),
		limit: vi.fn(async () => result),
		orderBy: vi.fn(),
		where: vi.fn(),
	};
	builder.from.mockReturnValue(builder);
	builder.innerJoin.mockReturnValue(builder);
	builder.orderBy.mockReturnValue(builder);
	builder.where.mockReturnValue(builder);

	return builder;
}

describe("DomainsRepository Trigger configuration cursor", () => {
	it("initializes atomically while merging DNS JSON and preserving updatedAt", async () => {
		const dns = {
			cfHostname: { ownership: "challenge" },
			purchaseDnsConfigured: true,
			records: [{ name: "www", type: "CNAME", value: "origin.example" }],
			registrar: { forwardingConfigured: true },
			triggerConfiguration: {
				nextAttempt: 0,
				nextProbeAt: null,
				nonce: NONCE,
			},
		};
		const { query, repository } = repositoryWithQuery([{ dns }]);

		await expect(
			repository.initializeCursor(DOMAIN_ID, {
				adoptExistingNonce: false,
				nonce: NONCE,
			}),
		).resolves.toEqual({
			nextAttempt: 0,
			nextProbeAt: null,
			nonce: NONCE,
		});

		const statement = compactSql(query);
		expect(statement).toContain("status = 'configuring'");
		expect(statement).toContain("->> 'nonce' = $2::text");
		expect(statement).toContain("|| jsonb_build_object(");
		expect(statement).toContain("'triggerConfiguration'");
		expect(statement).toContain("updated_at = updated_at");
		expect(queryValues(query)).toEqual([DOMAIN_ID, NONCE, false]);
		// The returned DB JSON still contains every pre-existing private/public key;
		// the repository reads only the cursor projection from it.
		expect(dns).toMatchObject({
			cfHostname: { ownership: "challenge" },
			purchaseDnsConfigured: true,
			records: [{ name: "www", type: "CNAME", value: "origin.example" }],
			registrar: { forwardingConfigured: true },
		});
	});

	it("adopts an existing cutover nonce and parses its absolute deadline", async () => {
		const nextProbeAt = "2026-08-01T12:15:00.000Z";
		const { query, repository } = repositoryWithQuery([
			{
				dns: {
					triggerConfiguration: {
						nextAttempt: 9,
						nextProbeAt,
						nonce: "bull:cutover",
					},
				},
			},
		]);

		await expect(
			repository.initializeCursor(DOMAIN_ID, {
				adoptExistingNonce: true,
				nonce: NONCE,
			}),
		).resolves.toEqual({
			nextAttempt: 9,
			nextProbeAt: new Date(nextProbeAt),
			nonce: "bull:cutover",
		});
		expect(queryValues(query)).toEqual([DOMAIN_ID, NONCE, true]);
	});

	it("reads a cursor after status changes so terminal cleanup can still remove it", async () => {
		const { query, repository } = repositoryWithQuery([
			{ dns: { records: [] } },
		]);

		await expect(repository.readCursor(DOMAIN_ID)).resolves.toBeNull();
		expect(compactSql(query)).not.toContain("status = 'configuring'");
	});

	it("advances with status, nonce, and expected-attempt CAS", async () => {
		const nextProbeAt = new Date("2026-08-01T12:15:00.000Z");
		const { query, repository } = repositoryWithQuery([{ id: DOMAIN_ID }]);

		await expect(
			repository.advanceCursor(DOMAIN_ID, {
				expectedAttempt: 8,
				nextAttempt: 9,
				nextProbeAt,
				nonce: NONCE,
			}),
		).resolves.toBe(true);

		const statement = compactSql(query);
		expect(statement).toContain("status = 'configuring'");
		expect(statement).toContain("(dns -> 'triggerConfiguration') @>");
		expect(statement).toContain("'nonce', $2::text");
		expect(statement).toContain("'nextAttempt', $3::integer");
		expect(statement).toContain("updated_at = updated_at");
		expect(queryValues(query)).toEqual([
			DOMAIN_ID,
			NONCE,
			8,
			9,
			nextProbeAt.toISOString(),
		]);
	});

	it("reports a lost status/nonce/attempt CAS without advancing", async () => {
		const { repository } = repositoryWithQuery([]);

		await expect(
			repository.advanceCursor(DOMAIN_ID, {
				expectedAttempt: 8,
				nextAttempt: 9,
				nextProbeAt: new Date("2026-08-01T12:15:00.000Z"),
				nonce: NONCE,
			}),
		).resolves.toBe(false);
	});

	it("clears only the matching nonce and can clean up after terminal status", async () => {
		const miss = repositoryWithQuery([]);

		await expect(miss.repository.clearCursor(DOMAIN_ID, NONCE)).resolves.toBe(
			false,
		);
		const statement = compactSql(miss.query);
		expect(statement).toContain("- 'triggerConfiguration'");
		expect(statement).toContain("'nonce', $2::text");
		expect(statement).toContain("updated_at = updated_at");
		expect(statement).not.toContain("status = 'configuring'");
		expect(queryValues(miss.query)).toEqual([DOMAIN_ID, NONCE]);

		const match = repositoryWithQuery([{ id: DOMAIN_ID }]);
		await expect(match.repository.clearCursor(DOMAIN_ID, NONCE)).resolves.toBe(
			true,
		);
	});
});

describe("DomainsRepository bounded scans", () => {
	it("caps stale-purchase reconciliation and joins payment-order state", async () => {
		const builder = selectBuilder();
		const repository = new DomainsRepository({
			select: vi.fn(() => builder),
		} as never);

		await expect(
			repository.findStalePurchaseCandidates({
				limit: Number.POSITIVE_INFINITY,
				staleBefore: new Date("2026-08-01T11:30:00.000Z"),
			}),
		).resolves.toEqual([]);
		expect(builder.innerJoin).toHaveBeenCalledOnce();
		expect(builder.limit).toHaveBeenCalledWith(
			DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
		);
	});

	it("caps renewal and registrar-sync maintenance scans", async () => {
		const renewalBuilder = selectBuilder();
		const syncBuilder = selectBuilder();
		const select = vi
			.fn()
			.mockReturnValueOnce(renewalBuilder)
			.mockReturnValueOnce(syncBuilder);
		const repository = new DomainsRepository({ select } as never);

		await repository.findExpiringPurchased(
			new Date("2026-08-01T12:00:00.000Z"),
			999,
		);
		await repository.findPurchasedForSync(999);

		expect(renewalBuilder.limit).toHaveBeenCalledWith(
			DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
		);
		expect(syncBuilder.limit).toHaveBeenCalledWith(
			DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
		);
	});
});
