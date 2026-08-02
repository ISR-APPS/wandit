const DAY_MS = 24 * 60 * 60 * 1000;

export type DomainRenewalNoticeCandidate = {
	expiresAt: Date | null;
	id: string;
	source: string;
	status: string;
};

export interface DomainRenewalNoticesStore {
	findExpiringPurchased(
		now: Date,
	): Promise<readonly DomainRenewalNoticeCandidate[]>;
	recordRenewalNotice(id: string, message: string): Promise<unknown>;
}

export type DomainRenewalNoticesResult = {
	noticed: number;
	processed: true;
};

export class DomainRenewalNoticesService {
	constructor(private readonly domains: DomainRenewalNoticesStore) {}

	async execute(now = new Date()): Promise<DomainRenewalNoticesResult> {
		// Paid renewals are not wired yet, so this sweep records notices only.
		const candidates = await this.domains.findExpiringPurchased(now);
		let noticed = 0;

		for (const candidate of candidates) {
			if (
				candidate.source !== "purchased" ||
				(candidate.status !== "active" && candidate.status !== "expired")
			) {
				continue;
			}

			if (!candidate.expiresAt) {
				continue;
			}

			const daysUntilExpiry = Math.ceil(
				(candidate.expiresAt.getTime() - now.getTime()) / DAY_MS,
			);

			if (daysUntilExpiry > 30) {
				continue;
			}

			await this.domains.recordRenewalNotice(
				candidate.id,
				`Domain expires in ${Math.max(daysUntilExpiry, 0)} day(s); automatic renewal is not available yet`,
			);
			noticed += 1;
		}

		return { noticed, processed: true };
	}
}
