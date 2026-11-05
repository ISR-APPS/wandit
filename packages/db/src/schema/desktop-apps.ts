/**
 * Desktop apps of V2 projects: the identity and updater key of each app.
 * The file also holds its Windows and macOS builds and the registry of built
 * SQLite migrations (docs/v2/desktop-apps.md). The desktop API in the
 * app-builder module writes the rows; the `desktop-build` Trigger task moves
 * the builds.
 */
import { relations, sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organizations";
import { projects } from "./projects";

/**
 * Lifecycle of one build. `queued`, `preparing`, `building`, and `signing`
 * are the live states: at most one row per project may sit in them.
 */
export const desktopBuildStatus = pgEnum("desktop_build_status", [
	"queued",
	"preparing",
	"building",
	"signing",
	"ready",
	"failed",
	"canceled",
	"blocked",
]);

/** Target system of one build. A build makes the files of one platform only. */
export const desktopPlatform = pgEnum("desktop_platform", ["windows", "macos"]);

// One row per desktop project, written on the first build request.
export const desktopApps = pgTable(
	"desktop_apps",
	{
		// Cascade: a deleted project loses its desktop identity.
		projectId: uuid("project_id")
			.primaryKey()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The owner pair, as `projectOwnerColumns` writes it at the first build:
		// `projects.user_id` of a personal project, or the org and the member of
		// the first build of a team project. A project move rewrites both.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Name of the app: the window title, the Windows install folder, and the
		// macOS `.app` name. Fixed at the first build.
		productName: text("product_name").notNull(),
		// ASCII name of the executable and of the download files, for example
		// "stock-manager".
		binaryName: text("binary_name").notNull(),
		// Minisign key id: 16 uppercase hex digits, as the public key comment shows it.
		updaterKeyId: text("updater_key_id").notNull(),
		// Base64 of the 2-line minisign public key text: the `plugins.updater.pubkey`
		// value of tauri.conf.json. Every built app holds it, on both platforms.
		updaterPublicKey: text("updater_public_key").notNull(),
		// AES-256-GCM ciphertext of the Ed25519 private key (PKCS8 DER, base64),
		// with `projectId:DESKTOP_UPDATER_KEY` as the authenticated data. The
		// layout is the one of `project_secrets.ciphertext`.
		updaterPrivateKeyCiphertext: text(
			"updater_private_key_ciphertext",
		).notNull(),
		// The `APP_SECRETS_ENCRYPTION_KEY` version that encrypted the key.
		updaterKeyVersion: integer("updater_key_version").notNull(),
		// The build that the Windows manifest `latest.json` announces. Null before
		// the first Windows release. A composite key below proves the build is of
		// the same project.
		currentWindowsBuildId: uuid("current_windows_build_id"),
		// The build that the macOS manifest `latest-macos.json` announces. Null
		// before the first macOS release. Same composite key rule.
		currentMacosBuildId: uuid("current_macos_build_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		// NO ACTION: a build row is deleted only with its project, and the
		// project delete removes both rows in one statement.
		foreignKey({
			columns: [table.projectId, table.currentWindowsBuildId],
			foreignColumns: [desktopBuilds.projectId, desktopBuilds.id],
			name: "desktop_apps_current_windows_build_fk",
		}),
		foreignKey({
			columns: [table.projectId, table.currentMacosBuildId],
			foreignColumns: [desktopBuilds.projectId, desktopBuilds.id],
			name: "desktop_apps_current_macos_build_fk",
		}),
	],
);

// One row per build request: one platform, one version. The `desktop-build`
// Trigger task moves its status.
export const desktopBuilds = pgTable(
	"desktop_builds",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// The user who asked for the build, the actor (workspaces-sharing.md 4).
		// On a shared personal project the payer is `projects.user_id`, not this
		// user. Restrict: the credit history of the build must survive account rows.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		// The team org of the project, or null on a personal project.
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "restrict",
		}),
		// Cascade: a deleted project loses its builds.
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		status: desktopBuildStatus("status").notNull().default("queued"),
		// No default: every insert names the platform. It never changes.
		platform: desktopPlatform("platform").notNull(),
		// 1, 2, 3, ... per project, one counter for both platforms. The installed
		// app version is `1.0.<n>`.
		releaseNumber: integer("release_number").notNull(),
		// Semver written into tauri.conf.json, `1.0.<releaseNumber>`.
		version: text("version").notNull(),
		// Head of `main` on code.storage when the user asked for the build.
		commitSha: text("commit_sha").notNull(),
		// Release notes from the user; the update dialog of the installed app shows them.
		notes: text("notes"),
		// Product name at build time; a copy of `desktop_apps.product_name`.
		productName: text("product_name").notNull(),
		// R2 key of the download file: the signed setup exe on Windows, the disk
		// image on macOS. Set on `ready`.
		installerKey: text("installer_key"),
		// Lowercase hex SHA-256 of the download file bytes. Set on `ready`.
		installerSha256: text("installer_sha256"),
		// Size of the download file in bytes. Set on `ready`.
		installerBytes: integer("installer_bytes"),
		// Minisign `.sig` content of the update file: the setup exe on Windows,
		// the `.app.tar.gz` on macOS. Set on `ready`.
		updaterSignature: text("updater_signature"),
		// R2 key of the signed `.app.tar.gz` that the macOS updater installs. Null
		// on Windows, where the installer is also the update file.
		updateArchiveKey: text("update_archive_key"),
		// Reasons of the gate, as an array of `DesktopGateFinding` from
		// @wandit/contracts. The API parses it with `desktopGateFindingSchema`
		// on read. Not empty only on a `blocked` build. Never holds a secret value.
		findings: jsonb("findings").notNull().default(sql`'[]'::jsonb`),
		// GitHub Actions run id of `build.yml` or `build-macos.yml`, as text.
		ciRunId: text("ci_run_id"),
		// Trigger.dev run id of the `desktop-build` task.
		triggerRunId: text("trigger_run_id"),
		// Machine failure code, one of `desktopBuildErrorCodes` in packages/contracts.
		errorCode: text("error_code"),
		// English failure detail for support; the API does not send it. Never
		// holds a token or a secret.
		errorMessage: text("error_message"),
		// Client key of the create request. A retried request with the same
		// key answers the same row.
		requestKey: text("request_key").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		// When the build reached `ready`, `failed`, `canceled`, or `blocked`.
		completedAt: timestamp("completed_at", { withTimezone: true }),
		// The last time a release made this build current.
		releasedAt: timestamp("released_at", { withTimezone: true }),
	},
	(table) => [
		// One live build per project. `liveDesktopBuildStatuses` in
		// packages/contracts copies this list.
		uniqueIndex("desktop_builds_live_project_uq")
			.on(table.projectId)
			.where(
				sql`${table.status} IN ('queued', 'preparing', 'building', 'signing')`,
			),
		// FK target so the app pointers and the migration registry can prove
		// their build is of the same project.
		uniqueIndex("desktop_builds_projectId_id_uq").on(table.projectId, table.id),
		uniqueIndex("desktop_builds_projectId_requestKey_uq").on(
			table.projectId,
			table.requestKey,
		),
		// The version number is unique per project, so two builds never share
		// one updater version.
		uniqueIndex("desktop_builds_projectId_releaseNumber_uq").on(
			table.projectId,
			table.releaseNumber,
		),
		// Build history of one project, newest first.
		index("desktop_builds_projectId_createdAt_idx").on(
			table.projectId,
			table.createdAt,
		),
		// The NSIS installer packs the version as 16-bit parts.
		check(
			"desktop_builds_releaseNumber_range",
			sql`${table.releaseNumber} BETWEEN 1 AND 65535`,
		),
		// Only a macOS build has an update archive.
		check(
			"desktop_builds_update_archive_macos_only",
			sql`${table.platform} = 'macos' OR ${table.updateArchiveKey} IS NULL`,
		),
	],
);

// One row per migration file of a build that reached `ready`. Installed apps
// may have run these files, so a later build must keep each one unchanged.
export const desktopMigrations = pgTable(
	"desktop_migrations",
	{
		projectId: uuid("project_id")
			.notNull()
			.references(() => projects.id, { onDelete: "cascade" }),
		// The 4-digit version of the file name, as a number.
		version: integer("version").notNull(),
		// The name part of the file name, for example "add_customers".
		name: text("name").notNull(),
		// Lowercase hex SHA-256 of the UTF-8 file text.
		sha256: text("sha256").notNull(),
		// The first ready build that held the file, of the same project.
		firstBuildId: uuid("first_build_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		primaryKey({ columns: [table.projectId, table.version] }),
		foreignKey({
			columns: [table.projectId, table.firstBuildId],
			foreignColumns: [desktopBuilds.projectId, desktopBuilds.id],
			name: "desktop_migrations_first_build_fk",
		}),
	],
);

// The current-build pointers have no relation: code reads them as plain columns.
export const desktopAppsRelations = relations(desktopApps, ({ one }) => ({
	project: one(projects, {
		fields: [desktopApps.projectId],
		references: [projects.id],
	}),
}));

export const desktopBuildsRelations = relations(desktopBuilds, ({ one }) => ({
	user: one(user, {
		fields: [desktopBuilds.userId],
		references: [user.id],
	}),
	organization: one(organization, {
		fields: [desktopBuilds.organizationId],
		references: [organization.id],
	}),
	project: one(projects, {
		fields: [desktopBuilds.projectId],
		references: [projects.id],
	}),
}));
