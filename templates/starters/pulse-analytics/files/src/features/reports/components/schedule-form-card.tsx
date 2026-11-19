// The schedule form of the Reports page, in the anatomy of the kit payment method card: three report tiles,
// two text fields, a row of three selects (rhythm, weekday, hour), and a full-width save button.
// ReportsPage renders it last. It parses the fields with scheduleSchema, then calls useAddScheduleMutation.
import {
	ArrowsClockwiseIcon,
	type Icon,
	PulseIcon,
	UserPlusIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "~/shared/ui/card";
import { Input } from "~/shared/ui/input";
import { Label } from "~/shared/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/shared/ui/select";
import { useAddScheduleMutation } from "../api/reports.mutations";
import {
	FREQUENCIES,
	type Frequency,
	REPORT_KINDS,
	type ReportKind,
	SEND_HOURS,
	scheduleSchema,
} from "../lib/schedule-schema";

/** One icon per report tile. */
const KIND_ICONS = {
	signUps: UserPlusIcon,
	retention: ArrowsClockwiseIcon,
	activeUsers: PulseIcon,
} satisfies Record<ReportKind, Icon>;

/** Monday to Friday, as 1 to 5. A schedule sends on a working day only. */
const WEEKDAYS = [1, 2, 3, 4, 5] as const;

/** The fields that can show an error. */
type FormField = "recipientName" | "recipientEmail";

/** A failed parse marks each wrong field. The form clears after a save, and the selects keep their values. */
export function ScheduleFormCard() {
	const { t, locale } = useT();
	const addSchedule = useAddScheduleMutation();
	const [frequency, setFrequency] = useState<Frequency>("weekly");
	const [invalidFields, setInvalidFields] = useState<FormField[]>([]);
	const weekdayFormat = new Intl.DateTimeFormat(locale, {
		weekday: "long",
		timeZone: "UTC",
	});
	const hourFormat = new Intl.DateTimeFormat(locale, {
		hour: "numeric",
		minute: "2-digit",
	});

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const fields = new FormData(form);
		const parsed = scheduleSchema.safeParse({
			kind: fields.get("kind"),
			recipientName: fields.get("recipientName"),
			recipientEmail: fields.get("recipientEmail"),
			frequency,
			// A daily or monthly schedule does not read the weekday. Monday keeps the row valid.
			weekday: frequency === "weekly" ? fields.get("weekday") : 1,
			hour: fields.get("hour"),
		});
		if (!parsed.success) {
			setInvalidFields(
				parsed.error.issues.flatMap((issue): FormField[] => {
					const field = issue.path[0];
					return field === "recipientName" || field === "recipientEmail"
						? [field]
						: [];
				}),
			);
			return;
		}
		setInvalidFields([]);
		addSchedule.mutate(parsed.data, {
			onSuccess: () => {
				form.reset();
				toast.success(t("reports.form.saved"));
			},
			onError: () => toast.error(t("reports.form.saveError")),
		});
	}

	return (
		<Card className="h-full">
			<CardHeader>
				<CardTitle>{t("reports.form.title")}</CardTitle>
				<CardDescription>{t("reports.form.description")}</CardDescription>
			</CardHeader>
			<form onSubmit={submit} noValidate className="contents">
				<CardContent className="grid gap-6">
					<fieldset className="grid grid-cols-3 gap-4">
						<legend className="sr-only">{t("reports.form.kind")}</legend>
						{REPORT_KINDS.map((kind, index) => {
							const KindIcon = KIND_ICONS[kind];
							return (
								<label
									key={kind}
									className="flex cursor-pointer flex-col items-center gap-3 rounded-md border p-4 text-center text-sm hover:bg-accent hover:text-accent-foreground has-checked:border-primary has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50"
								>
									<input
										type="radio"
										name="kind"
										value={kind}
										defaultChecked={index === 0}
										className="sr-only"
									/>
									<KindIcon className="size-6" />
									{t(`reports.kinds.${kind}`)}
								</label>
							);
						})}
					</fieldset>
					<div className="grid gap-2">
						<Label htmlFor="schedule-name">{t("reports.form.name")}</Label>
						<Input
							id="schedule-name"
							name="recipientName"
							autoComplete="name"
							maxLength={80}
							aria-invalid={invalidFields.includes("recipientName")}
							aria-describedby={
								invalidFields.includes("recipientName")
									? "schedule-name-error"
									: undefined
							}
						/>
						{invalidFields.includes("recipientName") ? (
							<p id="schedule-name-error" className="text-destructive text-sm">
								{t("reports.form.nameError")}
							</p>
						) : null}
					</div>
					<div className="grid gap-2">
						<Label htmlFor="schedule-email">{t("reports.form.email")}</Label>
						<Input
							id="schedule-email"
							name="recipientEmail"
							type="email"
							autoComplete="email"
							placeholder={t("login.emailPlaceholder")}
							aria-invalid={invalidFields.includes("recipientEmail")}
							aria-describedby={
								invalidFields.includes("recipientEmail")
									? "schedule-email-error"
									: undefined
							}
						/>
						{invalidFields.includes("recipientEmail") ? (
							<p id="schedule-email-error" className="text-destructive text-sm">
								{t("reports.form.emailError")}
							</p>
						) : null}
					</div>
					<div className="grid grid-cols-3 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="schedule-frequency">
								{t("reports.form.frequency")}
							</Label>
							<Select
								value={frequency}
								onValueChange={(value) => {
									const next = FREQUENCIES.find((item) => item === value);
									if (next) {
										setFrequency(next);
									}
								}}
							>
								<SelectTrigger id="schedule-frequency" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{FREQUENCIES.map((item) => (
										<SelectItem key={item} value={item}>
											{t(`reports.frequencies.${item}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="schedule-weekday">
								{t("reports.form.weekday")}
							</Label>
							<Select
								name="weekday"
								defaultValue="1"
								disabled={frequency !== "weekly"}
							>
								<SelectTrigger id="schedule-weekday" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{WEEKDAYS.map((weekday) => (
										<SelectItem key={weekday} value={String(weekday)}>
											{/* 2024-01-01 is a Monday, so day N of that month is weekday N. */}
											{weekdayFormat.format(
												new Date(Date.UTC(2024, 0, weekday)),
											)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="schedule-hour">{t("reports.form.hour")}</Label>
							<Select name="hour" defaultValue="8">
								<SelectTrigger id="schedule-hour" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{SEND_HOURS.map((hour) => (
										<SelectItem key={hour} value={String(hour)}>
											{hourFormat.format(new Date(2024, 0, 1, hour))}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>
				</CardContent>
				<CardFooter>
					<Button
						type="submit"
						className="w-full"
						disabled={addSchedule.isPending}
					>
						{t("reports.form.submit")}
					</Button>
				</CardFooter>
			</form>
		</Card>
	);
}
