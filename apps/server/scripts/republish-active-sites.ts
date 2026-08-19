/**
 * Republish every project that currently has a live (`active`) deployment, so
 * already-published sites pick up the newest deterministic publish passes.
 *
 * WHY. Font-link hoisting (`optimizeFontLoading`), image markup + `srcset`
 * (`optimizeImageMarkup` / `emitResponsiveImages`) and pixel injection all run
 * INSIDE `SitesService.runPublishPipeline`. A page therefore only gains them on
 * its NEXT publish: every site published before those passes shipped keeps
 * serving the old bytes until its owner touches it again. This script is that
 * touch, applied to the whole fleet at once.
 *
 * SAFE BY CONSTRUCTION:
 * - It REUSES the service pipeline instead of copying it, so a republished page
 *   takes the exact code path a dashboard publish takes: same slug rules, same
 *   entitlement/badge rules, same asset preflight, same archive-then-flip order.
 *   A copy would drift the moment a pass is added — which is the very bug this
 *   script exists to repair.
 * - `requestedSlug: undefined` keeps each site on its current slug, so no live
 *   URL moves and no host pointer is repointed at a different project.
 * - Every pass in the pipeline is idempotent, so a repeat run is cheap and an
 *   interrupted run simply resumes.
 * - A failed project is logged and the walk continues. The pipeline marks its
 *   own pending row `failed` and never demotes the live row, so the previously
 *   published bytes keep serving — a failure costs a retry and nothing else.
 *
 * REQUIRED ENV (from apps/server/.env like the other scripts, or exported
 * before the run). Values below are the PRODUCTION ones; secrets never belong
 * in this file:
 *   DATABASE_URL                    production Postgres
 *   R2_ACCOUNT_ID                   R2 credentials for the published bytes
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET=wandit-production
 *   R2_PUBLIC_BASE_URL=https://assets.wandit.app
 *   BETTER_AUTH_URL=https://api.wandit.dev
 *   SITES_DOMAIN=wandit.app
 *   CLOUDFLARE_API_TOKEN            KV host pointers for {slug}.wandit.app
 *   CLOUDFLARE_KV_NAMESPACE_ID
 *   CLOUDFLARE_ZONE_ID_WANDIT_APP
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Usage (from apps/server):
 *   pnpm sites:republish-active -- --dry-run          # list, change nothing
 *   pnpm sites:republish-active                       # republish the fleet
 *   pnpm sites:republish-active -- --project <uuid>
 *   pnpm sites:republish-active -- --limit 50 --concurrency 4
 */
import { and, asc, createDb, eq, isNull } from "@wandit/db";
import { deployments } from "@wandit/db/schema/deployments";
import { projects } from "@wandit/db/schema/projects";
import { env } from "@wandit/env/server";

import type { AnalyticsService } from "../src/infrastructure/analytics/analytics.service";
import type { Database } from "../src/infrastructure/database/database.constants";
import { getPageHtml, isR2Configured } from "../src/infrastructure/storage/r2";
import { DomainRoutingService } from "../src/modules/domains/infrastructure/cloudflare/domain-routing.service";
import { DomainsRepository } from "../src/modules/domains/infrastructure/persistence/domains.repository";
import type { ProjectScope } from "../src/modules/projects/domain/project-scope";
import { SitesService } from "../src/modules/sites/application/services/sites.service";
import {
	type DeploymentRow,
	DeploymentsRepository,
	type OwnedProjectRow,
} from "../src/modules/sites/infrastructure/persistence/deployments.repository";

// Publishing is R2 + KV + DB work per project. Kept low by default: this
// competes with live publish traffic for the same bandwidth and rate limits.
const DEFAULT_CONCURRENCY = 2;

// The only asset host published pages may point at.
const PRODUCTION_ASSET_BASE_URL = "https://assets.wandit.app";

type Options = {
	concurrency: number;
	dryRun: boolean;
	limit: number | null;
	projectId: string | null;
	skipGuardrails: boolean;
};

type WorkItem = {
	projectId: string;
	slug: string;
	versionId: string;
};

type Totals = {
	failed: number;
	skipped: number;
	succeeded: number;
	total: number;
};

type ProjectOutcome =
	| { kind: "published"; slug: string }
	| { kind: "skipped"; reason: string };

/**
 * `runPublishPipeline` is private on SitesService. The script reaches through
 * the visibility line on purpose: reusing the service's exact pipeline is the
 * whole point, and a local re-implementation would go stale against the next
 * pass someone adds. The cast is deliberately narrow — one method, one input
 * shape — so the contract this script depends on is written down right here.
 */
type PublishPipeline = {
	runPublishPipeline(input: {
		html: string;
		project: OwnedProjectRow;
		requestedSlug: undefined;
		versionId: string;
	}): Promise<DeploymentRow>;
};

function parseOptions(argv: string[]): Options {
	const options: Options = {
		concurrency: DEFAULT_CONCURRENCY,
		dryRun: false,
		limit: null,
		projectId: null,
		skipGuardrails: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];

		// `pnpm sites:republish-active -- --dry-run` forwards the bare separator.
		if (argument === "--") {
			continue;
		}

		if (argument === "--dry-run") {
			options.dryRun = true;
			continue;
		}

		if (argument === "--i-know-what-im-doing") {
			options.skipGuardrails = true;
			continue;
		}

		if (argument === "--project") {
			const value = argv[index + 1];

			if (!value || value.startsWith("--")) {
				throw new Error("--project requires a project id");
			}

			options.projectId = value.trim();
			index += 1;
			continue;
		}

		if (argument === "--limit" || argument === "--concurrency") {
			const value = argv[index + 1];
			const parsed = Number.parseInt(value ?? "", 10);

			if (!Number.isFinite(parsed) || parsed < 1) {
				throw new Error(`${argument} requires a positive integer`);
			}

			if (argument === "--limit") {
				options.limit = parsed;
			} else {
				options.concurrency = parsed;
			}

			index += 1;
			continue;
		}

		throw new Error(
			`Unknown argument ${argument}. Supported: --dry-run, --project <id>, --limit <n>, --concurrency <n>, --i-know-what-im-doing`,
		);
	}

	return options;
}

/**
 * Which environment check refuses this run, if any.
 *
 * The environment is BAKED INTO every page this script writes: the leads
 * capture URL comes from BETTER_AUTH_URL and the asset URLs from
 * R2_PUBLIC_BASE_URL. Republishing live client sites with a dev or staging
 * value would silently point their lead forms at a machine that does not exist
 * for their visitors. So the wrong environment is not a warning — it is a stop.
 */
function guardrailFailure(): string | null {
	const bucket = env.R2_BUCKET ?? "";

	if (bucket.endsWith("-dev") || bucket === "wandit-staging") {
		return `R2_BUCKET is "${bucket}", which is not the production bucket`;
	}

	if (
		env.BETTER_AUTH_URL.includes("localhost") ||
		env.BETTER_AUTH_URL.includes("127.0.0.1")
	) {
		return `BETTER_AUTH_URL is "${env.BETTER_AUTH_URL}", so every republished page would capture leads at a local machine`;
	}

	if (env.R2_PUBLIC_BASE_URL !== PRODUCTION_ASSET_BASE_URL) {
		return `R2_PUBLIC_BASE_URL is "${env.R2_PUBLIC_BASE_URL ?? "unset"}", expected "${PRODUCTION_ASSET_BASE_URL}"`;
	}

	return null;
}

/**
 * The authorization scope of the project's OWN owner, rebuilt the way
 * `projectScopeFrom` builds it per request. Going through the real scope keeps
 * `getAccessibleProject` on its normal path, so entitlement and badge rules
 * stay identical to a dashboard publish. `actorIsLimitExempt` only gates credit
 * spending, which republishing never does.
 */
async function loadProjectScope(
	db: Database,
	projectId: string,
): Promise<ProjectScope | null> {
	const [row] = await db
		.select({
			organizationId: projects.organizationId,
			userId: projects.userId,
		})
		.from(projects)
		.where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
		.limit(1);

	if (!row) {
		return null;
	}

	return row.organizationId === null
		? { kind: "personal", userId: row.userId }
		: {
				actorIsLimitExempt: true,
				kind: "org",
				organizationId: row.organizationId,
				userId: row.userId,
			};
}

async function loadWorkList(
	db: Database,
	options: Options,
): Promise<WorkItem[]> {
	const rows = await db
		.select({
			projectId: deployments.projectId,
			slug: deployments.slug,
			versionId: deployments.versionId,
		})
		.from(deployments)
		.where(
			and(
				eq(deployments.status, "active"),
				...(options.projectId
					? [eq(deployments.projectId, options.projectId)]
					: []),
			),
		)
		.orderBy(asc(deployments.createdAt), asc(deployments.id));

	// At most one active row per project (deployments_active_project_uq), so
	// this list is small enough to trim in memory and keep the query one shape.
	return options.limit === null ? rows : rows.slice(0, options.limit);
}

async function republishProject(
	item: WorkItem,
	deps: {
		db: Database;
		pipeline: PublishPipeline;
		repository: DeploymentsRepository;
	},
): Promise<ProjectOutcome> {
	// Same first move as a dashboard publish: a pending row orphaned by an
	// earlier crash would otherwise block this project on "publishing".
	await deps.repository.healStalePending(item.projectId);

	const scope = await loadProjectScope(deps.db, item.projectId);

	if (scope === null) {
		return { kind: "skipped", reason: "project row missing or soft-deleted" };
	}

	const project = await deps.repository.getAccessibleProject(
		scope,
		item.projectId,
	);
	const version = await deps.repository.findVersionForProject(
		item.versionId,
		item.projectId,
	);

	if (version === null) {
		return {
			kind: "skipped",
			reason: `version ${item.versionId} no longer belongs to the project`,
		};
	}

	const html = await getPageHtml(version.r2Key);

	if (html === null) {
		return {
			kind: "skipped",
			reason: `draft bytes missing at ${version.r2Key}`,
		};
	}

	// requestedSlug: undefined → the pipeline keeps the current live slug.
	const deployment = await deps.pipeline.runPublishPipeline({
		html,
		project,
		requestedSlug: undefined,
		versionId: version.id,
	});

	return { kind: "published", slug: deployment.slug };
}

function reasonOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));

	// Before ANYTHING, dry run included: reading the work list from the wrong
	// database is already the wrong answer.
	if (!options.skipGuardrails) {
		const failure = guardrailFailure();

		if (failure !== null) {
			console.error(`Refusing to run: ${failure}.`);
			console.error(
				"Point the env at production, or pass --i-know-what-im-doing to override.",
			);
			process.exit(1);
		}
	}

	if (!isR2Configured()) {
		console.error("R2 is not configured — set the R2_* env vars first.");
		process.exit(1);
	}

	const db = createDb({ max: 1 });

	try {
		const work = await loadWorkList(db, options);

		if (work.length === 0) {
			console.log(
				options.projectId
					? `Project ${options.projectId} has no active deployment.`
					: "No project has an active deployment.",
			);

			return;
		}

		if (options.dryRun) {
			// Zero writes on this path — not even healStalePending runs.
			console.log(
				`Dry run: ${work.length} project(s) would be republished (no R2, KV, or DB writes).`,
			);
			console.table(work);

			return;
		}

		const repository = new DeploymentsRepository(db);
		const service = new SitesService(
			repository,
			new DomainRoutingService(new DomainsRepository(db)),
			// The pipeline never touches analytics — only SitesService.publish()
			// does — so a no-op stub keeps PostHog out of a fleet-wide script.
			{ capture: () => undefined } as unknown as AnalyticsService,
		);
		const pipeline = service as unknown as PublishPipeline;

		const totals: Totals = {
			failed: 0,
			skipped: 0,
			succeeded: 0,
			total: work.length,
		};
		const failures: { projectId: string; reason: string; slug: string }[] = [];
		const skips: { projectId: string; reason: string; slug: string }[] = [];

		console.log(
			`Republishing ${work.length} project(s) with concurrency ${options.concurrency}.`,
		);

		let next = 0;
		const worker = async (): Promise<void> => {
			while (next < work.length) {
				const item = work[next] as WorkItem;
				next += 1;

				try {
					const outcome = await republishProject(item, {
						db,
						pipeline,
						repository,
					});

					if (outcome.kind === "skipped") {
						totals.skipped += 1;
						skips.push({
							projectId: item.projectId,
							reason: outcome.reason,
							slug: item.slug,
						});
						console.warn(`skipped ${item.slug}: ${outcome.reason}`);

						continue;
					}

					totals.succeeded += 1;
					console.log(`republished ${outcome.slug} (${item.projectId})`);
				} catch (error) {
					// The old active deployment still serves, so a failure is a
					// retry candidate and never a reason to stop the fleet.
					totals.failed += 1;
					failures.push({
						projectId: item.projectId,
						reason: reasonOf(error),
						slug: item.slug,
					});
					console.warn(`failed ${item.slug}: ${reasonOf(error)}`);
				}
			}
		};

		await Promise.all(
			Array.from({ length: Math.min(options.concurrency, work.length) }, () =>
				worker(),
			),
		);

		console.log(
			`total=${totals.total} succeeded=${totals.succeeded} failed=${totals.failed} skipped=${totals.skipped}`,
		);

		if (skips.length > 0) {
			console.log("Skipped:");
			console.table(skips);
		}

		if (failures.length > 0) {
			console.error("Failed (old deployments still serving; re-run to retry):");
			console.table(failures);
			process.exitCode = 1;
		}
	} finally {
		await db.$client.end();
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
