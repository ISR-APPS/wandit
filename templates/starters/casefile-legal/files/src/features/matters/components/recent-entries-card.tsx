// The last time entries of one matter in a small table: the work, the billing state, and the day.
// MatterDetailPage renders it under the activity card, as the kit "transaction history" card.
// The Time entries tab of the same page lists every entry.
import { dayToDate } from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import { ENTRY_STATE_BADGE, entryBillingState } from "../lib/entry-billing";
import type { TimeEntryLine } from "../lib/matter-joins";

// Six rows keep the card as high as the deadline card beside it, as in the kit.
const SHOWN_ENTRIES = 6;

type RecentEntriesCardProps = {
	/** Newest first. */
	entries: TimeEntryLine[];
};

/** The table scrolls inside the card on a phone, never the page. */
export function RecentEntriesCard({ entries }: RecentEntriesCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.recentEntries")}</CardTitle>
			</CardHeader>
			<CardContent>
				{entries.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("matters.noEntries")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("matters.work")}</TableHead>
								<TableHead>{t("matters.status")}</TableHead>
								<TableHead className="text-end">{t("matters.date")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{entries.slice(0, SHOWN_ENTRIES).map((entry) => {
								const state = entryBillingState(entry);
								return (
									<TableRow key={entry.id}>
										{/* w-full gives the work the space that is left. A long text wraps, so the date column always shows. */}
										<TableCell className="w-full whitespace-normal" dir="auto">
											{entry.description}
										</TableCell>
										<TableCell>
											<Badge variant={ENTRY_STATE_BADGE[state]}>
												{t(`matters.entryStates.${state}`)}
											</Badge>
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{date.format(dayToDate(entry.day))}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
