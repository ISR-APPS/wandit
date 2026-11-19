// The offers card of a listing detail page: a table of the offers that leads made on the home,
// with the date, the state of the offer, and the full amount. ListingDetailPage renders it under the history.
// The card is half of the column at 1280 px, so it keeps three columns.
import { type LeadRow, moneyFormat } from "~/features/agency";
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

// Green for the accepted offer, a plain outline for a declined one, amber while the seller decides.
const OFFER_STATE_BADGE = {
	accepted: "success",
	declined: "outline",
	pending: "warning",
} as const;

/** The state of one offer. The label is the message `listings.offerStates.<state>`. */
type OfferState = keyof typeof OFFER_STATE_BADGE;

type ListingOffersCardProps = {
	/** The leads of this home that made an offer, newest offer first. */
	offers: LeadRow[];
	/** The id of the lead whose offer the seller accepted (ListingDetail.buyer). null with no accepted offer. */
	buyerId: string | null;
};

/** No offer yet: one sentence. The amount is exact, because two offers can differ by a few thousand. */
export function ListingOffersCard({ offers, buyerId }: ListingOffersCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "short" });
	// A lead with an offer closes only when the seller declines it, so "lost" means "declined".
	const stateOf = (lead: LeadRow): OfferState =>
		lead.id === buyerId
			? "accepted"
			: lead.status === "lost"
				? "declined"
				: "pending";
	return (
		<Card className="min-w-0">
			<CardHeader>
				<CardTitle>{t("listings.offersTitle")}</CardTitle>
			</CardHeader>
			<CardContent className="min-w-0 overflow-x-auto">
				{offers.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						{t("listings.noOffers")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("listings.buyer")}</TableHead>
								<TableHead>{t("listings.status")}</TableHead>
								<TableHead className="text-end">
									{t("listings.amount")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{offers.map((lead) => {
								const state = stateOf(lead);
								return (
									<TableRow key={lead.id}>
										<TableCell>
											<div className="grid gap-0.5">
												<span className="font-medium" dir="auto">
													{lead.fullName}
												</span>
												<span className="text-muted-foreground text-xs tabular-nums">
													{lead.offerAt === null
														? "–"
														: date.format(new Date(lead.offerAt))}
												</span>
											</div>
										</TableCell>
										<TableCell>
											<Badge variant={OFFER_STATE_BADGE[state]}>
												{t(`listings.offerStates.${state}`)}
											</Badge>
										</TableCell>
										<TableCell className="text-end font-medium tabular-nums">
											{lead.offerAmount === null
												? "–"
												: money.format(lead.offerAmount)}
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
