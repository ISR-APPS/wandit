import type {
	AdminManualPayment,
	AdminManualSubscriptionDetail,
	BillingInterval,
	BillingPlanId,
	ManualPaymentMethod,
} from "@wandit/contracts";

import { currencyMinorFactor, MANUAL_COUNTRY_LABELS } from "./offline-billing";

const RECEIPT_TIME_ZONE = "Africa/Algiers";

const receiptDateFormatter = new Intl.DateTimeFormat("fr-FR", {
	day: "2-digit",
	month: "long",
	timeZone: RECEIPT_TIME_ZONE,
	year: "numeric",
});

const receiptDateTimeFormatter = new Intl.DateTimeFormat("fr-FR", {
	day: "2-digit",
	hour: "2-digit",
	hour12: false,
	minute: "2-digit",
	month: "long",
	timeZone: RECEIPT_TIME_ZONE,
	year: "numeric",
});

const FRENCH_PAYMENT_KIND_LABELS: Record<AdminManualPayment["kind"], string> = {
	initial: "Paiement initial",
	renewal: "Renouvellement",
};

const FRENCH_PAYMENT_METHOD_LABELS: Record<ManualPaymentMethod, string> = {
	cash_on_delivery: "Paiement à la livraison",
	bank_transfer: "Virement bancaire",
	ccp: "CCP",
	baridimob: "BaridiMob",
	other: "Autre",
};

const FRENCH_BILLING_INTERVAL_LABELS: Record<BillingInterval, string> = {
	month: "Mensuel",
	year: "Annuel",
};

const FRENCH_COUNTRY_LABELS_BY_ENGLISH: Record<string, string> = {
	Algeria: "Algérie",
	Morocco: "Maroc",
	Other: "Autre",
	Tunisia: "Tunisie",
};

// Mirrors the content of packages/internationalization/dictionaries/fr/billing.json
// with typographic apostrophes. The shared package exposes localized dictionaries
// through an async loader, while these receipt features are static and needed
// synchronously during rendering.
export const RECEIPT_PLAN_FEATURES = {
	starter: [
		"60 crédits chaque mois",
		"Pages de boutique créées par l’IA en quelques minutes",
		"Images produit et textes marketing par l’IA",
		"Domaine personnalisé inclus",
		"CRM de leads pour les commandes",
		"Publication toujours gratuite",
	],
	pro: [
		"De nouveaux crédits chaque mois",
		"Outils marketing & campagnes IA",
		"Génération d’images et de vidéos IA",
		"Bibliothèque d’assets",
		"Domaines personnalisés",
		"Connexion d’apps & intégrations",
		"CRM de leads pour vos commandes",
		"Publication toujours gratuite",
	],
	business: [
		"Tout ce qui est inclus dans Pro",
		"Un pool de crédits partagé pour toute l’équipe",
		"Rôles, invitations et limites par membre",
		"Sièges illimités — payez les crédits, pas les personnes",
	],
} as const satisfies Record<BillingPlanId, readonly string[]>;

export type ReceiptCurrencyTotal = {
	currency: string;
	amountMinor: number | null;
};

type ConvertedReceiptPaymentAmount = {
	currency: string;
	amountMinor: number;
};

type ReceiptCustomerDetail = {
	request: Pick<
		NonNullable<AdminManualSubscriptionDetail["request"]>,
		"fullName"
	> | null;
	user: Pick<AdminManualSubscriptionDetail["user"], "email" | "name">;
};

/** Build the customer-facing number from a validated receipt source UUID. */
export function createReceiptNumber(sourceId: string): string {
	const compactId = sourceId.trim().replaceAll("-", "");

	if (!/^[\da-f]{32}$/i.test(compactId)) {
		return "REC-UNKNOWN";
	}

	return `REC-${compactId.slice(0, 8).toUpperCase()}`;
}

export function formatReceiptDate(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;

	return Number.isFinite(date.getTime())
		? receiptDateFormatter.format(date)
		: "—";
}

export function formatReceiptDateTime(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;

	return Number.isFinite(date.getTime())
		? receiptDateTimeFormatter.format(date)
		: "—";
}

export function formatReceiptAmount(
	amountMinor: number,
	currency: string,
): string {
	const major = amountMinor / currencyMinorFactor(currency);

	try {
		return new Intl.NumberFormat("fr-FR", {
			style: "currency",
			currency,
			currencyDisplay: "code",
		}).format(major);
	} catch {
		return `${major.toLocaleString("fr-FR", {
			maximumFractionDigits: 2,
			minimumFractionDigits: 2,
		})} ${currency}`;
	}
}

export function formatWholeDzdAmount(amountDzd: number): string {
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "DZD",
		currencyDisplay: "code",
		maximumFractionDigits: 0,
		minimumFractionDigits: 0,
	}).format(amountDzd);
}

export function computeDzdPlanPrice(
	priceUsd: number,
	dzdPerUsdRate: number,
): number {
	return Math.round(priceUsd * dzdPerUsdRate);
}

export function getReceiptCustomerName(
	subscription: ReceiptCustomerDetail,
): string {
	return (
		subscription.request?.fullName ||
		subscription.user.name ||
		subscription.user.email
	);
}

export function convertReceiptPaymentAmount(
	payment: Pick<AdminManualPayment, "amountMinor" | "currency">,
	dzdPerUsdRate?: number,
): ConvertedReceiptPaymentAmount | null {
	const currency = payment.currency.trim().toUpperCase();

	if (currency !== "USD") {
		return { amountMinor: payment.amountMinor, currency };
	}

	if (dzdPerUsdRate === undefined) {
		return null;
	}

	const usdMajor = payment.amountMinor / currencyMinorFactor("USD");
	const amountDzd = computeDzdPlanPrice(usdMajor, dzdPerUsdRate);

	return {
		amountMinor: amountDzd * currencyMinorFactor("DZD"),
		currency: "DZD",
	};
}

export function getFrenchPaymentKindLabel(
	kind: AdminManualPayment["kind"],
): string {
	return FRENCH_PAYMENT_KIND_LABELS[kind];
}

export function getFrenchPaymentMethodLabel(
	method: ManualPaymentMethod,
): string {
	return FRENCH_PAYMENT_METHOD_LABELS[method];
}

export function getFrenchBillingIntervalLabel(
	interval: BillingInterval,
): string {
	return FRENCH_BILLING_INTERVAL_LABELS[interval];
}

export function getFrenchCountryLabel(country: string): string {
	const countryCode = country.trim().toUpperCase();
	const existingLabel = MANUAL_COUNTRY_LABELS[countryCode];
	const fallbackLabel = existingLabel
		? (FRENCH_COUNTRY_LABELS_BY_ENGLISH[existingLabel] ?? existingLabel)
		: country.trim();

	if (countryCode === "OTHER" || countryCode.length !== 2) {
		return fallbackLabel;
	}

	try {
		return (
			new Intl.DisplayNames("fr-FR", { type: "region" }).of(countryCode) ??
			fallbackLabel
		);
	} catch {
		return fallbackLabel;
	}
}

export function groupPaymentTotalsByCurrency(
	payments: readonly Pick<AdminManualPayment, "amountMinor" | "currency">[],
	dzdPerUsdRate?: number,
): ReceiptCurrencyTotal[] {
	const totals = new Map<string, number | null>();

	for (const payment of payments) {
		const converted = convertReceiptPaymentAmount(payment, dzdPerUsdRate);

		if (!converted) {
			// USD payments are shown in DZD on the receipt. Without a rate, the
			// complete DZD total is unknown and a partial total would be misleading.
			totals.set("DZD", null);
			continue;
		}

		const currentTotal = totals.get(converted.currency);

		if (currentTotal === null) {
			continue;
		}

		totals.set(converted.currency, (currentTotal ?? 0) + converted.amountMinor);
	}

	return [...totals]
		.map(([currency, amountMinor]) => ({ currency, amountMinor }))
		.sort((left, right) => left.currency.localeCompare(right.currency));
}
