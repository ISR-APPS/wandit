/**
 * GitHub two-way sync of V2 app projects: one GitHub user connection per
 * Wandit user, and one GitHub repo link per project.
 * The app-builder GitHub routes and the `github-sync` Trigger task read and
 * write both tables through their repositories in apps/server.
 */
import {
	bigint,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";
import { projects } from "./projects";

/** One GitHub user connection per Wandit user: the encrypted tokens and the pending OAuth state. */
export const githubConnections = pgTable(
	"github_connections",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Cascade: the GitHub tokens of a deleted user have no owner.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// GitHub login of the connected user, for display. A rename on GitHub changes it.
		githubLogin: text("github_login"),
		// Numeric GitHub user id of the connected user. It never changes, so the
		// repo create compares a personal installation with it. Null reads as not connected.
		githubUserId: bigint("github_user_id", { mode: "number" }),
		// User access token, encrypted with BETTER_AUTH_SECRET (better-auth symmetricEncrypt).
		accessToken: text("access_token"),
		// User refresh token, encrypted the same way. GitHub rotates it on each refresh.
		refreshToken: text("refresh_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		// Transient OAuth state of one connect; the callback clears it.
		oauthState: text("oauth_state"),
		// The callback refuses a state older than 10 minutes.
		oauthStateCreatedAt: timestamp("oauth_state_created_at", {
			withTimezone: true,
		}),
		// Builder URL the callback redirects to.
		returnUrl: text("return_url"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		uniqueIndex("github_connections_userId_uq").on(table.userId),
		// The callback finds the row by its state.
		index("github_connections_oauthState_idx").on(table.oauthState),
	],
);

/** One GitHub repo per V2 project and the sync state that the `github-sync` task writes. */
export const projectGithubLinks = pgTable(
	"project_github_links",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Projects are soft-deleted, so readers also filter `projects.deleted_at`.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The user who linked the repo. Restrict, like `app_commits.user_id`.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// Org workspace of the project, or null on a personal project.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// GitHub App installation that reaches the repo.
		installationId: bigint("installation_id", { mode: "number" }).notNull(),
		// GitHub repo id. Installation tokens are limited to this one repo.
		repoId: bigint("repo_id", { mode: "number" }).notNull(),
		repoOwner: text("repo_owner").notNull(),
		repoName: text("repo_name").notNull(),
		// Numeric GitHub user id of the linker. On each run the worker reads its
		// current login and checks the write access of that login.
		githubUserId: bigint("github_user_id", { mode: "number" }).notNull(),
		// GitHub head that the project last pushed or pulled.
		lastSyncedSha: text("last_synced_sha"),
		// GitHub head that the worker last saw.
		remoteHeadSha: text("remote_head_sha"),
		// GitHub head that the worker copied to the code.storage branch `github/main`.
		mirroredSha: text("mirrored_sha"),
		// A contracts `githubSyncErrorCodes` value, or null after a good sync.
		lastError: text("last_error"),
		// When the status route last read the GitHub head. It limits the reads
		// of all tabs and API processes to one per interval.
		githubCheckedAt: timestamp("github_checked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// One GitHub repo per project.
		uniqueIndex("project_github_links_projectId_uq").on(table.projectId),
		// The webhook route finds the link by the repo id of the push.
		index("project_github_links_repoId_idx").on(table.repoId),
	],
);
