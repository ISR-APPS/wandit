/**
 * Starts and ends the Appetize device sessions of the V2 mobile preview
 * (WANDIT-196). `DeviceSessionsController` calls it. It checks the project,
 * the month minutes of the payer, and the one-session-per-user lock. Then
 * it mints a phone link through `PreviewTokenService` and the preview Worker.
 */
import { randomUUID } from "node:crypto";

import {
	ConflictException,
	HttpException,
	HttpStatus,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import type {
	DevicePlatform,
	StartDeviceSessionResponse,
} from "@wandit/contracts";
import { getErrorMessage } from "@wandit/observability/error";

import { resolveBillingPlan } from "../../../billing/application/services/resolve-billing-plan";
import { SubscriptionsRepository } from "../../../billing/infrastructure/persistence/subscriptions.repository";
import {
	meteringSubjectFrom,
	type ProjectScope,
} from "../../../projects/domain/project-scope";
import {
	APPETIZE_DEVICES,
	DEVICE_SESSION_LOCK_TTL_MS,
	DEVICE_SESSION_TIME_LIMIT_SECONDS,
	deviceMinutesLeft,
} from "../../domain/device-minutes";
import {
	DEVICE_SESSION_LOCK,
	type DeviceSessionLock,
} from "../../domain/ports/device-session-lock";
import { monthStartUtc } from "../../domain/turn-caps";
import {
	requireV2Env,
	V2_ENV,
	type V2EnvSource,
} from "../../infrastructure/env/v2-env";
import { AppCommitsRepository } from "../../infrastructure/persistence/app-commits.repository";
import { isUniqueViolation } from "../../infrastructure/persistence/builder-turns.repository";
import { DeviceSessionsRepository } from "../../infrastructure/persistence/device-sessions.repository";
import { PreviewProxyClient } from "../../infrastructure/preview-proxy/preview-proxy.client";
import { TEMPLATE_PROFILES } from "../../infrastructure/sandbox/template-profiles";
import { PreviewTokenService } from "./preview-token.service";

/** Expo Go launch params: both skip the Expo Go onboarding, like Expo Snack. */
const EXPO_GO_LAUNCH_PARAMS = {
	EXDevMenuDisableAutoLaunch: true,
	EXKernelDisableNuxDefaultsKey: true,
} as const;

/** Application service behind the two device-session routes. */
@Injectable()
export class DeviceSessionsService {
	private readonly logger = new Logger(DeviceSessionsService.name);

	constructor(
		// The Pick types keep each seam at the methods the service needs.
		// A spec passes plain fakes. Nest still injects by the class token.
		@Inject(AppCommitsRepository)
		private readonly appCommits: Pick<
			AppCommitsRepository,
			"findScopedProject"
		>,
		@Inject(DeviceSessionsRepository)
		private readonly sessions: Pick<
			DeviceSessionsRepository,
			"insertOpen" | "findStartedBy" | "end" | "usedMinutesSince"
		>,
		@Inject(DEVICE_SESSION_LOCK)
		private readonly lock: DeviceSessionLock,
		@Inject(PreviewTokenService)
		private readonly previewTokens: Pick<PreviewTokenService, "mint">,
		@Inject(PreviewProxyClient)
		private readonly previewProxy: Pick<
			PreviewProxyClient,
			"mintPhoneLink" | "isMetroRunning"
		>,
		@Inject(SubscriptionsRepository)
		private readonly subscriptions: Pick<
			SubscriptionsRepository,
			"findActiveByOwner"
		>,
		@Inject(V2_ENV)
		private readonly v2Env: V2EnvSource,
	) {}

	/**
	 * Starts one device session and answers the Appetize client config.
	 * 404 for a project that is missing, out of scope, or not a V2 mobile
	 * app. 402 `DEVICE_MINUTES_EXHAUSTED`, 409 `DEVICE_SESSION_OPEN`,
	 * 409 `SANDBOX_NOT_RUNNING`, and 409 `METRO_NOT_READY` refuse the start.
	 */
	async start(
		scope: ProjectScope,
		projectId: string,
		platform: DevicePlatform,
	): Promise<StartDeviceSessionResponse> {
		const pid = projectId.toLowerCase();
		const project = await this.appCommits.findScopedProject(scope, pid);
		// Only a V2 mobile project runs Expo Go; any other project is a 404.
		if (
			project?.engine !== "v2_app" ||
			project.framework !== TEMPLATE_PROFILES.mobile.framework
		) {
			throw new NotFoundException();
		}
		const publicKey = requireV2Env(
			platform === "ios"
				? "APPETIZE_IOS_PUBLIC_KEY"
				: "APPETIZE_ANDROID_PUBLIC_KEY",
			this.v2Env,
		);

		// Product rule: each plan gets a number of device minutes per month.
		// LIMIT: two members of one org can start at the last minute together
		// and pass the allowance by one session. Upgrade: a lock per payer.
		const now = new Date();
		const plan = await resolveBillingPlan(
			this.subscriptions,
			meteringSubjectFrom(scope),
		);
		const usedMinutes = await this.sessions.usedMinutesSince(
			{ userId: scope.userId, organizationId: project.organizationId },
			monthStartUtc(now),
			now,
		);
		if (deviceMinutesLeft(plan, usedMinutes) <= 0) {
			throw new HttpException(
				{
					code: "DEVICE_MINUTES_EXHAUSTED",
					message: "No device minutes are left this month",
				},
				HttpStatus.PAYMENT_REQUIRED,
			);
		}

		const deviceSessionId = randomUUID();
		// Appetize bills each device minute, so one user runs one device at a time.
		const locked = await this.lock.acquire(
			scope.userId,
			deviceSessionId,
			DEVICE_SESSION_LOCK_TTL_MS,
		);
		if (!locked) {
			throw new ConflictException({
				code: "DEVICE_SESSION_OPEN",
				message: "A device session is already open",
			});
		}
		try {
			// The phone link lives 60 minutes, longer than the 15-minute session.
			const token = await this.previewTokens.mint(scope, pid, {
				client: "phone",
			});
			const link = await this.previewProxy.mintPhoneLink(
				token.previewUrl,
				token.token,
			);
			if (!(await this.previewProxy.isMetroRunning(link.expoUrl))) {
				throw new ConflictException({
					code: "METRO_NOT_READY",
					message: "The app server is not ready yet",
				});
			}
			await this.sessions.insertOpen({
				id: deviceSessionId,
				organizationId: project.organizationId,
				platform,
				projectId: pid,
				userId: scope.userId,
			});
			return {
				deviceSessionId,
				...APPETIZE_DEVICES[platform],
				launchUrl: link.expoUrl,
				params: EXPO_GO_LAUNCH_PARAMS,
				publicKey,
				timeLimitSeconds: DEVICE_SESSION_TIME_LIMIT_SECONDS,
			};
		} catch (error) {
			// No row exists, so the lock must not block the user until it expires.
			await this.lock
				.release(scope.userId, deviceSessionId)
				.catch((releaseError: unknown) => {
					this.logger.error("device-session.lock-release-failed", {
						deviceSessionId,
						error: getErrorMessage(releaseError),
					});
				});
			throw error;
		}
	}

	/**
	 * Ends a device session of the caller, stores its Appetize token, and
	 * frees the user lock. A repeat is a no-op. 404 for a row of another user
	 * or project; 409 `APPETIZE_SESSION_TAKEN` when another row holds the token.
	 */
	async end(
		scope: ProjectScope,
		projectId: string,
		deviceSessionId: string,
		appetizeSessionToken: string | undefined,
	): Promise<{ ended: true }> {
		const row = await this.sessions.findStartedBy(
			deviceSessionId,
			scope.userId,
			projectId.toLowerCase(),
		);
		if (row === null) {
			throw new NotFoundException();
		}
		try {
			await this.sessions.end(row.id, appetizeSessionToken ?? null, new Date());
		} catch (error) {
			// The unique index keeps one row per Appetize session: one bill per session.
			if (isUniqueViolation(error)) {
				throw new ConflictException({
					code: "APPETIZE_SESSION_TAKEN",
					message: "Another device session holds this Appetize session",
				});
			}
			throw error;
		}
		await this.lock.release(scope.userId, row.id);
		return { ended: true };
	}
}
