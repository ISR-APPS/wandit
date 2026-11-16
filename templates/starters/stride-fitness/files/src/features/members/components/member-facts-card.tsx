// The membership facts of the member page: the plan and its price, the billing state, and the habits.
// MemberDetailPage renders it with the detail of memberQueryOptions.
// The billing line follows the status: the next payment, the end of a freeze, or the end of the membership.
import { classTypeOf, formatRelativeDay, PLAN_CURRENCY } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import type { MemberDetail } from "../lib/member-rows";

type MemberFactsCardProps = {
	/** The member, the plan, and the next payment. */
	detail: MemberDetail;
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
};

/** A two-column definition list from the xl container width. */
export function MemberFactsCard({ detail, now }: MemberFactsCardProps) {
	const { t, locale } = useT();
	const { member, plan } = detail;
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: PLAN_CURRENCY,
		maximumFractionDigits: 0,
	});
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

	// The billing fact of each status. A lapsed member has an end date and no payment.
	const billing =
		member.status === "lapsed" && member.endedAt !== null
			? { label: t("members.endedOn"), at: member.endedAt }
			: member.status === "frozen" && member.frozenUntil !== null
				? { label: t("members.frozenUntil"), at: member.frozenUntil }
				: detail.nextPaymentAt !== null
					? { label: t("members.nextPayment"), at: detail.nextPaymentAt }
					: null;

	const facts = [
		{
			id: "plan",
			label: t("members.plan"),
			value: (
				<>
					{plan.name}
					<span className="text-muted-foreground">
						{` · ${money.format(plan.price)} ${t(plan.billing === "year" ? "plans.perYear" : "plans.perMonth")}`}
					</span>
				</>
			),
		},
		...(billing
			? [
					{
						id: "billing",
						label: billing.label,
						value: (
							<>
								{date.format(billing.at)}
								<span className="text-muted-foreground">
									{` · ${formatRelativeDay(billing.at, now, locale)}`}
								</span>
							</>
						),
					},
				]
			: []),
		{
			id: "joined",
			label: t("members.memberSince"),
			value: date.format(member.joinedAt),
		},
		{
			id: "total",
			label: t("members.totalVisits"),
			value: (
				<span className="tabular-nums">
					{number.format(detail.totalVisits)}
				</span>
			),
		},
		{
			id: "favorites",
			label: t("members.favorites"),
			value: member.favoriteClassIds
				.map((id) => classTypeOf(id).name)
				.join(", "),
		},
		{
			id: "email",
			label: t("members.email"),
			value: (
				<a
					href={`mailto:${member.email}`}
					className="break-all hover:underline"
				>
					{member.email}
				</a>
			),
		},
	];

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("members.membership")}</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid @xl/main:grid-cols-2 gap-x-6 gap-y-4 text-sm">
					{facts.map((fact) => (
						<div key={fact.id} className="grid gap-1">
							<dt className="text-muted-foreground">{fact.label}</dt>
							<dd>{fact.value}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
