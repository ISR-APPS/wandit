// The visit history of the member page: the newest check-ins at the front desk.
// MemberDetailPage renders it with the visits of memberQueryOptions.
// An open gym visit has no class, so its class, studio, and coach cells say "Open gym" and stay empty.
import { formatRelativeTime } from "~/features/gym";
import { useT } from "~/shared/i18n";
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
import type { VisitRow } from "../lib/member-rows";

type MemberVisitsCardProps = {
	/** The newest check-ins, newest first. */
	visits: VisitRow[];
	/** The current time in milliseconds since 1970, from useNow(). */
	now: number;
	/** The place of the card in the page grid: the detail page moves it last on a phone. */
	className?: string;
};

/** A table of check-ins. Zero visits shows one muted sentence in place of the table. */
export function MemberVisitsCard({
	visits,
	now,
	className,
}: MemberVisitsCardProps) {
	const { t, locale } = useT();
	const dateTime = new Intl.DateTimeFormat(locale, {
		weekday: "short",
		day: "numeric",
		month: "short",
		hour: "numeric",
		minute: "2-digit",
	});

	return (
		<Card className={className}>
			<CardHeader>
				<CardTitle>{t("members.visitHistory")}</CardTitle>
				<CardDescription>
					{t("members.visitHistoryDescription")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{visits.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						{t("members.noVisits")}
					</p>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("members.checkIn")}</TableHead>
								<TableHead>{t("classes.class")}</TableHead>
								{/* A narrow panel keeps the check-in time and the class only. */}
								<TableHead className="@xl/main:table-cell hidden">
									{t("classes.studio")}
								</TableHead>
								<TableHead className="@xl/main:table-cell hidden text-end">
									{t("members.when")}
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{visits.map((visit) => (
								<TableRow key={visit.id}>
									<TableCell className="whitespace-nowrap tabular-nums">
										{dateTime.format(visit.at)}
									</TableCell>
									<TableCell className="whitespace-normal">
										{visit.className === null ? (
											<span className="text-muted-foreground">
												{t("members.openGym")}
											</span>
										) : (
											<div className="grid justify-items-start">
												<span className="font-medium">{visit.className}</span>
												<span className="text-muted-foreground text-xs">
													{visit.coachName}
												</span>
											</div>
										)}
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden whitespace-nowrap">
										{visit.studio ?? "–"}
									</TableCell>
									<TableCell className="@xl/main:table-cell hidden whitespace-nowrap text-end text-muted-foreground">
										{formatRelativeTime(visit.at, now, locale)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}
