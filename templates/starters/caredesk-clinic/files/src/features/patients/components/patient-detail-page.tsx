// The file of one patient: the header, the details, the appointments, the next appointment, and the health summary with the note.
// The /app/patients/$patientId route renders it after its loader. The route also uses the skeleton below.
// An unknown id shows a not-found block with a link back to the list.
import { EnvelopeSimpleIcon, PhoneIcon } from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageHeader } from "~/features/app-shell";
import {
	dayToDate,
	formatRelativeTime,
	PersonAvatar,
	useNow,
} from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";
import { patientQueryOptions } from "../api/patients.queries";
import { formatAge } from "../lib/patient-rows";
import { NextAppointmentCard } from "./next-appointment-card";
import { PatientVisitsCard } from "./patient-visits-card";

type PatientDetailPageProps = {
	/** The `$patientId` param of the URL, for example "pat-0042". The query treats an unknown id as not found. */
	patientId: string;
};

/** The detail page. A 2/3 main column and a 1/3 rail from the 5xl container width. */
export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const { data } = useSuspenseQuery(patientQueryOptions(patientId));

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start max-md:h-11"
		>
			<Link to="/app/patients">
				<CaretLeftIcon className="rtl:rotate-180" />
				{t("patients.title")}
			</Link>
		</Button>
	);
	if (!data) {
		return (
			<div className="grid gap-4">
				{backLink}
				<p className="text-muted-foreground text-sm">
					{t("patients.notFound")}
				</p>
			</div>
		);
	}

	const { patient, appointments } = data;
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const ageLabel = formatAge(patient.dateOfBirth, now, locale);
	// The link needs digits only. The shown number keeps its spaces.
	const phoneHref = `tel:${patient.phone.replace(/[^\d+]/g, "")}`;

	return (
		<div className="grid gap-6">
			{backLink}
			<div className="flex items-start gap-4">
				<PersonAvatar
					name={patient.fullName}
					className="@xl/main:flex hidden size-14 [&_[data-slot=avatar-fallback]]:text-base"
				/>
				<div className="min-w-0 flex-1">
					<PageHeader
						title={patient.fullName}
						description={
							<span className="flex flex-wrap items-center gap-2">
								{patient.isNew ? (
									<Badge variant="info">{t("patients.newPatient")}</Badge>
								) : null}
								{patient.isRecallDue ? (
									<Badge variant="warning">{t("patients.recallDue")}</Badge>
								) : null}
								<span className="tabular-nums">
									{`${patient.fileNumber} · ${ageLabel} · ${t(`sexes.${patient.sex}`)}`}
								</span>
							</span>
						}
						actions={
							<>
								{/* A phone gets a 44 px touch area. */}
								<Button asChild variant="outline" className="max-md:h-11">
									<a href={phoneHref}>
										<PhoneIcon />
										{t("patients.call")}
									</a>
								</Button>
								{patient.email ? (
									<Button asChild variant="outline" className="max-md:h-11">
										<a href={`mailto:${patient.email}`}>
											<EnvelopeSimpleIcon />
											{t("patients.sendEmail")}
										</a>
									</Button>
								) : null}
							</>
						}
					/>
				</div>
			</div>
			{/* DOM order: details, rail, visits. A phone then shows the allergies before the long visit table.
			    From 5xl the rail moves to the third column and spans both rows. The second row takes the spare height. */}
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 @5xl/main:grid-rows-[auto_1fr] items-start gap-6">
				<Card className="@5xl/main:col-span-2">
					<CardHeader>
						<CardTitle>{t("patients.details")}</CardTitle>
					</CardHeader>
					<CardContent>
						<dl className="grid @2xl/main:grid-cols-3 grid-cols-2 gap-x-6 gap-y-5 text-sm">
							<Fact label={t("patients.dateOfBirth")}>
								<span className="tabular-nums">
									{date.format(dayToDate(patient.dateOfBirth))}
								</span>
							</Fact>
							<Fact label={t("patients.phone")}>
								<span className="tabular-nums">{patient.phone}</span>
							</Fact>
							{/* Two columns on a phone, so a long address does not break in the middle. */}
							<Fact
								label={t("patients.email")}
								className="@2xl/main:col-span-1 col-span-2"
							>
								{patient.email ? (
									<span className="break-all">{patient.email}</span>
								) : (
									<span className="font-normal text-muted-foreground">
										{t("patients.noEmail")}
									</span>
								)}
							</Fact>
							<Fact label={t("patients.practitioner")}>
								{patient.primaryPractitioner?.fullName ?? ""}
							</Fact>
							<Fact label={t("patients.coverage")}>
								{t(`coverage.${patient.coverage}`)}
							</Fact>
							<Fact label={t("patients.since")}>
								<span className="tabular-nums">
									{date.format(patient.registeredAt)}
								</span>
							</Fact>
							<Fact label={t("patients.lastVisit")}>
								{patient.lastVisitAt === null
									? t("patients.noVisit")
									: formatRelativeTime(patient.lastVisitAt, now, locale)}
							</Fact>
							<Fact label={t("patients.visitsDone")}>
								<span className="tabular-nums">
									{new Intl.NumberFormat(locale).format(patient.visitCount)}
								</span>
							</Fact>
							<Fact label={t("patients.bloodType")}>{patient.bloodType}</Fact>
						</dl>
					</CardContent>
				</Card>
				{/* Between 2xl and 5xl the rail cards sit two by two, so they do not stretch over the full width. */}
				<div className="@5xl/main:col-start-3 @5xl/main:row-span-2 @5xl/main:row-start-1 grid @2xl/main:grid-cols-2 @5xl/main:grid-cols-1 items-start gap-6">
					<NextAppointmentCard
						appointment={patient.nextAppointment}
						now={now}
					/>
					<Card>
						<CardHeader>
							<CardTitle>{t("patients.health")}</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-4 text-sm">
							<TagList
								label={t("patients.allergies")}
								items={patient.allergies}
								empty={t("patients.noAllergies")}
								variant="warning"
							/>
							<TagList
								label={t("patients.conditions")}
								items={patient.conditions}
								empty={t("patients.noConditions")}
								variant="secondary"
							/>
							{/* Most files have no note. An empty note block only adds noise to the rail. */}
							{patient.note ? (
								<div className="grid gap-2 border-t pt-4">
									<span className="text-muted-foreground text-xs">
										{t("patients.note")}
									</span>
									<p dir="auto">{patient.note}</p>
								</div>
							) : null}
						</CardContent>
					</Card>
				</div>
				<PatientVisitsCard
					appointments={appointments}
					now={now}
					className="@5xl/main:col-span-2"
				/>
			</div>
		</div>
	);
}

type FactProps = {
	/** The translated name of the fact. */
	label: string;
	children: ReactNode;
	/** The grid span of the fact in the details list. */
	className?: string;
};

// One name and value pair of the details list.
function Fact({ label, children, className }: FactProps) {
	return (
		<div className={cn("grid min-w-0 gap-1", className)}>
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-medium">{children}</dd>
		</div>
	);
}

type TagListProps = {
	/** The translated name of the list. */
	label: string;
	/** Plain names from the patient file. */
	items: readonly string[];
	/** The sentence for an empty list. */
	empty: string;
	/** "warning" for allergies: the staff must see them. */
	variant: "warning" | "secondary";
};

// A named list of badges, or one muted sentence when the file holds none.
function TagList({ label, items, empty, variant }: TagListProps) {
	return (
		<div className="grid gap-2">
			<span className="text-muted-foreground text-xs">{label}</span>
			{items.length === 0 ? (
				<span className="text-muted-foreground">{empty}</span>
			) : (
				<span className="flex flex-wrap gap-1.5">
					{items.map((item) => (
						<Badge key={item} variant={variant}>
							{item}
						</Badge>
					))}
				</span>
			)}
		</div>
	);
}

/** Placeholder while the detail loader runs. The route sets it as pendingComponent. */
export function PatientDetailPageSkeleton() {
	return (
		<div className="grid gap-6">
			<Skeleton className="h-8 w-28" />
			<div className="grid gap-2">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-5 w-64" />
			</div>
			<div className="grid @5xl/main:grid-cols-3 grid-cols-1 items-start gap-6">
				<Skeleton className="@5xl/main:col-span-2 h-96" />
				<Skeleton className="h-64" />
			</div>
		</div>
	);
}
