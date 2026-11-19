// The first card of the account page: a large initials avatar, the name with the plan and the status,
// a strip of three counts, and a list of facts with icons. AccountOverview renders it at the top of the start column.
import {
	CalendarBlankIcon,
	ClockIcon,
	EnvelopeSimpleIcon,
	GlobeIcon,
	MapPinIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	formatRelativeTime,
	initialsOf,
} from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { AccountDetail } from "../api/accounts.queries";
import { ACCOUNT_STATUS_BADGE } from "../lib/account-status";

type AccountProfileCardProps = {
	account: AccountDetail;
};

/** The counts cover the last 30 complete days, as the account list does. */
export function AccountProfileCard({ account }: AccountProfileCardProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const compact = new Intl.NumberFormat(locale, { notation: "compact" });
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const now = Date.now();
	const counts = [
		{
			key: "users",
			label: t("accounts.profile.users"),
			value: number.format(account.members),
		},
		{
			key: "active",
			label: t("accounts.profile.active"),
			value: number.format(account.activePeople),
		},
		{
			key: "events",
			label: t("accounts.profile.events"),
			value: compact.format(account.events),
		},
	];
	const facts = [
		{ key: "owner", icon: EnvelopeSimpleIcon, text: account.owner.email },
		{ key: "domain", icon: GlobeIcon, text: account.domain },
		{ key: "region", icon: MapPinIcon, text: t(`regions.${account.region}`) },
		{
			key: "since",
			icon: CalendarBlankIcon,
			text: fillMessage(t("accounts.profile.since"), {
				date: date.format(new Date(account.createdAt)),
			}),
		},
		{
			key: "seen",
			icon: ClockIcon,
			text: fillMessage(t("accounts.profile.lastSeen"), {
				time:
					account.lastSeenAt === null
						? t("accounts.neverSeen")
						: formatRelativeTime(account.lastSeenAt, now, locale),
			}),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4">
					<Avatar className="size-20">
						<AvatarFallback className="font-medium text-xl">
							{initialsOf(account.name)}
						</AvatarFallback>
					</Avatar>
					<div className="grid justify-items-center gap-1 text-center">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							{account.name}
							<Badge variant="info">{t(`plans.${account.plan}`)}</Badge>
						</p>
						<p className="flex items-center gap-2 text-muted-foreground text-sm">
							{account.industry}
							<Badge variant={ACCOUNT_STATUS_BADGE[account.status]}>
								{t(`accounts.statuses.${account.status}`)}
							</Badge>
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center">
					{counts.map((count) => (
						<div key={count.key} className="grid gap-0.5 py-3">
							<dt className="order-2 text-muted-foreground text-sm">
								{count.label}
							</dt>
							<dd className="order-1 font-semibold text-lg tabular-nums">
								{count.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4">
					{facts.map((fact) => (
						<li
							key={fact.key}
							className="flex min-w-0 items-center gap-3 text-sm"
						>
							<fact.icon className="size-4 shrink-0 text-muted-foreground" />
							<span className="truncate">{fact.text}</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}
