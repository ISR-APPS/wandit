// The vacation balance of one employee for this year: the days left, a bar of the used share, and four numbers.
// EmployeeProfilePage renders it at the top of its side rail, and second on a phone. It reads the balance of the profile query.
import { CARD_TITLE_CLASS, type LeaveBalance } from "~/features/people";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Progress } from "~/shared/ui/progress";

type LeaveBalanceCardProps = {
	/** Working days of vacation this calendar year, from leaveBalance() in the people feature. */
	balance: LeaveBalance;
	/** Placement classes from the profile grid, for example the order on a phone. */
	className?: string;
};

/** The bar counts taken and booked days, so its filled share plus "left" equals the allowance. */
export function LeaveBalanceCard({
	balance,
	className,
}: LeaveBalanceCardProps) {
	const { t, locale } = useT();
	const dayCount = new Intl.NumberFormat(locale, {
		style: "unit",
		unit: "day",
		unitDisplay: "long",
	});
	const rows = [
		{ label: t("employees.balanceAllowance"), value: balance.allowance },
		{ label: t("employees.balanceTaken"), value: balance.taken },
		{ label: t("employees.balanceBooked"), value: balance.booked },
		{ label: t("employees.balancePending"), value: balance.pending },
	];
	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle className={CARD_TITLE_CLASS}>
					{t("employees.balanceTitle")}
				</CardTitle>
				<CardDescription>{t("employees.balanceDescription")}</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				<div className="grid gap-2">
					<p className="font-medium font-numeric text-3xl tabular-nums">
						{dayCount.format(balance.remaining)}
					</p>
					<p className="text-muted-foreground text-sm">
						{t("employees.balanceLeft")}
					</p>
				</div>
				{/* The kit bar fills with ink. The primary fill matches the chart palette of the theme. */}
				<Progress
					value={balance.taken + balance.booked}
					max={balance.allowance}
					aria-label={t("employees.balanceUsed")}
					className="[&>div]:bg-primary"
				/>
				<dl className="grid gap-2 text-sm">
					{rows.map((row) => (
						<div
							key={row.label}
							className="flex items-center justify-between gap-3"
						>
							<dt className="text-muted-foreground">{row.label}</dt>
							<dd className="tabular-nums">{dayCount.format(row.value)}</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	);
}
