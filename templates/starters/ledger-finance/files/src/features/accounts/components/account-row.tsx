// One account of the accounts page: its name and bank, the balance curve, the flow of 30 days, and the balance.
// AccountsPage renders one row per account inside one panel. The whole row opens the detail page of the account.
import { Link } from "@tanstack/react-router";
import {
	dayFormat,
	dayToDate,
	fillMessage,
	MoneyText,
} from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { CaretRightIcon } from "~/shared/ui/icons";
import { ACCOUNT_TYPE_ICONS } from "../lib/account-icons";
import type { AccountSummary } from "../lib/account-summary";
import { BalanceSparkline } from "./balance-sparkline";

type AccountRowProps = {
	account: AccountSummary;
};

/** A wide row has five columns. Under 56rem the curve and the flow move under the name. */
export function AccountRow({ account }: AccountRowProps) {
	const { t, locale } = useT();
	const day = dayFormat(locale);
	const Icon = ACCOUNT_TYPE_ICONS[account.type];

	return (
		<li className="border-t first:border-t-0">
			<Link
				to="/app/accounts/$accountId"
				params={{ accountId: account.id }}
				className="grid @4xl/main:grid-cols-[minmax(0,1.9fr)_minmax(0,0.9fr)_minmax(0,0.7fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_auto] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 px-6 py-5 outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
			>
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-muted text-muted-foreground">
						<Icon className="size-5" />
					</span>
					<div className="grid min-w-0 gap-1">
						{/* A narrow row has no room for the badge next to a long name, so the type moves into the second line. */}
						<div className="flex items-center gap-2">
							<bdi className="truncate font-medium">{account.name}</bdi>
							<Badge
								variant="secondary"
								className="@4xl/main:inline-flex hidden"
							>
								{t(`accountTypes.${account.type}`)}
							</Badge>
						</div>
						<p className="text-muted-foreground text-xs">
							<span className="@4xl/main:hidden">
								{`${t(`accountTypes.${account.type}`)} · `}
							</span>
							{account.institution ? (
								<>
									<bdi>{account.institution}</bdi>
									<span className="tabular-nums">{` •••• ${account.numberEnding ?? ""}`}</span>
									{" · "}
								</>
							) : null}
							{account.lastReconciledDay
								? fillMessage(t("accounts.reconciledOn"), {
										day: day.format(dayToDate(account.lastReconciledDay)),
									})
								: t("accounts.neverReconciled")}
						</p>
					</div>
				</div>
				<div className="@4xl/main:order-none order-last @4xl/main:col-span-1 col-span-2 min-w-0">
					<BalanceSparkline
						accountName={account.name}
						balances={account.balances}
						isDebt={account.type === "credit_card"}
					/>
				</div>
				<div className="@4xl/main:order-none order-last grid gap-1 @4xl/main:text-end">
					<p className="text-muted-foreground text-xs">
						{t("accounts.moneyIn")}
					</p>
					<MoneyText
						amountCents={account.moneyInCents}
						sign="always"
						className="text-sm text-success"
					/>
				</div>
				<div className="@4xl/main:order-none order-last grid gap-1 text-end">
					<p className="text-muted-foreground text-xs">
						{t("accounts.moneyOut")}
					</p>
					<MoneyText amountCents={-account.moneyOutCents} className="text-sm" />
				</div>
				<div className="grid gap-1 text-end">
					<p className="text-muted-foreground text-xs">
						{t(
							account.type === "credit_card"
								? "accounts.owed"
								: "accounts.balance",
						)}
					</p>
					<MoneyText
						amountCents={Math.abs(account.balanceCents)}
						className="font-medium text-lg"
					/>
				</div>
				<CaretRightIcon className="@4xl/main:block hidden size-4 text-muted-foreground rtl:rotate-180" />
			</Link>
		</li>
	);
}
