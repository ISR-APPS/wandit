import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";
import {
	type BillingPlanId,
	type CreateManualSubscriptionRequestBody,
	type ManualSubscriptionRequest,
	type ManualSubscriptionRequestViewResponse,
	SUBSCRIPTION_PROVIDERS,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";

import { AnalyticsService } from "../../../../infrastructure/analytics/analytics.service";
import {
	type CreditOwner,
	orgOwner,
	userOwner,
} from "../../../credits/domain/credit-owner";
import { EmailService } from "../../../email/application/services/email.service";
import { ProductSettingsService } from "../../../settings/application/services/product-settings.service";
import { ManualPaymentsDisabledError } from "../../../settings/domain/errors/manual-payments-disabled.error";
import { OrganizationsDisabledError } from "../../../settings/domain/errors/organizations-disabled.error";
import { WorkspaceNotSupportedError } from "../../../workspaces/domain/errors/workspace.errors";
import type { WorkspaceContext } from "../../../workspaces/domain/workspace-context";
import { ActiveSubscriptionExistsError } from "../../domain/errors/active-subscription-exists.error";
import {
	ManualRequestPendingError,
	NoActiveManualRequestError,
} from "../../domain/errors/manual-billing.errors";
import {
	type ManualSubscriptionRequestRow,
	ManualSubscriptionRequestsRepository,
} from "../../infrastructure/persistence/manual-subscription-requests.repository";
import { SubscriptionCreditsRepository } from "../../infrastructure/persistence/subscription-credits.repository";
import { SubscriptionsRepository } from "../../infrastructure/persistence/subscriptions.repository";

type BillingScope = {
	organizationId: string | null;
	owner: CreditOwner;
};

@Injectable()
export class ManualSubscriptionRequestsService {
	private readonly logger = new Logger(ManualSubscriptionRequestsService.name);

	constructor(
		@Inject(ManualSubscriptionRequestsRepository)
		private readonly requestsRepository: ManualSubscriptionRequestsRepository,
		@Inject(SubscriptionsRepository)
		private readonly subscriptionsRepository: SubscriptionsRepository,
		@Inject(SubscriptionCreditsRepository)
		private readonly subscriptionCreditsRepository: SubscriptionCreditsRepository,
		@Inject(ProductSettingsService)
		private readonly productSettingsService: ProductSettingsService,
		@Inject(EmailService)
		private readonly emailService: EmailService,
		@Inject(AnalyticsService)
		private readonly analytics: AnalyticsService,
	) {}

	async getCurrent(
		user: Pick<AuthUser, "id">,
		workspace?: WorkspaceContext,
	): Promise<ManualSubscriptionRequestViewResponse> {
		const scope = this.resolveBillingScope(user, workspace);
		const request = await this.requestsRepository.findOpenByOwner(scope.owner);

		return { request: request ? mapManualRequest(request) : null };
	}

	async create(
		user: Pick<AuthUser, "id">,
		body: CreateManualSubscriptionRequestBody,
		workspace?: WorkspaceContext,
	): Promise<ManualSubscriptionRequestViewResponse> {
		const settings = await this.productSettingsService.get();

		if (!settings.manualPaymentsEnabled) {
			throw new ManualPaymentsDisabledError();
		}

		const scope = this.resolveBillingScope(user, workspace);

		if (scope.organizationId && !settings.organizationsEnabled) {
			throw new OrganizationsDisabledError();
		}

		this.assertPlanMatchesScope(body.plan, scope.organizationId);

		const request = await this.subscriptionCreditsRepository.withOwnerLock(
			scope.owner,
			async (tx) => {
				const subscription =
					await this.subscriptionsRepository.findActiveByOwner(scope.owner, tx);

				if (
					subscription &&
					subscription.provider !== SUBSCRIPTION_PROVIDERS.manual
				) {
					throw new ActiveSubscriptionExistsError();
				}

				if (await this.requestsRepository.findOpenByOwner(scope.owner, tx)) {
					throw new ManualRequestPendingError();
				}

				try {
					return await this.requestsRepository.insert(
						{
							city: body.city ?? null,
							company: body.company ?? null,
							country: body.country,
							fullName: body.fullName,
							interval: body.interval,
							notes: body.notes ?? null,
							organizationId: scope.organizationId,
							phone: body.phone,
							plan: body.plan,
							preferredPaymentMethod: body.preferredPaymentMethod ?? null,
							status: "pending",
							tierCredits: body.tierCredits,
							userId: user.id,
						},
						tx,
					);
				} catch (error) {
					if (isUniqueViolation(error)) {
						throw new ManualRequestPendingError();
					}

					throw error;
				}
			},
		);

		this.captureRequested(user.id, body);
		this.notifyAdmins(request);

		return { request: mapManualRequest(request) };
	}

	async cancel(
		user: Pick<AuthUser, "id">,
		workspace?: WorkspaceContext,
	): Promise<ManualSubscriptionRequestViewResponse> {
		const scope = this.resolveBillingScope(user, workspace);
		const canceled = await this.subscriptionCreditsRepository.withOwnerLock(
			scope.owner,
			(tx) => this.requestsRepository.cancelOpenByOwner(scope.owner, tx),
		);

		if (!canceled) {
			throw new NoActiveManualRequestError();
		}

		return { request: null };
	}

	private resolveBillingScope(
		user: Pick<AuthUser, "id">,
		workspace: WorkspaceContext | undefined,
	): BillingScope {
		if (workspace?.kind !== "org") {
			return { organizationId: null, owner: userOwner(user.id) };
		}

		return {
			organizationId: workspace.organizationId,
			owner: orgOwner(workspace.organizationId),
		};
	}

	private assertPlanMatchesScope(
		plan: BillingPlanId,
		organizationId: string | null,
	): void {
		const supported = organizationId
			? plan === "business"
			: plan === "starter" || plan === "pro";

		if (!supported) {
			throw new WorkspaceNotSupportedError(
				organizationId
					? "Organization workspaces support the Business plan only"
					: "Personal workspaces support the Starter and Pro plans only",
			);
		}
	}

	private captureRequested(
		userId: string,
		body: CreateManualSubscriptionRequestBody,
	): void {
		try {
			this.analytics.capture(userId, "manual_subscription_requested", {
				country: body.country,
				interval: body.interval,
				plan: body.plan,
				tierCredits: body.tierCredits,
			});
		} catch (error) {
			this.logger.warn(
				`Manual subscription request analytics failed for ${userId}`,
				error,
			);
		}
	}

	private notifyAdmins(request: ManualSubscriptionRequestRow): void {
		try {
			const recipients = parseAdminEmails(env.ADMIN_EMAILS);

			if (recipients.length === 0 || !this.emailService.isDeliverable()) {
				return;
			}

			const adminUrl = new URL(
				"/offline-billing",
				env.ADMIN_ORIGIN ?? env.CORS_ORIGIN,
			).toString();
			void this.emailService
				.sendManualRequestEmail(recipients, {
					adminUrl,
					fullName: request.fullName,
					interval: request.interval,
					phone: request.phone,
					plan: request.plan,
					tierCredits: request.tierCredits,
				})
				.catch((error: unknown) => {
					this.logger.warn(
						`Manual subscription request email failed for ${request.id}`,
						error,
					);
				});
		} catch (error) {
			this.logger.warn(
				`Manual subscription request email setup failed for ${request.id}`,
				error,
			);
		}
	}
}

function mapManualRequest(
	row: ManualSubscriptionRequestRow,
): ManualSubscriptionRequest {
	return {
		city: row.city,
		company: row.company,
		country: row.country,
		createdAt: row.createdAt.toISOString(),
		fullName: row.fullName,
		handledAt: row.handledAt?.toISOString() ?? null,
		id: row.id,
		interval: row.interval,
		notes: row.notes,
		organizationId: row.organizationId,
		phone: row.phone,
		plan: row.plan,
		preferredPaymentMethod: row.preferredPaymentMethod,
		status: row.status,
		subscriptionId: row.subscriptionId,
		tierCredits: row.tierCredits,
		updatedAt: row.updatedAt.toISOString(),
	};
}

function parseAdminEmails(raw: string | undefined): string[] {
	return [
		...new Set(
			(raw ?? "")
				.split(",")
				.map((email) => email.trim())
				.filter((email) => email.length > 0 && email.includes("@")),
		),
	];
}

function isUniqueViolation(error: unknown): boolean {
	let current: unknown = error;

	for (let depth = 0; depth < 5 && current; depth += 1) {
		if (
			typeof current === "object" &&
			"code" in current &&
			(current as { code?: unknown }).code === "23505"
		) {
			return true;
		}

		current =
			typeof current === "object" && "cause" in current
				? (current as { cause?: unknown }).cause
				: null;
	}

	return false;
}
