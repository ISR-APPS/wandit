import { domainDnsSchema } from "@wandit/contracts";

import {
	DOMAIN_VALIDATION_RECORD_PURPOSE,
	mergeRequiredDomainRecords,
	validationRequiredDomainRecords,
} from "../../domain/domain-provisioning-rules";
import type { DomainDnsRecord } from "../../domain/ports/domain-provider.port";
import type {
	CustomHostnameResult,
	DomainFulfillmentDns,
	DomainFulfillmentLogger,
	DomainFulfillmentPatch,
	DomainFulfillmentRow,
} from "./domain-fulfillment.contracts";

type CustomHostnameProvider = {
	createCustomHostname(host: string): Promise<CustomHostnameResult>;
	deleteCustomHostname(id: string): Promise<void>;
	getCustomHostnameStatus(id: string): Promise<CustomHostnameResult>;
};

type CustomHostnameDnsProvider = {
	setDnsRecords(name: string, records: DomainDnsRecord[]): Promise<void>;
};

type CustomHostnameConfigurationState = {
	updatePostRegistrationState(
		row: DomainFulfillmentRow,
		patch: DomainFulfillmentPatch,
	): Promise<DomainFulfillmentRow>;
};

export class CustomHostnameConfigurationStep {
	constructor(
		private readonly customHostnames: CustomHostnameProvider,
		private readonly dnsProvider: CustomHostnameDnsProvider,
		private readonly state: CustomHostnameConfigurationState,
		private readonly logger: DomainFulfillmentLogger,
	) {}

	async execute(row: DomainFulfillmentRow): Promise<DomainFulfillmentRow> {
		let current = row;

		if (!current.cfCustomHostnameId) {
			const hostname = await this.customHostnames.createCustomHostname(
				current.name,
			);
			const dns = this.dnsState(current);
			const validationRecords = validationRequiredDomainRecords(
				hostname.requiredRecords,
			);

			try {
				current = await this.state.updatePostRegistrationState(current, {
					cfCustomHostnameId: hostname.id,
					dns: {
						...dns,
						records: mergeRequiredDomainRecords(
							dns.records ?? [],
							validationRecords,
						),
					},
				});
			} catch (error) {
				await this.deleteUnclaimedHostname(hostname.id);
				throw error;
			}
		}

		let dns = this.dnsState(current);

		if (dns.customHostnameDnsConfigured) {
			return current;
		}

		let validationRecords = (dns.records ?? []).filter(
			(record) => record.purpose === DOMAIN_VALIDATION_RECORD_PURPOSE,
		);

		if (validationRecords.length === 0 && current.cfCustomHostnameId) {
			const hostname = await this.customHostnames.getCustomHostnameStatus(
				current.cfCustomHostnameId,
			);
			validationRecords = validationRequiredDomainRecords(
				hostname.requiredRecords,
			);
			dns = {
				...dns,
				records: mergeRequiredDomainRecords(
					dns.records ?? [],
					validationRecords,
				),
			};
		}

		if (validationRecords.length > 0) {
			await this.dnsProvider.setDnsRecords(
				current.name,
				validationRecords.map((record) => ({
					name: record.name,
					type: record.type,
					value: record.value,
				})),
			);
		}

		return this.state.updatePostRegistrationState(current, {
			dns: { ...dns, customHostnameDnsConfigured: true },
		});
	}

	private async deleteUnclaimedHostname(id: string): Promise<void> {
		try {
			await this.customHostnames.deleteCustomHostname(id);
		} catch (error) {
			this.logger.warn(
				`Failed to delete unclaimed Cloudflare custom hostname ${id}`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	private dnsState(row: DomainFulfillmentRow): DomainFulfillmentDns {
		const parsed = domainDnsSchema.safeParse(row.dns);

		return parsed.success ? parsed.data : {};
	}
}
