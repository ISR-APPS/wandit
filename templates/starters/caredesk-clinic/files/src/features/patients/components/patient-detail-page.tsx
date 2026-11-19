// The file of one patient: the name and the call button, then the Overview and Visits tabs.
// Overview: the profile, attendance, and health cards at the start; the visit history, payments, and care team at the end.
// Visits: every appointment of the patient in one table. The /app/patients/$patientId route renders it after its loader.
// An unknown id shows a not-found block with a link back to the list.
import {
	CalendarBlankIcon,
	DropIcon,
	EnvelopeSimpleIcon,
	IdentificationCardIcon,
	PhoneIcon,
	StethoscopeIcon,
} from "@phosphor-icons/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { PageHeader } from "~/features/app-shell";
import { PersonAvatar, useNow } from "~/features/clinic";
import { useT } from "~/shared/i18n";
import { Badge } from "~/shared/ui/badge";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card";
import { CaretLeftIcon } from "~/shared/ui/icons";
import { Progress } from "~/shared/ui/progress";
import { Skeleton } from "~/shared/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/shared/ui/tabs";
import { patientQueryOptions } from "../api/patients.queries";
import {
	formatAge,
	PATIENT_STATUS_BADGE,
	patientStatusOf,
} from "../lib/patient-rows";
import {
	CareTeamCard,
	PatientVisitsTable,
	PaymentsCard,
	VisitHistoryCard,
} from "./patient-history";

/** The two tabs of the page. */
const PATIENT_TABS = ["overview", "visits"] as const;
type PatientTab = (typeof PATIENT_TABS)[number];

type PatientDetailPageProps = {
	/** The `$patientId` param of the URL, for example "pat-0042". The query treats an unknown id as not found. */
	patientId: string;
};

/** A 1/3 profile column and a 2/3 activity column from the 4xl container width. One column on a phone. */
export function PatientDetailPage({ patientId }: PatientDetailPageProps) {
	const { t, locale } = useT();
	const now = useNow();
	const { data } = useSuspenseQuery(patientQueryOptions(patientId));
	const [tab, setTab] = useState<PatientTab>("overview");

	const backLink = (
		<Button
			asChild
			variant="ghost"
			size="sm"
			className="-ms-3 justify-self-start"
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
	const number = new Intl.NumberFormat(locale);
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "long" });
	const status = patientStatusOf(patient);
	const noShows = appointments.filter((row) => row.status === "no_show").length;
	const upcoming = appointments.filter(
		(row) => row.status === "scheduled" || row.status === "confirmed",
	).length;
	const attended = patient.visitCount + noShows;
	// The share of the visits that were due and that the patient came to. No visit due gives no rate.
	const attendance = attended === 0 ? null : patient.visitCount / attended;
	// The link needs digits only. The shown number keeps its spaces.
	const phoneHref = `tel:${patient.phone.replace(/[^\d+]/g, "")}`;

	return (
		<div className="grid gap-4">
			{backLink}
			<PageHeader
				title={patient.fullName}
				actions={
					<Button asChild>
						<a href={phoneHref}>
							<PhoneIcon />
							{t("patients.call")}
						</a>
					</Button>
				}
			/>
			<Tabs
				value={tab}
				onValueChange={(value) =>
					setTab(PATIENT_TABS.find((option) => option === value) ?? "overview")
				}
				className="gap-4"
			>
				<TabsList>
					<TabsTrigger value="overview">{t("patients.overview")}</TabsTrigger>
					<TabsTrigger value="visits">
						{t("patients.visits")}
						<span className="text-muted-foreground tabular-nums">
							{number.format(appointments.length)}
						</span>
					</TabsTrigger>
				</TabsList>
				<TabsContent
					value="overview"
					className="grid @4xl/main:grid-cols-3 items-start gap-4"
				>
					<div className="grid gap-4">
						<Card>
							<CardContent className="grid gap-8">
								<div className="grid justify-items-center gap-3 text-center">
									<PersonAvatar
										name={patient.fullName}
										className="size-20 [&_[data-slot=avatar-fallback]]:text-2xl"
									/>
									<div className="grid gap-1">
										<p className="flex flex-wrap items-center justify-center gap-2 font-display font-semibold text-xl">
											<span dir="auto">{patient.fullName}</span>
											<Badge variant={PATIENT_STATUS_BADGE[status]}>
												{t(`patients.statuses.${status}`)}
											</Badge>
										</p>
										<p className="text-muted-foreground text-sm">
											{`${formatAge(patient.dateOfBirth, now, locale)} · ${t(`sexes.${patient.sex}`)}`}
										</p>
									</div>
								</div>
								<dl className="grid grid-cols-3 divide-x rounded-md border bg-muted/40 text-center rtl:divide-x-reverse">
									<Stat
										label={t("patients.visitsDone")}
										value={number.format(patient.visitCount)}
									/>
									<Stat
										label={t("patients.upcoming")}
										value={number.format(upcoming)}
									/>
									<Stat
										label={t("patients.noShows")}
										value={number.format(noShows)}
									/>
								</dl>
								<ul className="grid gap-4 text-sm">
									<ContactRow icon={<EnvelopeSimpleIcon className="size-4" />}>
										{patient.email ? (
											<a
												href={`mailto:${patient.email}`}
												className="break-all hover:underline"
												dir="ltr"
											>
												{patient.email}
											</a>
										) : (
											<span className="text-muted-foreground">
												{t("patients.noEmail")}
											</span>
										)}
									</ContactRow>
									<ContactRow icon={<PhoneIcon className="size-4" />}>
										<span className="tabular-nums" dir="ltr">
											{patient.phone}
										</span>
									</ContactRow>
									<ContactRow
										icon={<IdentificationCardIcon className="size-4" />}
									>
										{`${patient.fileNumber} · ${t(`coverage.${patient.coverage}`)}`}
									</ContactRow>
									<ContactRow icon={<StethoscopeIcon className="size-4" />}>
										{patient.primaryPractitioner?.fullName ?? "–"}
									</ContactRow>
									<ContactRow icon={<CalendarBlankIcon className="size-4" />}>
										{`${t("patients.since")} ${date.format(patient.registeredAt)}`}
									</ContactRow>
									<ContactRow icon={<DropIcon className="size-4" />}>
										{`${t("patients.bloodType")} ${patient.bloodType}`}
									</ContactRow>
								</ul>
							</CardContent>
						</Card>
						<Card>
							<CardHeader>
								<CardTitle>{t("patients.attendance")}</CardTitle>
							</CardHeader>
							<CardContent>
								{attendance === null ? (
									<p className="text-muted-foreground text-sm">
										{t("patients.noVisitDue")}
									</p>
								) : (
									<div className="flex items-center gap-4">
										<Progress
											value={attendance * 100}
											className="h-2 flex-1"
											aria-label={t("patients.attendance")}
										/>
										<span className="text-muted-foreground text-sm tabular-nums">
											{new Intl.NumberFormat(locale, {
												style: "percent",
											}).format(attendance)}
										</span>
									</div>
								)}
							</CardContent>
						</Card>
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
									variant="outline"
								/>
								{patient.note ? (
									<p className="border-t pt-4 text-muted-foreground" dir="auto">
										{patient.note}
									</p>
								) : null}
							</CardContent>
						</Card>
					</div>
					<div className="@4xl/main:col-span-2 grid gap-4">
						<VisitHistoryCard
							appointments={appointments}
							now={now}
							onViewAll={() => setTab("visits")}
						/>
						<div className="grid @2xl/main:grid-cols-2 items-start gap-4">
							<PaymentsCard appointments={appointments} now={now} />
							<CareTeamCard patient={patient} appointments={appointments} />
						</div>
					</div>
				</TabsContent>
				<TabsContent value="visits">
					<PatientVisitsTable appointments={appointments} now={now} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

type StatProps = {
	label: string;
	/** The formatted value. */
	value: string;
};

// One cell of the boxed figure row of the profile card.
function Stat({ label, value }: StatProps) {
	return (
		<div className="grid gap-1 px-2 py-3">
			{/* The term comes first in the DOM, as a dl needs. The grid shows the value above it, as in the kit. */}
			<dt className="order-last text-muted-foreground text-xs">{label}</dt>
			<dd className="font-numeric font-semibold text-lg tabular-nums">
				{value}
			</dd>
		</div>
	);
}

type ContactRowProps = {
	/** A size-4 Phosphor icon that names the fact. */
	icon: ReactNode;
	children: ReactNode;
};

// One fact of the profile card: a muted icon and the value.
function ContactRow({ icon, children }: ContactRowProps) {
	return (
		<li className="flex min-w-0 items-center gap-3">
			<span className="shrink-0 text-muted-foreground">{icon}</span>
			<span className="min-w-0">{children}</span>
		</li>
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
	variant: "warning" | "outline";
};

// A named list of badges, or one muted sentence when the file holds none.
function TagList({ label, items, empty, variant }: TagListProps) {
	return (
		<div className="grid gap-2">
			<span className="text-muted-foreground text-xs">{label}</span>
			{items.length === 0 ? (
				<span className="text-muted-foreground">{empty}</span>
			) : (
				<span className="flex flex-wrap gap-2">
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
		<div className="grid gap-4">
			<Skeleton className="h-8 w-28" />
			<div className="flex items-end justify-between gap-3">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-9 w-24" />
			</div>
			<Skeleton className="h-9 w-48" />
			<div className="grid @4xl/main:grid-cols-3 items-start gap-4">
				<Skeleton className="h-160" />
				<Skeleton className="@4xl/main:col-span-2 h-160" />
			</div>
		</div>
	);
}
