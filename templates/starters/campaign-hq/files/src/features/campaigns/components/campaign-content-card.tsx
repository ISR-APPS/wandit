// The content card of a campaign page: its calendar items as a table of title, status, date, and format.
// The short card (with `limit`) leaves out the format column, because its narrow column has room for 3 columns.
// CampaignDetailPage renders it in the 2/3 column (the next 6 items) and in the Content tab (every item).
// It follows the kit "transaction history" card: a plain table with a status badge.
import { Link } from "@tanstack/react-router";
import { ContentStatusBadge, fillMessage } from "~/features/marketing";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/shared/ui/table";
import type { CampaignDetail } from "../api/campaigns.queries";

type CampaignContentCardProps = {
	/** The campaign of the page, from campaignQueryOptions. */
	campaign: CampaignDetail;
	/** The time of the render, in milliseconds since 1970. */
	now: number;
	/** Shows the items around today only: the next ones first, then the newest published ones. Absent: every item. */
	limit?: number;
};

/** The calendar link opens the calendar filtered to this campaign. */
export function CampaignContentCard({
	campaign,
	now,
	limit,
}: CampaignContentCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, {
		month: "short",
		day: "numeric",
	});
	const number = new Intl.NumberFormat(locale);
	// The short list shows the work still ahead first: what goes out next matters most on this page.
	const upcoming = campaign.content.filter(
		(item) => Date.parse(item.scheduledAt) > now,
	);
	const published = campaign.content
		.filter((item) => Date.parse(item.scheduledAt) <= now)
		.reverse();
	const items =
		limit === undefined
			? campaign.content
			: [...upcoming, ...published].slice(0, limit);
	const showFormat = limit === undefined;

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("campaigns.content")}</CardTitle>
				<CardDescription>
					{campaign.content.length === 1
						? t("campaigns.contentHintOne")
						: fillMessage(t("campaigns.contentHint"), {
								count: number.format(campaign.content.length),
							})}
				</CardDescription>
				<CardAction>
					<Link
						to="/app/calendar"
						search={{ campaign: campaign.id }}
						className="text-muted-foreground text-sm hover:text-foreground hover:underline"
					>
						{t("campaigns.openCalendar")}
					</Link>
				</CardAction>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("campaigns.noContent")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("campaigns.item")}</TableHead>
								<TableHead>{t("campaigns.status")}</TableHead>
								<TableHead>{t("campaigns.date")}</TableHead>
								{showFormat && (
									<TableHead className="text-end">
										{t("campaigns.format")}
									</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((item) => (
								<TableRow key={item.id}>
									<TableCell className="max-w-48 truncate" dir="auto">
										{item.title}
									</TableCell>
									<TableCell>
										<ContentStatusBadge status={item.status} />
									</TableCell>
									<TableCell className="tabular-nums">
										{date.format(new Date(item.scheduledAt))}
									</TableCell>
									{showFormat && (
										<TableCell className="text-end font-medium">
											{t(`contentFormats.${item.format}`)}
										</TableCell>
									)}
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
