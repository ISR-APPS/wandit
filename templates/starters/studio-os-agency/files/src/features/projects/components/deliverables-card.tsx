// The deliverables of one project: the name, the owner, the status, and the due or approval day.
// The project detail page renders it in its main column. A retainer lists its cycles of the last 90 days and the next ones.
import {
	type Deliverable,
	DeliverableBadge,
	daysFromToday,
	type Member,
	PersonAvatar,
	useFormatters,
} from "~/features/studio";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
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

type DeliverablesCardProps = {
	deliverables: Deliverable[];
	/** The names of the owners. */
	members: Pick<Member, "id" | "name">[];
};

/** An approved row shows its approval day; an open row shows its due day, in red when it is past. */
export function DeliverablesCard({
	deliverables,
	members,
}: DeliverablesCardProps) {
	const { t, locale } = useT();
	const format = useFormatters();
	const nameOf = new Map(members.map((member) => [member.id, member.name]));
	const approved = deliverables.filter(
		(row) => row.status === "approved",
	).length;
	const progress = t("projectDetail.deliverablesDone")
		.replace("{done}", new Intl.NumberFormat(locale).format(approved))
		.replace(
			"{total}",
			new Intl.NumberFormat(locale).format(deliverables.length),
		);
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("projectDetail.deliverables")}</CardTitle>
				<CardDescription>{progress}</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>{t("projectDetail.deliverable")}</TableHead>
							{/* A phone-width card has room for two columns. The status moves under the name. */}
							<TableHead className="@max-md/main:hidden">
								{t("projectDetail.owner")}
							</TableHead>
							<TableHead className="@max-md/main:hidden">
								{t("projectDetail.status")}
							</TableHead>
							<TableHead className="text-end">
								{t("projectDetail.when")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{deliverables.map((row) => {
							const owner = nameOf.get(row.ownerId) ?? "";
							const isLate =
								row.status !== "approved" && daysFromToday(row.dueDay) < 0;
							return (
								<TableRow key={row.id}>
									<TableCell>
										<div className="grid justify-items-start gap-1">
											<span className="font-medium">{row.name}</span>
											<span className="@md/main:hidden">
												<DeliverableBadge status={row.status} />
											</span>
										</div>
									</TableCell>
									<TableCell className="@max-md/main:hidden">
										<span className="flex items-center gap-2">
											<PersonAvatar
												name={owner}
												className="size-6 text-[0.625rem]"
											/>
											{owner}
										</span>
									</TableCell>
									<TableCell className="@max-md/main:hidden">
										<DeliverableBadge status={row.status} />
									</TableCell>
									<TableCell
										className={cn(
											"text-end tabular-nums",
											isLate
												? "font-medium text-destructive"
												: "text-muted-foreground",
										)}
									>
										{row.approvedDay
											? format.shortDate(row.approvedDay)
											: format.relativeDay(row.dueDay)}
									</TableCell>
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
