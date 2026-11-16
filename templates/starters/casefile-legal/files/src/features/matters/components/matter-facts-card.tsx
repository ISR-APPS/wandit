// The key facts of a matter as a definition list: client, other side, court, lead, dates, and fee arrangement.
// MatterDetailPage renders it first in the main column.
import { Link } from "@tanstack/react-router";
import {
	type ClientRow,
	fillMessage,
	formatRelativeTime,
	moneyFormat,
	PersonAvatar,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { MatterSummary } from "../lib/matter-joins";

type MatterFactsCardProps = {
	matter: MatterSummary;
	client: ClientRow;
	/** The role of the lead attorney, already translated, for example "Partner". */
	leadRole: string;
};

/** Two columns from the xl container width. A missing value shows a muted word, not an empty cell. */
export function MatterFactsCard({
	matter,
	client,
	leadRole,
}: MatterFactsCardProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const now = Date.now();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("matters.facts")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid @xl/main:grid-cols-2 gap-x-8 gap-y-5 text-sm">
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("matters.client")}</dt>
						<dd className="grid justify-items-start">
							<Link
								to="/app/clients"
								search={{ client: client.id }}
								className="font-medium underline decoration-border underline-offset-4 hover:decoration-ring"
								dir="auto"
							>
								{client.name}
							</Link>
							{client.contactName ? (
								<span className="text-muted-foreground" dir="auto">
									{client.contactName}
								</span>
							) : null}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">
							{t("matters.opposingParty")}
						</dt>
						<dd dir="auto">
							{matter.opposingParty ?? (
								<span className="text-muted-foreground">
									{t("matters.noOpposingParty")}
								</span>
							)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("matters.lead")}</dt>
						<dd className="flex items-center gap-2">
							<PersonAvatar name={matter.leadName} className="size-7" />
							<span className="grid">
								<span>{matter.leadName}</span>
								<span className="text-muted-foreground text-xs">
									{leadRole}
								</span>
							</span>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("matters.venue")}</dt>
						<dd dir="auto">
							{matter.venue ?? (
								<span className="text-muted-foreground">
									{t("matters.noVenue")}
								</span>
							)}
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("matters.opened")}</dt>
						<dd>
							{date.format(new Date(matter.openedAt))}
							<span className="text-muted-foreground">
								{` · ${formatRelativeTime(matter.openedAt, now, locale)}`}
							</span>
						</dd>
					</div>
					<div className="grid gap-1">
						<dt className="text-muted-foreground">{t("matters.fee")}</dt>
						<dd>
							{matter.flatFee === null
								? t("matters.hourly")
								: fillMessage(t("matters.flatFee"), {
										amount: moneyFormat(locale).format(matter.flatFee),
									})}
						</dd>
					</div>
					{matter.closedAt ? (
						<div className="grid gap-1">
							<dt className="text-muted-foreground">
								{t(
									matter.stage === "declined"
										? "matters.declined"
										: "matters.closed",
								)}
							</dt>
							<dd>{date.format(new Date(matter.closedAt))}</dd>
						</div>
					) : null}
				</dl>
			</CardContent>
		</Card>
	);
}
