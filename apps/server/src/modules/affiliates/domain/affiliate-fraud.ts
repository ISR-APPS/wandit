export const AFFILIATE_FRAUD_CODES = [
	"self_referral_user_id",
	"self_referral_email",
] as const;

export type AffiliateFraudCode = (typeof AFFILIATE_FRAUD_CODES)[number];

export type AffiliateFraudFlag = {
	code: AffiliateFraudCode;
	detectedAt: string;
	resolvedAt: string | null;
	resolvedByUserId: string | null;
};

export function parseAffiliateFraudFlags(value: unknown): AffiliateFraudFlag[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((candidate) => {
		if (!candidate || typeof candidate !== "object") {
			return [];
		}

		const flag = candidate as Partial<AffiliateFraudFlag>;

		if (
			!AFFILIATE_FRAUD_CODES.includes(flag.code as AffiliateFraudCode) ||
			typeof flag.detectedAt !== "string"
		) {
			return [];
		}

		return [
			{
				code: flag.code as AffiliateFraudCode,
				detectedAt: flag.detectedAt,
				resolvedAt:
					typeof flag.resolvedAt === "string" ? flag.resolvedAt : null,
				resolvedByUserId:
					typeof flag.resolvedByUserId === "string"
						? flag.resolvedByUserId
						: null,
			},
		];
	});
}

export function hasUnresolvedAffiliateFraudFlags(value: unknown): boolean {
	return parseAffiliateFraudFlags(value).some(
		(flag) => flag.resolvedAt === null,
	);
}

export function appendAffiliateFraudFlag(
	value: unknown,
	code: AffiliateFraudCode,
	now = new Date(),
): AffiliateFraudFlag[] {
	const flags = parseAffiliateFraudFlags(value);

	if (flags.some((flag) => flag.code === code && flag.resolvedAt === null)) {
		return flags;
	}

	return [
		...flags,
		{
			code,
			detectedAt: now.toISOString(),
			resolvedAt: null,
			resolvedByUserId: null,
		},
	];
}

export function affiliateCommissionCanApprove(
	input: {
		attributionStatus: "active" | "voided";
		candidateStatus: "ineligible" | "pending_attribution" | "processed";
		fraudFlags: unknown;
		holdUntil: Date;
		status: "approved" | "paid" | "pending" | "reversed";
	},
	now = new Date(),
): boolean {
	return (
		input.status === "pending" &&
		input.candidateStatus === "processed" &&
		input.holdUntil <= now &&
		input.attributionStatus === "active" &&
		!hasUnresolvedAffiliateFraudFlags(input.fraudFlags)
	);
}
