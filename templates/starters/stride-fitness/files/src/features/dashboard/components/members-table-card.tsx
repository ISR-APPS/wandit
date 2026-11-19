// The table card of the home: every member, newest first, with plan and status filters.
// DashboardPage renders it under the second row and passes the rows. The /app loader fills the member list.
// It follows the full-width table card of the kit system.
import { useState } from "react";
import { fillMessage, MEMBER_STATUSES, PLANS } from "~/features/gym";
import { type MemberRow, MemberTable } from "~/features/members";
import { useT } from "~/shared/i18n";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { RecordFilter } from "~/shared/ui/record-table";

// Eight rows keep the card near one screen high. The pages show the rest.
const HOME_PAGE_SIZE = 8;

type MembersTableCardProps = {
	/** Every member, newest first. */
	members: MemberRow[];
};

/** The plan and status filters cut the rows; then the member table filters, sorts, and pages them. */
export function MembersTableCard({ members }: MembersTableCardProps) {
	const { t, locale } = useT();
	const [plan, setPlan] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const rows = members.filter(
		(row) =>
			(plan === null || row.planId === plan) &&
			(status === null || row.status === status),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("dashboard.membersTitle")}</CardTitle>
				<CardDescription>
					{fillMessage(t("dashboard.membersDescription"), {
						count: new Intl.NumberFormat(locale).format(members.length),
					})}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<MemberTable
					members={rows}
					variant="home"
					pageSize={HOME_PAGE_SIZE}
					noResults={t("members.noResults")}
					toolbar={
						<>
							<RecordFilter
								label={t("members.plan")}
								options={PLANS.map((row) => ({
									value: row.id,
									label: row.name,
								}))}
								value={plan}
								onValueChange={setPlan}
							/>
							<RecordFilter
								label={t("members.status")}
								options={MEMBER_STATUSES.map((value) => ({
									value,
									label: t(`memberStatuses.${value}`),
								}))}
								value={status}
								onValueChange={setStatus}
							/>
						</>
					}
				/>
			</CardContent>
		</Card>
	);
}
