// The accounts page behind login: the position of the business, then one row per account.
// The /app/accounts route renders it after its loader. The route also uses the skeleton and the error below.
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { PageHeader } from "~/features/app-shell";
import { dayFormat, dayToDate, fillMessage } from "~/features/ledger";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "~/shared/ui/card";
import { Skeleton } from "~/shared/ui/skeleton";
import { accountsQueryOptions } from "../api/accounts.queries";
import { AccountRow } from "./account-row";
import { PositionCard } from "./position-card";

/** The page. The position panel sums the same balances that the rows show. */
export function AccountsPage() {
	const { t, locale } = useT();
	const { data } = useSuspenseQuery(accountsQueryOptions());

	return (
		<div className="grid grid-cols-1 gap-6">
			<PageHeader
				title={t("accounts.title")}
				description={fillMessage(t("accounts.description"), {
					day: dayFormat(locale, "long").format(dayToDate(data.today)),
				})}
			/>
			<PositionCard position={data.position} accounts={data.accounts} />
			<Card className="gap-0 overflow-hidden pb-0">
				<CardHeader className="pb-5">
					<CardTitle>{t("accounts.listTitle")}</CardTitle>
					<CardDescription>{t("accounts.listDescription")}</CardDescription>
				</CardHeader>
				<ul className="border-t">
					{data.accounts.map((account) => (
						<AccountRow key={account.id} account={account} />
					))}
				</ul>
			</Card>
		</div>
	);
}

// Placeholder rows of the skeleton. Fixed keys, because the rows never reorder.
const SKELETON_ROWS = ["1", "2", "3", "4"];

/** Placeholder while the accounts loader runs. The route sets it as pendingComponent. */
export function AccountsPageSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-6">
			<div className="grid gap-2">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-4 w-64 max-w-full" />
			</div>
			<Skeleton className="h-48 w-full" />
			<Card>
				<div className="grid gap-3 px-6">
					{SKELETON_ROWS.map((key) => (
						<Skeleton key={key} className="h-16 w-full" />
					))}
				</div>
			</Card>
		</div>
	);
}

/** Error state of the accounts pages when a loader fails. Try again runs the loader again. */
export function AccountsPageError() {
	const { t } = useT();
	const router = useRouter();
	return (
		<div className="grid justify-items-start gap-4">
			<p role="alert">{t("accounts.loadError")}</p>
			<Button type="button" onClick={() => router.invalidate()}>
				{t("common.retry")}
			</Button>
		</div>
	);
}
