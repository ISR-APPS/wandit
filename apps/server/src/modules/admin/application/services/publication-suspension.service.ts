/**
 * The staff take-down switch of a V2 app (WANDIT-181). `AdminPublicationsController`
 * calls `suspend` and `unsuspend`. Each call writes the project columns through
 * `AdminRepository`. Then it rewrites the KV host pointers through
 * `DomainRoutingService`. On suspend it withdraws the desktop release: it
 * clears the current build and every installer key through
 * `DesktopBuildsRepository`, then deletes `desktop/<projectId>/` on R2
 * through `DESKTOP_RELEASE_OBJECTS`. It records one audit row through
 * `AuditEventsService`.
 */
import {
	BadGatewayException,
	ConflictException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	type AdminPublicationSuspensionResponse,
	type AdminSuspendPublicationInput,
	appHostPointer,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import {
	deleteObjectsByPrefix,
	isR2Configured,
} from "../../../../infrastructure/storage/r2";
import { AuditEventsService } from "../../../app-builder/application/services/audit-events.service";
import { DesktopBuildsRepository } from "../../../app-builder/infrastructure/persistence/desktop-builds.repository";
import { DomainRoutingService } from "../../../domains/infrastructure/cloudflare/domain-routing.service";
import {
	type AdminProjectSuspension,
	AdminRepository,
	type AdminSuspensionTargetRow,
} from "../../infrastructure/persistence/admin.repository";

/** The staff member who clicks the switch. The audit row names this user id. */
type SuspensionActor = { id: string };

/** Nest token of the R2 calls that withdraw the release of a desktop app. */
export const DESKTOP_RELEASE_OBJECTS = Symbol.for(
	"admin.desktop-release-objects",
);

/** The R2 seam of a desktop withdrawal; the spec passes a fake. */
export type DesktopReleaseObjects = {
	/** True when the R2 credentials exist. */
	isConfigured(): boolean;
	/**
	 * Deletes every object under `desktop/<projectId>/` and answers the count:
	 * `latest.json`, the stable installer, and every build installer.
	 */
	remove(projectId: string): Promise<number>;
};

/** The production `DesktopReleaseObjects` on the shared R2 helpers. */
export const r2DesktopReleaseObjects: DesktopReleaseObjects = {
	isConfigured: isR2Configured,
	// The prefix of `v2ProjectPrefixes` in r2.ts that holds the desktop objects.
	remove: (projectId) => deleteObjectsByPrefix(`desktop/${projectId}/`),
};

/** The admin dialog shows this text in its error toast. */
const PROJECT_GONE_MESSAGE = "The project does not exist or is deleted";

/**
 * Suspends and unsuspends a V2 app. A repeat call is safe: it writes the
 * state and every pointer again, and adds one more audit row.
 */
@Injectable()
export class PublicationSuspensionService {
	private readonly logger = new Logger(PublicationSuspensionService.name);

	constructor(
		@Inject(AdminRepository)
		private readonly adminRepository: Pick<
			AdminRepository,
			"findSuspensionTarget" | "setProjectSuspension"
		>,
		@Inject(DomainRoutingService)
		private readonly routing: Pick<
			DomainRoutingService,
			"isKvConfigured" | "putHostPointer" | "refreshProjectDomains"
		>,
		@Inject(AuditEventsService)
		private readonly audit: Pick<AuditEventsService, "record">,
		@Inject(DESKTOP_RELEASE_OBJECTS)
		private readonly desktopRelease: DesktopReleaseObjects,
		@Inject(DesktopBuildsRepository)
		private readonly desktopApps: Pick<
			DesktopBuildsRepository,
			"withdrawRelease"
		>,
	) {}

	/**
	 * Blocks every host of the app with the reason. A second call overwrites
	 * the reason, the note, and the time.
	 */
	async suspend(
		actor: SuspensionActor,
		projectId: string,
		input: AdminSuspendPublicationInput,
		ip: string | null,
	): Promise<AdminPublicationSuspensionResponse> {
		const target = await this.findAppProject(projectId);
		const suspension: AdminProjectSuspension = {
			reasonCode: input.reasonCode,
			// The schema trims the note, so an empty note becomes null.
			note: input.note || null,
			suspendedAt: new Date(),
		};

		await this.changeSuspension(
			actor,
			projectId,
			target,
			suspension,
			"project.suspend",
			ip,
		);

		return {
			projectId,
			suspension: {
				reasonCode: suspension.reasonCode,
				suspendedAt: suspension.suspendedAt.toISOString(),
			},
		};
	}

	/** Serves the app again on every host. A project that is not suspended gets the same pointers again. */
	async unsuspend(
		actor: SuspensionActor,
		projectId: string,
		ip: string | null,
	): Promise<AdminPublicationSuspensionResponse> {
		const target = await this.findAppProject(projectId);

		await this.changeSuspension(
			actor,
			projectId,
			target,
			null,
			"project.unsuspend",
			ip,
		);

		return { projectId, suspension: null };
	}

	private async findAppProject(
		projectId: string,
	): Promise<AdminSuspensionTargetRow> {
		const target = await this.adminRepository.findSuspensionTarget(projectId);

		// The publish log keeps the rows of a deleted project, so the dialog
		// shows this message when staff click such a row.
		if (target === null || target.deletedAt !== null) {
			throw new NotFoundException(PROJECT_GONE_MESSAGE);
		}
		// A V1 page has no app pointer. Its suspend is later work.
		if (target.engine === "v1_page") {
			throw new ConflictException({
				code: "SUSPEND_UNSUPPORTED",
				message: "Only a V2 app can be suspended",
			});
		}

		return target;
	}

	// The durable state goes first. Publish and rollback refuse a suspended
	// project, and later pointer writers copy the state. A KV error leaves
	// the old pointers live until staff send the same call again.
	private async changeSuspension(
		actor: SuspensionActor,
		projectId: string,
		target: AdminSuspensionTargetRow,
		suspension: AdminProjectSuspension | null,
		action: "project.suspend" | "project.unsuspend",
		ip: string | null,
	): Promise<void> {
		const written = await this.adminRepository.setProjectSuspension(
			projectId,
			suspension,
		);
		// A delete ran between the read and the write.
		if (!written) {
			throw new NotFoundException(PROJECT_GONE_MESSAGE);
		}

		try {
			await this.writeHostPointers(projectId);
			// Section 10 of docs/v2/desktop-apps.md: installed desktop apps stop
			// updating, and no installer link works. Unsuspend restores nothing;
			// the owner builds again.
			if (suspension !== null) {
				await this.withdrawDesktopRelease(projectId);
			}
		} catch (error) {
			// The state is saved, so the admin must know that some hosts still
			// serve the old state. The dialog stays open for the same call.
			throw new BadGatewayException(
				{
					code: "SUSPENSION_HOSTS_NOT_UPDATED",
					message:
						"The change is saved, but some hosts still serve the old state. Send the same action again.",
				},
				{ cause: error },
			);
		} finally {
			// The state above changed even when KV fails, so the trail always records who changed it.
			await this.audit.record({
				action,
				actorUserId: actor.id,
				ip,
				// On unsuspend, `reasonCode` is the reason that the call lifts.
				metadata: {
					note: suspension?.note ?? null,
					reasonCode: suspension?.reasonCode ?? target.suspendedReasonCode,
				},
				organizationId: target.organizationId,
				projectId,
				targetId: projectId,
				targetType: "project",
			});
		}
	}

	// A project with no desktop app has no `desktop/` objects and no app
	// row, so both writes find nothing. Local development has no R2.
	private async withdrawDesktopRelease(projectId: string): Promise<void> {
		// Security: the database withdraw runs first. It waits for a release in
		// progress, so the delete below runs after the last R2 write of that
		// release. The `ready` transition refuses a suspended project, so no
		// new installer key appears after it.
		await this.desktopApps.withdrawRelease(projectId);
		if (!this.desktopRelease.isConfigured()) {
			this.logger.warn(
				`R2 not configured; skipping the desktop release of project ${projectId}`,
			);
			return;
		}
		await this.desktopRelease.remove(projectId);
	}

	private async writeHostPointers(projectId: string): Promise<void> {
		// Local development has no KV. The project columns still block publish.
		if (!this.routing.isKvConfigured()) {
			this.logger.warn(
				`Cloudflare KV not configured; skipping host pointers of project ${projectId}`,
			);
			return;
		}

		// Read the row again after the state write. The pointers then copy the
		// stored state and the live slug, also after a publish in between.
		// LIMIT: no lock per project. Two opposite staff calls in one KV round
		// trip can leave the older pointer. Upgrade: a Redis lock per project.
		const current = await this.adminRepository.findSuspensionTarget(projectId);
		const liveSlug = current?.liveSlug ?? null;
		const suspendedReasonCode = current?.suspendedReasonCode ?? null;
		if (liveSlug !== null) {
			await this.routing.putHostPointer(
				`${liveSlug}.${env.SITES_DOMAIN}`,
				appHostPointer({
					projectId,
					slug: liveSlug,
					source: "slug",
					suspendedReasonCode,
				}),
			);
		}
		await this.routing.refreshProjectDomains(
			projectId,
			appHostPointer({
				projectId,
				slug: null,
				source: "domain",
				suspendedReasonCode,
			}),
		);
	}
}
