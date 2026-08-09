import {
	DOMAIN_TLD_CATALOG,
	parseDomainName,
	type Registrant,
	registrantSchema,
} from "@wandit/contracts";

import { wholesaleQuoteBlockReason } from "../../domain/domain-provisioning-rules";
import type {
	DomainAvailability,
	DomainRegistrationOptions,
	DomainRegistrationResult,
} from "../../domain/ports/domain-provider.port";
import type {
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";
import { TerminalDomainFulfillmentError } from "./domain-fulfillment.errors";

type DomainRegistrationProvider = {
	checkAvailability(names: string[]): Promise<DomainAvailability[]>;
	getDomainInfo(name: string): Promise<unknown | null>;
	register(
		name: string,
		registrant: Registrant,
		options: DomainRegistrationOptions,
	): Promise<DomainRegistrationResult>;
};

type DomainRegistrationState = {
	assertRegistrationOrderStillFulfilling(orderId: string): Promise<void>;
	updatePostRegistrationState(
		row: DomainFulfillmentRow,
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow>;
};

export class DomainRegistrationStep {
	constructor(
		private readonly provider: DomainRegistrationProvider,
		private readonly state: DomainRegistrationState,
	) {}

	async execute(
		row: DomainFulfillmentRow,
		orderId: string | null,
	): Promise<DomainFulfillmentRow> {
		if (row.providerDomainId) {
			return row;
		}

		await this.assertRegistrationAllowed(row);

		const registrant = registrantSchema.safeParse(row.registrant);

		if (!registrant.success) {
			throw new TerminalDomainFulfillmentError(
				"Registrant snapshot is invalid",
			);
		}

		if (orderId) {
			await this.state.assertRegistrationOrderStillFulfilling(orderId);
		}

		const registered = await this.provider.register(row.name, registrant.data, {
			idempotencyKey: `domain-purchase:${row.id}`,
			privacy: row.whoisPrivacy,
			years: 1,
		});

		return this.state.updatePostRegistrationState(
			row,
			this.registrationPatch(registered),
		);
	}

	private async assertRegistrationAllowed(
		row: DomainFulfillmentRow,
	): Promise<void> {
		const existing = await this.provider.getDomainInfo(row.name);

		if (existing) {
			return;
		}

		const [availability] = await this.provider.checkAvailability([row.name]);

		if (!availability?.available) {
			throw new TerminalDomainFulfillmentError("Domain is not available");
		}

		const parsed = parseDomainName(row.name);

		if (!parsed) {
			throw new TerminalDomainFulfillmentError(
				"Domain is not in the supported catalog",
			);
		}

		const ceiling = DOMAIN_TLD_CATALOG[parsed.tld].wholesaleCeilingUsd;

		if (wholesaleQuoteBlockReason(availability, ceiling)) {
			throw new TerminalDomainFulfillmentError(
				"Domain price is premium, missing, or above the catalog safety ceiling",
			);
		}
	}

	private registrationPatch(
		registered: DomainRegistrationResult,
	): DomainFulfillmentPatch {
		return {
			expiresAt: registered.expiresAt,
			providerDomainId: registered.providerDomainId,
			providerOrderId: registered.providerOrderId ?? null,
			providerTotalPaidUsd:
				registered.totalPaidUsd === undefined
					? null
					: registered.totalPaidUsd.toFixed(2),
			transferLockExpiresAt: registered.transferLockExpiresAt ?? null,
		};
	}
}
