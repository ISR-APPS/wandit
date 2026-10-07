/**
 * `mobile-build` Trigger.dev task (WANDIT-194): one Android APK build per run.
 * `trigger-mobile-build-task-starter.ts` queues it by task id with the key
 * `mobile-build:<buildId>`. The steps live in `mobile-build.runtime.ts` so the
 * spec runs them on fakes. This file only wires the real dependencies.
 */
import "./undici-timeouts";

import { resolve } from "node:path";

import { logger, schemaTask, wait } from "@trigger.dev/sdk";
import { uuidSchema } from "@wandit/contracts";
import { createDb } from "@wandit/db";
import { env } from "@wandit/env/server";
import { Sentry } from "@wandit/observability/node";
import { z } from "zod";

import { easBuildRunnerFromEnv } from "../modules/app-builder/infrastructure/eas/eas-build-runner";
import { hostExec } from "../modules/app-builder/infrastructure/eas/host-exec";
import { prepareMobileBuildWorkspace } from "../modules/app-builder/infrastructure/eas/mobile-build-workspace";
import { CodeStorageGitStore } from "../modules/app-builder/infrastructure/git/code-storage.git-store";
import { AppBackendsRepository } from "../modules/app-builder/infrastructure/persistence/app-backends.repository";
import { MobileBuildsRepository } from "../modules/app-builder/infrastructure/persistence/mobile-builds.repository";
import { ProjectLivenessRepository } from "../modules/app-builder/infrastructure/persistence/project-liveness.repository";
import { TEMPLATE_ARCHIVE_DIR } from "../modules/app-builder/infrastructure/sandbox/template-init";

import { createTriggerMetering } from "./metering.runtime";
import { runMobileBuild } from "./mobile-build.runtime";
import { mobileBuildQueue } from "./mobile-build-task-queues";

// Queue-boundary parse: the payload crosses a process boundary, so the run
// validates it instead of trusting the API-side type.
const mobileBuildPayloadSchema = z.object({
	actorIsLimitExempt: z.boolean(),
	buildId: uuidSchema,
	projectId: uuidSchema,
});

/** One EAS build per `mobile_builds` row: clone, install, `eas build`, poll, settle. */
export const mobileBuildTask = schemaTask({
	id: "mobile-build",
	// 1 vCPU and 2 GB for the trusted pnpm install of the Expo template.
	// UNVERIFIED: the size. The 0.5 GB default died with OOM in generate-page.
	machine: "medium-1x",
	// 3600 compute seconds. A `wait.for` above 5 s does not count, so the
	// 2 h poll fits.
	maxDuration: 3600,
	queue: mobileBuildQueue,
	// After the claim, a retry finds the row in `building` and skips.
	// It cannot recover the build, so one attempt is enough.
	retry: { maxAttempts: 1 },
	schema: mobileBuildPayloadSchema,
	run: async (payload, { ctx }) => {
		// Each run makes its own pool and ends it in `finally`, so a reused
		// worker leaks no connection. The pool closes an idle connection after
		// 10 s. Thus the 2 h EAS poll does not keep one connection open.
		const db = createDb({ idleTimeoutMillis: 10_000, max: 1 });
		try {
			const runner = easBuildRunnerFromEnv(env);
			const result = await runMobileBuild(
				{
					backends: new AppBackendsRepository(db),
					billingDisabled: env.GENERATION_BILLING_MODE === "off",
					builds: new MobileBuildsRepository(db),
					captureException: (error, tags) => {
						Sentry.captureException(error, { tags });
					},
					// `easBuildRunnerFromEnv` checks both values; the account
					// check here gives the runtime its string type.
					eas:
						runner === null || env.EXPO_ACCOUNT === undefined
							? null
							: { account: env.EXPO_ACCOUNT, runner },
					gitStore: new CodeStorageGitStore(env),
					logger: Sentry.logger,
					metering: createTriggerMetering(db),
					now: Date.now,
					projects: new ProjectLivenessRepository(db),
					prepareWorkspace: (input) =>
						prepareMobileBuildWorkspace(hostExec, input),
					// A Trigger wait frees the machine during the EAS poll.
					sleep: (ms) => wait.for({ seconds: ms / 1000 }),
					templateDir: resolve(TEMPLATE_ARCHIVE_DIR, "mobile-app"),
				},
				{ ...payload, triggerRunId: ctx.run.id },
			);
			logger.info("Mobile build ended", {
				...result,
				buildId: payload.buildId,
				projectId: payload.projectId,
				triggerRunId: ctx.run.id,
			});
			return result;
		} finally {
			await db.$client.end();
		}
	},
});
