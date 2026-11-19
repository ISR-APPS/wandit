// The schedules card of the Reports page: each email schedule with its report, its recipient,
// and a select of its rhythm. ReportsPage renders it first. The schedule form under the table adds rows.
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { initialsOf } from "~/features/tracking";
import { useT } from "~/shared/i18n";
import { Avatar, AvatarFallback } from "~/shared/ui/avatar";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { Skeleton } from "~/shared/ui/skeleton";
import { useSetFrequencyMutation } from "../api/reports.mutations";
import { schedulesQueryOptions } from "../api/reports.queries";
import { FREQUENCIES } from "../lib/schedule-schema";

/** A new rhythm saves at once. A failed save shows a toast and the select keeps the saved value. */
export function SchedulesCard() {
	const { t } = useT();
	const schedules = useQuery(schedulesQueryOptions());
	const setFrequency = useSetFrequencyMutation();

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.schedules.title")}</CardTitle>
				<CardDescription>{t("reports.schedules.description")}</CardDescription>
			</CardHeader>
			<CardContent>
				{schedules.isError ? (
					<p className="text-sm" role="alert">
						{t("reports.schedules.error")}
					</p>
				) : schedules.data === undefined ? (
					<Skeleton className="h-40" />
				) : (
					// grid-cols-1 is minmax(0, 1fr): the mail address wraps and the select stays inside the card.
					<ul className="grid grid-cols-1 gap-6">
						{schedules.data.map((schedule) => (
							<li
								key={schedule.id}
								className="flex items-center justify-between gap-4"
							>
								<div className="flex min-w-0 items-center gap-4">
									<Avatar className="size-8">
										<AvatarFallback className="text-xs">
											{initialsOf(schedule.recipientName)}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0">
										<p className="truncate font-medium text-sm">
											{t(`reports.kinds.${schedule.kind}`)}
										</p>
										{/* The address wraps and never clips. The line breaks after the "@".
										    wrap-anywhere breaks inside a part only when that part alone is too long. */}
										<p className="wrap-anywhere text-muted-foreground text-sm">
											{schedule.recipientEmail.slice(
												0,
												schedule.recipientEmail.indexOf("@") + 1,
											)}
											<wbr />
											{schedule.recipientEmail.slice(
												schedule.recipientEmail.indexOf("@") + 1,
											)}
										</p>
									</div>
								</div>
								<Select
									value={schedule.frequency}
									onValueChange={(value) => {
										const frequency = FREQUENCIES.find(
											(item) => item === value,
										);
										if (frequency) {
											setFrequency.mutate(
												{ id: schedule.id, frequency },
												{
													onError: () =>
														toast.error(t("reports.schedules.saveError")),
												},
											);
										}
									}}
								>
									<SelectTrigger
										className="w-auto shrink-0"
										aria-label={t("reports.schedules.frequency")}
									>
										<SelectValue />
									</SelectTrigger>
									<SelectContent align="end">
										{FREQUENCIES.map((frequency) => (
											<SelectItem key={frequency} value={frequency}>
												{t(`reports.frequencies.${frequency}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</li>
						))}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
