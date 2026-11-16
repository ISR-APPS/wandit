// The payments of the next two weeks on the plans page: who pays, for which plan, when, and how much.
// PlansPage renders it with the rows of upcomingPaymentsQueryOptions.
// The header gives the count and the sum, so the front desk sees the cash of the fortnight.
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatRelativeDay, MemberAvatar, PLAN_CURRENCY } from "~/features/gym";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import {
	Card,
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
import type { UpcomingPayment } from "../lib/plan-summary";

type UpcomingPaymentsCardProps = {
	/** The payments of the window, the earliest first. */
	payments: UpcomingPayment[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The grid span of the page. */
	className?: string;
};

// The rows of the first view: the panel then has about the height of the donut panel beside it.
const FIRST_ROWS = 6;

/** On a narrow page the plan moves under the name, so the table fits a phone. No payment shows one muted sentence. */
export function UpcomingPaymentsCard({
	payments,
	now,
	className,
}: UpcomingPaymentsCardProps) {
	const { t, locale } = useT();
	const money = new Intl.NumberFormat(locale, {
		style: "currency",
		currency: PLAN_CURRENCY,
		maximumFractionDigits: 0,
	});
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
	const total = payments.reduce((sum, row) => sum + row.amount, 0);
	const [isExpanded, setIsExpanded] = useState(false);
	const shown = isExpanded ? payments : payments.slice(0, FIRST_ROWS);

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("plans.paymentsTitle")}</CardTitle>
				<CardDescription>
					<span className="tabular-nums">{number.format(payments.length)}</span>
					{` ${t("plans.payments")} · `}
					<span className="tabular-nums">{money.format(total)}</span>
				</CardDescription>
			</CardHeader>
			<CardContent>
				{payments.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("plans.noPayments")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("members.member")}</TableHead>
								{/* A narrow page drops the plan column. The plan moves under the member name. */}
								<TableHead className="@xl/main:table-cell hidden">
									{t("members.plan")}
								</TableHead>
								<TableHead>{t("plans.due")}</TableHead>
								<TableHead className="text-end">{t("plans.amount")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{shown.map((row) => (
								<TableRow key={row.memberId}>
									<TableCell>
										<div className="flex items-center gap-3">
											{/* A phone needs the width for the amount, so the avatar shows from @xl. */}
											<MemberAvatar
												name={row.fullName}
												className="@xl/main:flex hidden"
											/>
											<div className="grid justify-items-start">
												<Link
													to="/app/members/$memberId"
													params={{ memberId: row.memberId }}
													className="whitespace-nowrap font-medium hover:underline"
												>
													{row.fullName}
												</Link>
												<span className="@xl/main:hidden whitespace-nowrap text-muted-foreground text-xs">
													{row.kind === "return"
														? `${row.planName} · ${t("plans.backFromFreeze")}`
														: row.planName}
												</span>
											</div>
										</div>
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden">
										<div className="flex flex-wrap items-center gap-2">
											<span className="whitespace-nowrap">{row.planName}</span>
											{row.kind === "return" ? (
												<Badge variant="info">
													{t("plans.backFromFreeze")}
												</Badge>
											) : null}
										</div>
									</TableCell>
									<TableCell className="whitespace-nowrap">
										{date.format(row.dueAt)}
										<span className="@xl/main:inline hidden text-muted-foreground">
											{` · ${formatRelativeDay(row.dueAt, now, locale)}`}
										</span>
									</TableCell>
									<TableCell className="text-end font-numeric tabular-nums">
										{money.format(row.amount)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
				{payments.length > FIRST_ROWS ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-4"
						onClick={() => setIsExpanded(!isExpanded)}
					>
						{isExpanded
							? t("plans.showFewer")
							: `${t("plans.showAll")} ${number.format(payments.length)}`}
					</Button>
				) : null}
			</CardContent>
		</Card>
	);
}
