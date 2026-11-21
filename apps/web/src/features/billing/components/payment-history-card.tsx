/**
 * Payment history of the active workspace wallet: the last 50 receipts of every provider.
 * The wallet page renders it for a billing manager. Reads useBillingPaymentsQuery.
 * A row shows the date, the method, the money received, the credits, and a reversed or taken-back state.
 */
import type { BillingWalletPayment } from "@wandit/contracts";
import { formatDate, type Locale } from "@wandit/internationalization";
import { Skeleton } from "@wandit/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@wandit/ui/components/table";

import { useBillingPaymentsQuery } from "@/features/billing/api/billing.queries";
import { formatDzd } from "@/features/billing/lib/price-format";
import { formatCreditAmount } from "@/features/credits";
import { useDictionary, useTranslation } from "@/lib/i18n";

/** The wallet page renders it in the history tab, inside the frame of the tab. */
export function PaymentHistoryCard() {
	const copy = useDictionary().billing.payments;
	const paymentsQuery = useBillingPaymentsQuery();

	return (
		<section className="overflow-hidden">
			<div className="border-night/[0.06] border-b px-4 py-4 sm:px-6 dark:border-white/[0.06]">
				<h3 className="font-grotesk font-semibold text-[15px] text-night tracking-[-0.01em] dark:text-foreground">
					{copy.title}
				</h3>
				<p className="mt-0.5 text-night/60 text-sm dark:text-foreground/60">
					{copy.description}
				</p>
			</div>
			{paymentsQuery.isPending ? (
				<div className="grid gap-2 px-4 py-4 sm:px-6" aria-hidden>
					<Skeleton className="h-8 w-full rounded-lg" />
					<Skeleton className="h-8 w-full rounded-lg" />
				</div>
			) : paymentsQuery.isError ? (
				<p
					role="alert"
					className="px-4 py-6 text-muted-foreground text-sm sm:px-6"
				>
					{copy.loadError}
				</p>
			) : paymentsQuery.data.items.length === 0 ? (
				<p className="px-4 py-6 text-muted-foreground text-sm sm:px-6">
					{copy.empty}
				</p>
			) : (
				// The table scrolls inside the card on a phone, so the page never scrolls sideways.
				<div className="overflow-x-auto px-2 py-1 sm:px-4">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{copy.dateLabel}</TableHead>
								<TableHead>{copy.methodLabel}</TableHead>
								<TableHead className="text-end">{copy.amountLabel}</TableHead>
								<TableHead className="text-end">{copy.creditsLabel}</TableHead>
								<TableHead>{copy.stateLabel}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{paymentsQuery.data.items.map((payment) => (
								<PaymentRow key={payment.id} payment={payment} />
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</section>
	);
}

function PaymentRow({ payment }: { payment: BillingWalletPayment }) {
	const { locale, t } = useTranslation();
	const dictionary = useDictionary().billing;
	const copy = dictionary.payments;
	const offlineMethods = dictionary.topup.offline.methods;
	// An offline receipt names the method the admin picked. "slickpay" has no offline label.
	const methodText =
		payment.method !== null && payment.method !== "slickpay"
			? `${copy.providers[payment.provider]} · ${offlineMethods[payment.method]}`
			: copy.providers[payment.provider];

	return (
		<TableRow>
			<TableCell className="whitespace-nowrap">
				{formatDate(payment.paidAt, locale, { dateStyle: "medium" })}
			</TableCell>
			<TableCell className="whitespace-nowrap">{methodText}</TableCell>
			<TableCell className="whitespace-nowrap text-end tabular-nums">
				<span dir="ltr">
					{formatMinorAmount(payment.amountMinor, payment.currency, locale)}
				</span>
			</TableCell>
			<TableCell className="whitespace-nowrap text-end tabular-nums">
				{payment.credits === null
					? "—"
					: formatCreditAmount(payment.credits, locale)}
			</TableCell>
			<TableCell className="whitespace-nowrap">
				{payment.reversedAt !== null
					? t("billing.payments.reversed", {
							date: formatDate(payment.reversedAt, locale, {
								dateStyle: "medium",
							}),
						})
					: payment.revokedCredits !== null && payment.revokedCredits > 0
						? t("billing.payments.revoked", {
								credits: t("credits.creditUnit", {
									count: payment.revokedCredits,
									countDisplay: formatCreditAmount(
										payment.revokedCredits,
										locale,
									),
								}),
							})
						: copy.paid}
			</TableCell>
		</TableRow>
	);
}

/**
 * Formats an amount in the minor unit of `currency` ("usd" cents, "dzd" centimes).
 * Intl gives the number of minor digits of each currency. DZD keeps one format in every locale.
 */
function formatMinorAmount(
	amountMinor: number,
	currency: string,
	locale: Locale,
): string {
	// DZD amounts are never localized (docs/localization.md). 100 centimes make 1 dinar.
	if (currency === "dzd") {
		return formatDzd(amountMinor / 100);
	}
	try {
		const formatter = new Intl.NumberFormat(locale, {
			style: "currency",
			currency: currency.toUpperCase(),
		});
		const fractionDigits =
			formatter.resolvedOptions().maximumFractionDigits ?? 2;

		return formatter.format(amountMinor / 10 ** fractionDigits);
	} catch (error) {
		// Intl throws a RangeError for a code it does not know. The row then shows the raw code and amount.
		if (!(error instanceof RangeError)) {
			throw error;
		}
		return `${currency.toUpperCase()} ${(amountMinor / 100).toFixed(2)}`;
	}
}
