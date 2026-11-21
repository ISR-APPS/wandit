// The transactions card of the home: Latest | Upcoming tabs over the newest entries of the three accounts.
// "Latest" lists the posted and returned entries. "Upcoming" lists the pending entries, which post in 1 to 3 bank days.
// OverviewPage renders it in the last band with the rows of transactionsQueryOptions.
import { Link } from "@tanstack/react-router";
import { EntryRows, type Transaction } from "~/features/bank";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardAction,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { CaretRightIcon } from "~/shared/ui/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";

// The card shows as many rows as the side card is high at 1440 px, as in the kit.
const SHOWN_ROWS = 7;

type RecentEntriesCardProps = {
	/** Every entry, newest first. */
	rows: Transaction[];
};

/** The rows touch the card edges, so the tabs and the head keep the card padding. */
export function RecentEntriesCard({ rows }: RecentEntriesCardProps) {
	const { t } = useT();
	const latest = rows
		.filter((row) => row.status !== "pending")
		.slice(0, SHOWN_ROWS);
	// The oldest pending entry posts first, so it leads the list.
	const upcoming = rows
		.filter((row) => row.status === "pending")
		.reverse()
		.slice(0, SHOWN_ROWS);

	return (
		<Card className="gap-4 overflow-hidden pb-0">
			<CardHeader>
				<CardTitle>{t("overview.recent.title")}</CardTitle>
				<CardDescription>{t("overview.recent.description")}</CardDescription>
				<CardAction>
					<Button variant="ghost" size="sm" asChild>
						<Link to="/app/transactions">
							{t("overview.recent.viewAll")}
							<CaretRightIcon className="rtl:rotate-180" />
						</Link>
					</Button>
				</CardAction>
			</CardHeader>
			<Tabs defaultValue="latest" className="gap-3">
				<TabsList className="mx-6">
					<TabsTrigger value="latest">{t("entries.latest")}</TabsTrigger>
					<TabsTrigger value="upcoming">{t("entries.upcoming")}</TabsTrigger>
				</TabsList>
				<TabsContent value="latest" className="border-t">
					<EntryRows rows={latest} emptyText={t("entries.emptyLatest")} />
				</TabsContent>
				<TabsContent value="upcoming" className="border-t">
					<EntryRows rows={upcoming} emptyText={t("entries.emptyUpcoming")} />
				</TabsContent>
			</Tabs>
		</Card>
	);
}
