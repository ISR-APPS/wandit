/**
 * Typed client for the SlickPay invoice API (Algerian CIB / Edahabia cards).
 * SlickpayPaymentsService calls `createInvoice` at checkout and `getInvoice` to read the payment state.
 * It calls `fetch` with the SlickPay key as a Bearer token. A contracts schema parses every answer.
 */
/*
 * SlickPay facts, read in the official PHP SDK and WordPress plugin, and checked on the sandbox on 2026-10-07:
 * - POST {base}/<type>/invoices answers { success: 1, message, id, url, invoice }. `url` is the SATIM payment page.
 * - A bad input answers 422 { message, errors }. A user key on merchants/invoices answers 500 "merchant need to add there tpv account".
 * - GET {base}/<type>/invoices/{id} answers { success: 1, completed: 0|1, data }. An unknown id answers 404.
 * - SlickPay does not document its webhook payload, so the API reads the payment state with GET only.
 * No retry: the return page and the sweep call `getInvoice` again.
 */
import {
	type SlickpayCreateInvoiceResponse,
	type SlickpayInvoiceDetailsResponse,
	slickpayCreateInvoiceResponseSchema,
	slickpayErrorBodySchema,
	slickpayInvoiceDetailsResponseSchema,
} from "@wandit/contracts";
import { env } from "@wandit/env/server";
import { getErrorMessage } from "@wandit/observability/error";
import type { z } from "zod";

const SLICKPAY_BASE_URLS = {
	sandbox: "https://devapi.slick-pay.com/api/v2",
	production: "https://prodapi.slick-pay.com/api/v2",
} as const;
// SLICKPAY_ACCOUNT_TYPE selects the path. Each account type can create invoices only on its own path.
const INVOICES_PATHS = {
	merchant: "merchants/invoices",
	user: "users/invoices",
} as const;
// 15 s per call. The sweep has 120 s, so a SlickPay outage ends the sweep early.
const REQUEST_TIMEOUT_MS = 15_000;

/** `SLICKPAY_ENVIRONMENT`. It selects the SlickPay host. */
type SlickpayEnvironment = keyof typeof SLICKPAY_BASE_URLS;

/** One failed SlickPay call. The message never holds the key. Of the response body, it holds only the SlickPay `message`. */
export class SlickpayApiError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SlickpayApiError";
	}
}

/** Constructor input. slickpayClientFromEnv builds it from the server env. */
export type SlickpayClientDeps = {
	/** `SLICKPAY_PUBLIC_KEY`, the SlickPay API key. It stays on the server: it can read every invoice. */
	publicKey: string;
	environment: SlickpayEnvironment;
	/** `SLICKPAY_ACCOUNT_TYPE`: "merchant" for the Wandit production key, "user" for the shared sandbox test key. */
	accountType: keyof typeof INVOICES_PATHS;
};

/** The invoice fields. SlickPay shows them to the buyer and on the merchant dashboard. */
export type SlickpayInvoiceInput = {
	/** Whole DZD. SlickPay charges this exact amount. */
	amountDzd: number;
	/** The web page where SlickPay sends the buyer after the payment. */
	returnUrl: string;
	fullName: string;
	firstName: string;
	lastName: string;
	phone: string;
	email: string;
	/** Free text. The checkout sends "<city>, Algeria". */
	address: string;
	/** The one invoice line, for example "Wandit Pro · 250 credits · monthly". */
	itemName: string;
};

/** The SlickPay invoice calls of wandit. */
export class SlickpayClient {
	constructor(private readonly deps: SlickpayClientDeps) {}

	/** Creates one invoice. The answer holds the invoice id and the hosted payment page URL. */
	async createInvoice(
		input: SlickpayInvoiceInput,
	): Promise<SlickpayCreateInvoiceResponse> {
		return this.request(
			INVOICES_PATHS[this.deps.accountType],
			{
				method: "POST",
				body: JSON.stringify({
					amount: input.amountDzd,
					url: input.returnUrl,
					name: input.fullName,
					firstname: input.firstName,
					lastname: input.lastName,
					phone: input.phone,
					email: input.email,
					address: input.address,
					items: [
						{ name: input.itemName, price: input.amountDzd, quantity: 1 },
					],
				}),
			},
			slickpayCreateInvoiceResponseSchema,
		);
	}

	/** Reads one invoice. Pass the answer to `isSlickpayInvoicePaid`. */
	async getInvoice(invoiceId: string): Promise<SlickpayInvoiceDetailsResponse> {
		return this.request(
			`${INVOICES_PATHS[this.deps.accountType]}/${encodeURIComponent(invoiceId)}`,
			{ method: "GET" },
			slickpayInvoiceDetailsResponseSchema,
		);
	}

	/** One call with the merchant key. Throws `SlickpayApiError` on a failed call or an unexpected body. */
	private async request<Schema extends z.ZodType>(
		path: string,
		init: RequestInit,
		schema: Schema,
	): Promise<z.output<Schema>> {
		// String join, not new URL(path, base): URL resolution drops the "/api/v2" segment of the base.
		const url = `${SLICKPAY_BASE_URLS[this.deps.environment]}/${path}`;
		let response: Response;
		try {
			response = await fetch(url, {
				...init,
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${this.deps.publicKey}`,
					"Content-Type": "application/json",
				},
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			throw new SlickpayApiError(
				`SlickPay ${init.method} ${path} failed: ${getErrorMessage(error)}`,
			);
		}
		if (!response.ok) {
			// A body that is not JSON, or has no message, keeps only the HTTP status in the error.
			const reason = slickpayErrorBodySchema.safeParse(
				await response.json().catch(() => null),
			);
			throw new SlickpayApiError(
				`SlickPay ${init.method} ${path} answered HTTP ${response.status}${reason.success ? `: ${reason.data.message}` : ""}`,
			);
		}
		let body: unknown;
		try {
			body = await response.json();
		} catch (error) {
			throw new SlickpayApiError(
				`SlickPay ${init.method} ${path} answered a body that is not JSON: ${getErrorMessage(error)}`,
			);
		}
		const parsed = schema.safeParse(body);
		if (!parsed.success) {
			throw new SlickpayApiError(
				`SlickPay ${init.method} ${path} answered an unexpected body`,
			);
		}
		return parsed.data;
	}
}

/** Nest token of the SlickPay client. Its value is null when the API has no SlickPay key. */
export const SLICKPAY_CLIENT = Symbol.for("billing.slickpay-client");

/**
 * The client from the server env, or null without `SLICKPAY_PUBLIC_KEY`.
 * Null turns SlickPay off: local pricing answers null, and the checkout answers 503.
 */
export function slickpayClientFromEnv(): SlickpayClient | null {
	if (env.SLICKPAY_PUBLIC_KEY === undefined) {
		return null;
	}
	return new SlickpayClient({
		publicKey: env.SLICKPAY_PUBLIC_KEY,
		environment: env.SLICKPAY_ENVIRONMENT,
		accountType: env.SLICKPAY_ACCOUNT_TYPE,
	});
}
