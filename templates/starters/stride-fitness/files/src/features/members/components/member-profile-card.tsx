// The profile card of the member page: the avatar, the name and plan, three visit figures, and the membership facts.
// MemberDetailPage renders it at the top of the side column. It follows the profile card of the kit profile page.
import {
	CalendarBlankIcon,
	CreditCardIcon,
	EnvelopeSimpleIcon,
	NoteIcon,
	SnowflakeIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { fillMessage, formatRelativeDay, MemberAvatar } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Card, CardContent } from "~/shared/ui/card";
import type { MemberDetail } from "../lib/member-rows";

type MemberProfileCardProps = {
	detail: MemberDetail;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** The facts list names each value with an icon and a visible label above the value. */
export function MemberProfileCard({ detail, now }: MemberProfileCardProps) {
	const { t, locale } = useT();
	const { member, plan } = detail;
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const month = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});

	const figures = [
		{
			id: "window",
			label: t("members.visitsWindow"),
			value: detail.visitsInWindow,
		},
		{
			id: "total",
			label: t("members.totalVisits"),
			value: detail.visits.length,
		},
		{ id: "usual", label: t("members.usualWeek"), value: member.weeklyVisits },
	];
	const facts: { id: string; icon: ReactNode; label: string; value: string }[] =
		[
			{
				id: "email",
				icon: <EnvelopeSimpleIcon className="size-4" />,
				label: t("members.email"),
				value: member.email,
			},
			{
				id: "joined",
				icon: <CalendarBlankIcon className="size-4" />,
				label: t("members.joined"),
				value: date.format(member.joinedAt),
			},
			{
				id: "payment",
				icon: <CreditCardIcon className="size-4" />,
				label: t("members.nextPayment"),
				value:
					detail.nextPaymentAt === null
						? t("members.noPayment")
						: `${date.format(detail.nextPaymentAt)} · ${formatRelativeDay(detail.nextPaymentAt, now, locale)}`,
			},
			// The freeze dates show only for a frozen member, the end day only for a lapsed one.
			...(member.frozenUntil !== null && member.status === "frozen"
				? [
						{
							id: "freeze",
							icon: <SnowflakeIcon className="size-4" />,
							label: t("members.frozenUntil"),
							value: fillMessage(t("members.backOn"), {
								date: date.format(member.frozenUntil),
							}),
						},
					]
				: []),
			...(member.endedAt !== null
				? [
						{
							id: "ended",
							icon: <CalendarBlankIcon className="size-4" />,
							label: t("members.ended"),
							value: fillMessage(t("members.endedOn"), {
								date: date.format(member.endedAt),
							}),
						},
					]
				: []),
			...(member.note === null
				? []
				: [
						{
							id: "note",
							icon: <NoteIcon className="size-4" />,
							label: t("members.note"),
							value: member.note,
						},
					]),
		];

	return (
		<Card>
			<CardContent className="grid gap-8">
				<div className="grid justify-items-center gap-3 text-center">
					<MemberAvatar
						name={member.fullName}
						className="size-20"
						initialsClassName="text-xl"
					/>
					<div className="grid justify-items-center gap-1">
						<div className="flex flex-wrap items-center justify-center gap-2">
							<span className="font-display font-semibold text-xl">
								{member.fullName}
							</span>
							<Badge variant="info">{plan.name}</Badge>
						</div>
						<span className="text-muted-foreground text-sm">
							{fillMessage(t("members.memberSince"), {
								date: month.format(member.joinedAt),
							})}
						</span>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted/50 rtl:divide-x-reverse">
					{figures.map((figure) => (
						<div key={figure.id} className="grid gap-1 px-2 py-3 text-center">
							<dd className="order-first font-numeric font-semibold text-xl tabular-nums">
								{number.format(figure.value)}
							</dd>
							<dt className="text-muted-foreground text-xs">{figure.label}</dt>
						</div>
					))}
				</dl>
				<dl className="grid gap-3 text-sm">
					{facts.map((fact) => (
						<div key={fact.id} className="grid grid-cols-[1rem_1fr] gap-x-3">
							<dt className="col-span-2 flex items-center gap-3 text-muted-foreground text-xs">
								{fact.icon}
								{fact.label}
							</dt>
							<dd className="col-start-2 min-w-0 break-words" dir="auto">
								{fact.value}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
