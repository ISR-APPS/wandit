import { describe, expect, it, vi } from "vitest";

import {
	DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
	DomainsRepository,
} from "./domains.repository";

const DOMAIN_ID = "22222222-2222-4222-8222-222222222222";
const NONCE = "purchase:11111111-1111-4111-8111-111111111111";

type QueryCall = [text: string, values: unknown[]];
type SqlCondition = {
	toQuery(config: {
		casing: { getColumnCasing(column: { name: string }): string };
		escapeName(name: string): string;
		escapeParam(index: number): string;
		escapeString(value: string): string;
	}): { params: unknown[]; sql: string };
};

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

function compileCondition(condition: unknown) {
	if (
		typeof condition !== "object" ||
		condition === null ||
		!("toQuery" in condition) ||
		typeof condition.toQuery !== "function"
	) {
		throw new Error("Expected a Drizzle SQL condition");
	}

	const { params, sql } = (condition as SqlCondition).toQuery({
		casing: { getColumnCasing: (column) => column.name },
		escapeName: (name) => `"${name.replaceAll('"', '""')}"`,
		escapeParam: (index) => `$${index + 1}`,
		escapeString: (value) => `'${value.replaceAll("'", "''")}'`,
	});

	return { params, sql: sql.replaceAll(/\s+/g, " ").trim() };
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

	it("atomically marks only the exhausted external cursor as stalled", async () => {
		const stalledAt = new Date("2026-08-02T00:00:30.000Z");
		const { query, repository } = repositoryWithQuery([{ id: DOMAIN_ID }]);

		await expect(
			repository.markExternalVerificationStalled(DOMAIN_ID, {
				attempts: 101,
				expectedAttempt: 100,
				nonce: NONCE,
				stalledAt,
			}),
		).resolves.toBe(true);

		const statement = compactSql(query);
		expect(statement).toContain("source = 'external'");
		expect(statement).toContain("status = 'configuring'");
		expect(statement).toContain("'externalVerification'");
		expect(statement).toContain("(dns -> 'triggerConfiguration') @>");
		expect(statement).toContain("updated_at = updated_at");
		expect(queryValues(query)).toEqual([
			DOMAIN_ID,
			NONCE,
			100,
			stalledAt.toISOString(),
			101,
		]);
	});

	it("resets a stalled external cursor without clearing its warning", async () => {
		const stalledAt = "2026-08-02T00:00:30.000Z";
		const { query, repository } = repositoryWithQuery([
			{
				dns: {
					externalVerification: { attempts: 101, stalledAt },
					records: [],
					triggerConfiguration: {
						nextAttempt: 0,
						nextProbeAt: null,
						nonce: `manual-restart:${stalledAt}`,
					},
				},
			},
		]);

		await expect(
			repository.prepareExternalVerificationRestart(DOMAIN_ID),
		).resolves.toEqual({
			attempts: 101,
			nonce: `manual-restart:${stalledAt}`,
			stalledAt,
		});

		const statement = compactSql(query);
		expect(statement).toContain(
			"'nonce', 'manual-restart:' || (dns -> 'externalVerification' ->> 'stalledAt')",
		);
		expect(statement).toContain(
			"WHEN dns -> 'triggerConfiguration' ->> 'nonce' = 'manual-restart:'",
		);
		expect(statement).toContain("THEN dns ELSE");
		expect(statement).toContain("'nextAttempt', 0");
		expect(statement).toContain("'nextProbeAt', NULL");
		expect(statement).toContain("source = 'external'");
		expect(statement).toContain("status = 'configuring'");
		expect(statement).toContain(
			"jsonb_typeof(dns -> 'externalVerification') = 'object'",
		);
		expect(statement).not.toContain("- 'externalVerification'");
		expect(queryValues(query)).toEqual([DOMAIN_ID]);
	});

	it("preserves an already-running deterministic restart cursor", async () => {
		const stalledAt = "2026-08-02T00:00:30.000Z";
		const restartNonce = `manual-restart:${stalledAt}`;
		const { query, repository } = repositoryWithQuery([
			{
				dns: {
					externalVerification: { attempts: 101, stalledAt },
					triggerConfiguration: {
						nextAttempt: 7,
						nextProbeAt: "2026-08-02T00:10:00.000Z",
						nonce: restartNonce,
					},
				},
			},
		]);

		await expect(
			repository.prepareExternalVerificationRestart(DOMAIN_ID),
		).resolves.toEqual({ attempts: 101, nonce: restartNonce, stalledAt });

		const statement = compactSql(query);
		expect(statement).toContain(
			"WHEN dns -> 'triggerConfiguration' ->> 'nonce' = 'manual-restart:'",
		);
		expect(statement).toContain("THEN dns ELSE");
	});

	it("clears only the matching stalled marker after restart handoff", async () => {
		const stalledAt = "2026-08-02T00:00:30.000Z";
		const { query, repository } = repositoryWithQuery([{ id: DOMAIN_ID }]);

		await expect(
			repository.clearExternalVerificationMarker(DOMAIN_ID, stalledAt),
		).resolves.toBe(true);

		const statement = compactSql(query);
		expect(statement).toContain("- 'externalVerification'");
		expect(statement).toContain("source = 'external'");
		expect(statement).toContain("'stalledAt', $2::text");
		expect(statement).toContain("updated_at = updated_at");
		expect(queryValues(query)).toEqual([DOMAIN_ID, stalledAt]);
	});

	it("activates external domains while removing only the current stalled marker", async () => {
		const current = { id: DOMAIN_ID, status: "active" };
		const { query, repository } = repositoryWithQuery([{ id: DOMAIN_ID }]);
		vi.spyOn(repository, "getById").mockResolvedValue(current as never);

		await expect(
			repository.activateAndClearExternalVerification(DOMAIN_ID, [
				"configuring",
			]),
		).resolves.toEqual(current);

		const statement = compactSql(query);
		expect(statement).toContain("status = 'active'");
		expect(statement).toContain("dns = (CASE WHEN jsonb_typeof(dns)");
		expect(statement).toContain("- 'externalVerification'");
		expect(statement).toContain("source = 'external'");
		expect(statement).toContain("status = ANY($2::domain_status[])");
		expect(queryValues(query)).toEqual([DOMAIN_ID, ["configuring"]]);
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
	it("resolves persisted and pre-cursor external configuration nonces", async () => {
		const persistedUpdatedAt = new Date("2026-08-01T11:00:00.000Z");
		const preCursorUpdatedAt = new Date("2026-08-01T11:15:00.000Z");
		const terminalUpdatedAt = new Date("2026-08-01T10:45:00.000Z");
		const builder = selectBuilder([
			{
				dns: {
					triggerConfiguration: {
						nextAttempt: 4,
						nextProbeAt: "2026-08-01T11:20:00.000Z",
						nonce: "manual:persisted-nonce",
					},
				},
				domainId: "33333333-3333-4333-8333-333333333333",
				updatedAt: persistedUpdatedAt,
			},
			{
				dns: { records: [] },
				domainId: "44444444-4444-4444-8444-444444444444",
				updatedAt: preCursorUpdatedAt,
			},
			{
				dns: {
					triggerConfiguration: {
						nextAttempt: 100,
						nextProbeAt: null,
						nonce: "manual:terminal-nonce",
					},
				},
				domainId: "55555555-5555-4555-8555-555555555555",
				updatedAt: terminalUpdatedAt,
			},
		]);
		const repository = new DomainsRepository({
			select: vi.fn(() => builder),
		} as never);

		await expect(
			repository.findStaleConfigurationCandidates({
				limit: 25,
				staleBefore: new Date("2026-08-01T11:30:00.000Z"),
			}),
		).resolves.toEqual([
			{
				domainId: "33333333-3333-4333-8333-333333333333",
				nonce: "manual:persisted-nonce",
				updatedAt: persistedUpdatedAt,
			},
			{
				domainId: "44444444-4444-4444-8444-444444444444",
				nonce: String(preCursorUpdatedAt.getTime()),
				updatedAt: preCursorUpdatedAt,
			},
		]);
		expect(builder.limit).toHaveBeenCalledWith(25);
		expect(builder.innerJoin).not.toHaveBeenCalled();
	});

	it("filters configuration recovery to stale external rows below attempt 100", async () => {
		const staleBefore = new Date("2026-08-01T11:30:00.000Z");
		const builder = selectBuilder();
		const repository = new DomainsRepository({
			select: vi.fn(() => builder),
		} as never);

		await repository.findStaleConfigurationCandidates({
			limit: Number.POSITIVE_INFINITY,
			staleBefore,
		});

		const condition = compileCondition(builder.where.mock.calls[0]?.[0]);
		expect(condition.params).toEqual([
			staleBefore,
			"external",
			"configuring",
			100,
		]);
		expect(condition.sql).toContain(`"domains"."updated_at" <= $1`);
		expect(condition.sql).toContain(`"domains"."source" = $2`);
		expect(condition.sql).toContain(`"domains"."status" = $3`);
		expect(condition.sql).toContain(
			`"domains"."cf_custom_hostname_id" IS NOT NULL`,
		);
		expect(condition.sql).toContain(
			`('nextAttempt', $4::integer), false) = false`,
		);
		expect(builder.limit).toHaveBeenCalledWith(
			DOMAIN_REPOSITORY_MAX_BATCH_SIZE,
		);
	});

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
