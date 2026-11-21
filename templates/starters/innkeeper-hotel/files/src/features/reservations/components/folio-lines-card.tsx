// The folio lines card of the reservation page: a short table of the newest charges with a kind badge.
// ReservationDetailPage renders it at the start of the row under the latest activity card.
// It follows the transaction history card of the kit. The Folio tab shows every line with the payments.
import { dayToDate, type FolioCharge, moneyFormat } from "~/features/hotel";
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

// The card shows the newest lines only, as the six rows of the kit table.
const SHOWN_LINES = 6;

type FolioLinesCardProps = {
	/** The folio lines of the stay, the stay charges first, then the extras by date. */
	charges: FolioCharge[];
};

/** A stay line has the "Stay" badge, an extra the "Extra" badge. */
export function FolioLinesCard({ charges }: FolioLinesCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
	});
	// Newest day first. The sort is stable, so on one day the folio order stays: room nights before city tax.
	const lines = [...charges]
		.sort((first, second) => second.postedOn.localeCompare(first.postedOn))
		.slice(0, SHOWN_LINES);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("folio.title")}</CardTitle>
			</CardHeader>
			<CardContent>
				{lines.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("folio.noCharges")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("folio.item")}</TableHead>
								<TableHead>{t("folio.kind")}</TableHead>
								<TableHead>{t("folio.date")}</TableHead>
								<TableHead className="text-end">{t("folio.amount")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{lines.map((charge) => {
								// The room, the breakfast, and the city tax come with the booking. The rest are extras.
								const isStay =
									charge.kind === "room" ||
									charge.kind === "breakfast" ||
									charge.kind === "city_tax";
								return (
									<TableRow key={charge.id}>
										<TableCell>{t(`folio.kinds.${charge.kind}`)}</TableCell>
										<TableCell>
											<Badge variant={isStay ? "info" : "success"}>
												{t(isStay ? "folio.stayLine" : "folio.extraLine")}
											</Badge>
										</TableCell>
										<TableCell className="whitespace-nowrap tabular-nums">
											{date.format(dayToDate(charge.postedOn))}
										</TableCell>
										<TableCell className="text-end tabular-nums">
											{money.format(charge.amount)}
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
