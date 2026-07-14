import type { CreditBucket } from "@wandit/contracts";

export const CREDITS_PORT = Symbol("CREDITS_PORT");

type CreditMeta = Record<string, unknown> & {
	reason?: unknown;
};

type CreditWriteOptions = {
	idempotencyKey?: string;
	meta?: CreditMeta;
};

type GrantCreditOptions = CreditWriteOptions & {
	bucket: CreditBucket;
};

export interface CreditsPort {
	consume(
		userId: string,
		amount: number,
		options?: CreditWriteOptions,
	): Promise<unknown>;
	grant(
		userId: string,
		amount: number,
		options: GrantCreditOptions,
	): Promise<unknown>;
}
