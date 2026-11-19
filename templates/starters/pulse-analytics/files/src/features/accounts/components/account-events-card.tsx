// The events card of the account page: a small table of the most frequent event types of the last 30 days,
// with the product area as a badge, the share of all events, and the count. AccountOverview renders it.
import { shareFormat } from "~/features/tracking";
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
import type { AccountEventCount } from "../api/accounts.queries";

type AccountEventsCardProps = {
	/** The most frequent event types of the account, the largest first. */
	events: AccountEventCount[];
};

/** No event in the period shows one sentence in place of the table. */
export function AccountEventsCard({ events }: AccountEventsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const share = shareFormat(locale);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.events.title")}</CardTitle>
			</CardHeader>
			<CardContent className="@container/events">
				{events.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("accounts.events.empty")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("accounts.events.event")}</TableHead>
								{/* A narrow card has room for 3 columns only, so the area column shows from a 448 px card. */}
								<TableHead className="@md/events:table-cell hidden">
									{t("accounts.events.area")}
								</TableHead>
								<TableHead className="text-end">
									{t("accounts.events.share")}
								</TableHead>
								<TableHead className="text-end">
									{t("accounts.events.count")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{events.map((event) => (
								<TableRow key={event.eventKey}>
									<TableCell className="font-mono text-xs">
										{event.eventKey}
									</TableCell>
									<TableCell className="@md/events:table-cell hidden">
										<Badge variant="outline">{t(`areas.${event.area}`)}</Badge>
									</TableCell>
									<TableCell className="text-end tabular-nums">
										{share.format(event.share)}
									</TableCell>
									<TableCell className="text-end font-medium tabular-nums">
										{number.format(event.count)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
