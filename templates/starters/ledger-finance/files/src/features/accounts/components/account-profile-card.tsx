// The first card of the account page, in the kit profile card form: the type mark, the name and the type,
// a strip of three figures, and the facts of the account, one per line with an icon.
// AccountDetailPage renders it at the top of the start column.
import {
	BankIcon,
	CalendarBlankIcon,
	CheckCircleIcon,
	ClockIcon,
	HashIcon,
} from "@phosphor-icons/react";
import {
	centsToUnits,
	compactMoneyFormat,
	dayFormat,
	dayToDate,
	fillMessage,
	moneyFormat,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import { ACCOUNT_TYPE_ICONS } from "../lib/account-icons";
import type { AccountSummary } from "../lib/account-summary";

type AccountProfileCardProps = {
	account: AccountSummary;
};

/** A card shows its credit limit as the last fact. The other accounts show their pending entries. */
export function AccountProfileCard({ account }: AccountProfileCardProps) {
	const { t, locale } = useT();
	const compact = compactMoneyFormat(locale);
	const longDay = dayFormat(locale, "long");
	const number = new Intl.NumberFormat(locale);
	const Icon = ACCOUNT_TYPE_ICONS[account.type];
	const figures = [
		{
			label: t("accounts.balance"),
			value: compact.format(centsToUnits(account.balanceCents)),
		},
		{
			label: t("accounts.moneyIn"),
			value: compact.format(centsToUnits(account.moneyInCents)),
		},
		{
			label: t("accounts.moneyOut"),
			value: compact.format(centsToUnits(account.moneyOutCents)),
		},
	];
	const facts = [
		{
			key: "bank",
			icon: BankIcon,
			text: account.institution ?? t("accountTypes.cash"),
		},
		{
			key: "number",
			icon: HashIcon,
			text: account.numberEnding ? `•••• ${account.numberEnding}` : "–",
		},
		{
			key: "opened",
			icon: CalendarBlankIcon,
			text: fillMessage(t("accounts.openedOn"), {
				day: longDay.format(dayToDate(account.openedDay)),
			}),
		},
		{
			key: "reconciled",
			icon: CheckCircleIcon,
			text: account.lastReconciledDay
				? fillMessage(t("accounts.reconciledOn"), {
						day: longDay.format(dayToDate(account.lastReconciledDay)),
					})
				: t("accounts.neverReconciled"),
		},
		{
			key: "last",
			icon: ClockIcon,
			text:
				account.creditLimitCents !== null
					? fillMessage(t("accounts.creditLimitOf"), {
							amount: moneyFormat(locale, 0).format(
								centsToUnits(account.creditLimitCents),
							),
						})
					: fillMessage(t("accounts.pendingCount"), {
							count: number.format(account.pendingCount),
						}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4 text-center">
					<span
						aria-hidden="true"
						className="flex size-20 items-center justify-center rounded-full bg-muted text-muted-foreground"
					>
						<Icon className="size-8" />
					</span>
					<div className="grid gap-1">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							{account.name}
							<Badge variant="info">{t(`accountTypes.${account.type}`)}</Badge>
						</p>
						<p className="text-muted-foreground text-sm">
							{t("accounts.flowNote")}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.label} className="grid gap-0.5 px-2 py-3">
							<dt className="text-muted-foreground text-sm">{figure.label}</dt>
							{/* The value shows above its label, as in the kit. The DOM keeps the label first. */}
							<dd className="order-first font-numeric font-semibold text-lg tabular-nums">
								<bdi dir="ltr">{figure.value}</bdi>
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li key={fact.key} className="flex items-center gap-3 text-sm">
							<fact.icon
								aria-hidden="true"
								className="size-4 shrink-0 text-muted-foreground"
							/>
							<span className="tabular-nums">{fact.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
