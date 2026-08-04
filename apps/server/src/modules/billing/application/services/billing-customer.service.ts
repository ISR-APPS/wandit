import { Inject, Injectable, Optional } from "@nestjs/common";
import type { AuthUser } from "@wandit/auth";

import { AffiliatesRepository } from "../../../affiliates/infrastructure/persistence/affiliates.repository";
import { WorkspaceMembersRepository } from "../../../workspaces/infrastructure/persistence/members.repository";

import {
	PAYMENT_PROVIDER,
	type PaymentProvider,
} from "../../domain/ports/payment-provider.port";
import {
	type BillingCustomerRow,
	BillingCustomersRepository,
} from "../../infrastructure/persistence/billing-customers.repository";
import {
	type OrganizationBillingCustomerRow,
	OrganizationBillingCustomersRepository,
} from "../../infrastructure/persistence/organization-billing-customers.repository";

/**
 * The single local get-or-create path for Stripe customers.
 *
 * The database advisory lock serializes callers in this deployment, while the
 * provider idempotency key protects retries that cross process boundaries or
 * fail after Stripe succeeds but before the local mapping is committed.
 */
@Injectable()
export class BillingCustomerService {
	constructor(
		@Inject(BillingCustomersRepository)
		private readonly billingCustomersRepository: BillingCustomersRepository,
		@Inject(PAYMENT_PROVIDER)
		private readonly paymentProvider: PaymentProvider,
		@Inject(OrganizationBillingCustomersRepository)
		private readonly organizationBillingCustomersRepository: OrganizationBillingCustomersRepository,
		@Inject(WorkspaceMembersRepository)
		private readonly workspaceMembersRepository: WorkspaceMembersRepository,
		@Optional()
		@Inject(AffiliatesRepository)
		private readonly affiliatesRepository?: AffiliatesRepository,
	) {}

	ensureCustomer(
		user: Pick<AuthUser, "email" | "id">,
	): Promise<BillingCustomerRow> {
		return this.billingCustomersRepository.withUserLock(user.id, async (tx) => {
			const existing = await this.billingCustomersRepository.findByUserId(
				user.id,
				tx,
			);

			if (existing) {
				return existing;
			}

			const affiliateCode =
				(await this.affiliatesRepository?.affiliateCodeForUser(user.id)) ??
				null;
			const providerCustomerId = affiliateCode
				? await this.paymentProvider.ensureCustomer(
						user.id,
						user.email,
						affiliateCode,
					)
				: await this.paymentProvider.ensureCustomer(user.id, user.email);

			return this.billingCustomersRepository.upsertByUserId(
				{
					provider: "stripe",
					providerCustomerId,
					userId: user.id,
				},
				tx,
			);
		});
	}

	/**
	 * Get-or-create the ORG's Stripe customer (its own table — the personal
	 * path above is byte-identical to pre-teams). The affiliate attribution
	 * human is snapshotted here, permanently: the org's earliest owner-role
	 * member (its creator), NEVER the checkout actor. Only owners can reach
	 * checkout at all (billing is owner-only), but the snapshot keeps the rule
	 * structural rather than incidental.
	 */
	ensureOrgCustomer(
		organizationId: string,
		actor: Pick<AuthUser, "email" | "id">,
	): Promise<OrganizationBillingCustomerRow> {
		return this.organizationBillingCustomersRepository.withOrganizationLock(
			organizationId,
			async (tx) => {
				const existing =
					await this.organizationBillingCustomersRepository.findByOrganizationId(
						organizationId,
						tx,
					);

				if (existing) {
					return existing;
				}

				const organization =
					await this.workspaceMembersRepository.findOrganization(
						organizationId,
					);

				if (!organization) {
					throw new Error(
						`Cannot create a billing customer for unknown organization ${organizationId}`,
					);
				}

				const attributionUserId =
					(await this.workspaceMembersRepository.findEarliestOwnerUserId(
						organizationId,
					)) ?? actor.id;
				// The affiliate code follows the attribution user — commissions do too.
				const affiliateCode =
					(await this.affiliatesRepository?.affiliateCodeForUser(
						attributionUserId,
					)) ?? null;
				const providerCustomerId =
					await this.paymentProvider.ensureOrganizationCustomer({
						affiliateCode,
						attributionUserId,
						billingEmail: actor.email,
						createdByUserId: actor.id,
						organizationId,
						organizationName: organization.name,
					});

				return this.organizationBillingCustomersRepository.upsertByOrganizationId(
					{
						attributionUserId,
						createdByUserId: actor.id,
						organizationId,
						provider: "stripe",
						providerCustomerId,
					},
					tx,
				);
			},
		);
	}
}
