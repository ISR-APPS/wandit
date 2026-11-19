// The profile card of the rep page: the initials, the name with the role badge, the territory,
// a strip of 3 counts, and the contact and quota facts with an icon each.
// RepDetailPage renders it first in the start column of the Overview tab.
import {
	CalendarBlankIcon,
	EnvelopeSimpleIcon,
	MapPinIcon,
	SpeedometerIcon,
	TargetIcon,
} from "@phosphor-icons/react";
import {
	fillMessage,
	moneyFormat,
	PaceBadge,
	RepAvatar,
} from "~/features/sales";
import { useT } from "~/shared/i18n";
import { Card, CardContent } from "~/shared/ui/card";
import type { RepDetail } from "../api/reps.queries";

type RepProfileCardProps = {
	rep: RepDetail;
};

/** The facts list ends with the amount the rep needs per selling day, or "Target met". */
export function RepProfileCard({ rep }: RepProfileCardProps) {
	const { t, locale } = useT();
	const money = moneyFormat(locale);
	const compactMoney = moneyFormat(locale, { compact: true });
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
		timeZone: "UTC",
	});
	const activeAccounts = rep.accounts.filter(
		(account) => account.orders > 0,
	).length;
	const counts = [
		{ id: "orders", label: t("reps.orders"), value: number.format(rep.orders) },
		{
			id: "accounts",
			label: t("reps.activeAccounts"),
			value: number.format(activeAccounts),
		},
		{
			id: "booked",
			label: t("reps.booked"),
			value: compactMoney.format(rep.booked),
		},
	];

	return (
		<Card>
			<CardContent className="grid gap-12">
				<div className="grid justify-items-center gap-4">
					<RepAvatar
						name={rep.name}
						className="size-20 [&>[data-slot=avatar-fallback]]:text-xl"
					/>
					<div className="grid justify-items-center gap-1 text-center">
						<p className="flex flex-wrap items-center justify-center gap-2 font-semibold text-xl">
							{rep.name}
							<PaceBadge status={rep.status} />
						</p>
						<p className="text-muted-foreground text-sm">
							{t(`roles.${rep.role}`)}
						</p>
					</div>
				</div>
				<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted text-center rtl:divide-x-reverse">
					{counts.map((count) => (
						<div key={count.id} className="grid gap-1 py-3">
							{/* dt comes first for screen readers. order-last shows the value above it, so the figure reads first. */}
							<dt className="order-last text-muted-foreground text-sm">
								{count.label}
							</dt>
							<dd className="font-numeric font-semibold text-lg tabular-nums">
								{count.value}
							</dd>
						</div>
					))}
				</dl>
				<ul className="grid gap-4 text-sm">
					<li className="flex items-center gap-3">
						<EnvelopeSimpleIcon className="size-4 shrink-0 text-muted-foreground" />
						<a
							href={`mailto:${rep.email}`}
							className="truncate hover:text-primary hover:underline"
						>
							{rep.email}
						</a>
					</li>
					<li className="flex items-center gap-3">
						<MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
						{rep.territoryName}
					</li>
					<li className="flex items-center gap-3">
						<CalendarBlankIcon className="size-4 shrink-0 text-muted-foreground" />
						{fillMessage(t("reps.startedOn"), {
							date: date.format(new Date(`${rep.startedOn}T00:00:00Z`)),
						})}
					</li>
					<li className="flex items-center gap-3">
						<TargetIcon className="size-4 shrink-0 text-muted-foreground" />
						{fillMessage(t("reps.quotaOf"), {
							quarter: rep.quarterLabel,
							amount: money.format(rep.target),
						})}
					</li>
					<li className="flex items-center gap-3">
						<SpeedometerIcon className="size-4 shrink-0 text-muted-foreground" />
						{rep.neededPerSellingDay > 0
							? fillMessage(t("reps.neededPerDay"), {
									amount: money.format(rep.neededPerSellingDay),
								})
							: t("reps.targetMet")}
					</li>
				</ul>
			</CardContent>
		</Card>
	);
}
