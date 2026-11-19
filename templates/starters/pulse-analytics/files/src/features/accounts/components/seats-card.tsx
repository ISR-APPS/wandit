// The seats card of the account page: the share of the seats of the plan that the account uses.
// AccountOverview renders it under the profile card.
import { fillMessage } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type SeatsCardProps = {
	/** How many people the account has. */
	members: number;
	/** How many seats the plan holds. Never below `members`. */
	seats: number;
};

/** The bar and the percent say the same: the percent is the text for every reader. */
export function SeatsCard({ members, seats }: SeatsCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		maximumFractionDigits: 0,
	});
	const share = seats === 0 ? 0 : members / seats;
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("accounts.seats.title")}</CardTitle>
				<CardDescription>
					{fillMessage(t("accounts.seats.description"), {
						used: number.format(members),
						total: number.format(seats),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex items-center gap-4">
				<Progress value={share * 100} aria-label={t("accounts.seats.title")} />
				<span className="text-muted-foreground text-sm tabular-nums">
					{percent.format(share)}
				</span>
			</CardContent>
		</Card>
	);
}
