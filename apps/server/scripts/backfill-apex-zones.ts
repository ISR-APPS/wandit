/**
 * Backfill the apex (bare-name) serving path for purchased Name.com domains.
 *
 * Domains fulfilled before ApexZoneStep existed only serve `www.{domain}`;
 * their apex still points at Name.com's TLS-less URL-forwarding host. The same
 * applies to a purchase whose apex pass kept failing until the row went
 * `active`: the pipeline retries the apex only while the row is `configuring`,
 * so this script is the retry path for `active` rows. For every purchased/
 * namecom domain in `configuring` or `active` without `dns.apexConfigured`,
 * it runs the same best-effort ApexZoneStep the purchase runtime uses:
 * Cloudflare zone in our account (adopting an existing one by name), apex
 * custom hostname (adopting an existing one by name), DNS-only CNAMEs and
 * ownership TXT records in the zone, Name.com nameservers → the zone, marker
 * persisted. Domains whose zone, hostname, and NS delegation were created by
 * hand are therefore adopted as-is; the script only records their state. Apex
 * keys are merged into `dns` (never a full replace), so a `configuring` row's
 * live verification cursor is untouched. Failures land in `dns.apexError` and
 * the row is retried on the next run, so the script is safe to run repeatedly.
 *
 * Usage (from apps/server, env from apps/server/.env like the other scripts):
 *   pnpm domains:backfill-apex                  # process every candidate
 *   pnpm domains:backfill-apex -- --dry-run     # list candidates, change nothing
 *   pnpm domains:backfill-apex -- --domain example.com
 */
import { domainDnsSchema } from "@wandit/contracts";
import { and, asc, createDb, eq, inArray, sql } from "@wandit/db";
import { domains } from "@wandit/db/schema/domains";
import { env } from "@wandit/env/server";

import { createDomainApexBackfillRuntime } from "../src/trigger/domain-fulfillment.runtime";

type BackfillOptions = {
	domain: string | null;
	dryRun: boolean;
};

type SummaryRow = {
	apexConfigured: boolean;
	apexCustomHostnameId: string | null;
	apexError: string | null;
	name: string;
	status: string;
	zoneId: string | null;
	zoneNameServers: string;
	zoneStatus: string | null;
};

function parseOptions(argv: string[]): BackfillOptions {
	const options: BackfillOptions = { domain: null, dryRun: false };

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		// `pnpm domains:backfill-apex -- --dry-run` forwards the bare separator.
		if (argument === "--") {
			continue;
		}

		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		if (argument === "--domain") {
			const value = argv[index + 1];

			if (!value || value.startsWith("--")) {
				throw new Error("--domain requires a domain name");
			}

			options.domain = value.trim().toLowerCase();
			index += 1;
			continue;
		}

		throw new Error(
			`Unknown argument ${argument}. Supported: --dry-run, --domain <name>`,
		);
	}

	return options;
}

function summarize(row: {
	dns: unknown;
	name: string;
	status: string;
}): SummaryRow {
	const parsed = domainDnsSchema.safeParse(row.dns);
	const dns = parsed.success ? parsed.data : null;

	return {
		apexConfigured: dns?.apexConfigured === true,
		apexCustomHostnameId: dns?.apexCustomHostnameId ?? null,
		apexError: dns?.apexError ?? null,
		name: row.name,
		status: row.status,
		zoneId: dns?.zoneId ?? null,
		zoneNameServers: (dns?.zoneNameServers ?? []).join(", "),
		zoneStatus: dns?.zoneStatus ?? null,
	};
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));

	if (!env.DOMAINS_APEX_ZONE_ENABLED) {
		console.warn(
			"DOMAINS_APEX_ZONE_ENABLED=false: the apex zone step is disabled, so this backfill would be a no-op. Enable it before running.",
		);
		process.exitCode = 1;
		return;
	}

	const db = createDb({ max: 1 });

	try {
		// A single --domain run shows the row even when it is already configured;
		// the step's own apexConfigured guard keeps it a no-op.
		const rows = await db
			.select()
			.from(domains)
			.where(
				and(
					eq(domains.source, "purchased"),
					eq(domains.provider, "namecom"),
					inArray(domains.status, ["configuring", "active"]),
					...(options.domain
						? [eq(domains.name, options.domain)]
						: [
								sql`COALESCE(${domains.dns} -> 'apexConfigured', 'false'::jsonb) <> 'true'::jsonb`,
							]),
				),
			)
			.orderBy(asc(domains.createdAt), asc(domains.id));

		if (rows.length === 0) {
			console.log(
				options.domain
					? `No purchased Name.com domain named ${options.domain} in configuring/active.`
					: "No purchased domains need an apex backfill.",
			);
			return;
		}

		if (options.dryRun) {
			console.log(
				`Dry run: ${rows.length} domain(s) would run ApexZoneStep (no Cloudflare, Name.com, or DB writes).`,
			);
			console.table(rows.map(summarize));
			return;
		}

		const runtime = createDomainApexBackfillRuntime(db, {
			apexZoneEnabled: env.DOMAINS_APEX_ZONE_ENABLED,
			fallbackOrigin: env.DOMAINS_FALLBACK_ORIGIN,
			logger: {
				error: (message, details) => console.error(message, details ?? ""),
				warn: (message, details) => console.warn(message, details ?? ""),
			},
		});
		const summary: SummaryRow[] = [];

		// Sequential on purpose: one registrar/Cloudflare conversation at a time.
		for (const row of rows) {
			console.log(`Backfilling apex zone for ${row.name} (${row.status})`);
			summary.push(summarize(await runtime.apexZone.execute(row)));
		}

		console.table(summary);

		const deferred = summary.filter((entry) => !entry.apexConfigured);

		if (deferred.length > 0) {
			console.warn(
				`${deferred.length} domain(s) still need the apex backfill; re-run this script to retry them.`,
			);
			process.exitCode = 1;
		}
	} finally {
		await db.$client.end();
	}
}

await main();
