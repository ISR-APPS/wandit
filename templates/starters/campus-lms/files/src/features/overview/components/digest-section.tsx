// The frame of one section of the home digest: an h2 with its figure at the end, a muted line, a link, and the body.
// The lessons, grading, and enrollments sections render their content inside it.
// It follows the "digest" home of the app-dashboard skill: one Card per section, in one column.
// The file also holds the skeleton and the error state of one section.
import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ChangePill } from "~/features/school";
import { useT } from "~/shared/i18n";
import { Button } from "~/shared/ui/button";
import { Card, CardContent, CardHeader } from "~/shared/ui/card";
import { ArrowRightIcon } from "~/shared/ui/icons";
import { Skeleton } from "~/shared/ui/skeleton";

type DigestSectionProps = {
	/** The section name, already translated. */
	title: string;
	/** The total of the section, already formatted with Intl. */
	figure: string;
	/** Ratio against the previous period. Absent for a figure with no period, null when no earlier data exists. */
	change?: number | null;
	/** One muted line under the title, already translated. */
	description: string;
	/** The list page of the section, for example "/app/courses". */
	seeAllTo: LinkProps["to"];
	/** The words of the link, already translated. */
	seeAllLabel: string;
	children: ReactNode;
};

/** The figure sits inside the h2, so a screen reader hears the title and its total together. */
export function DigestSection({
	title,
	figure,
	change,
	description,
	seeAllTo,
	seeAllLabel,
	children,
}: DigestSectionProps) {
	return (
		<Card className="gap-5">
			<CardHeader className="gap-1.5">
				<h2 className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span className="me-auto font-(--heading-weight) font-display text-xl tracking-(--heading-tracking)">
						{title}
					</span>
					<span className="flex items-center gap-2">
						{change === undefined ? null : <ChangePill change={change} />}
						<span className="font-bold font-numeric text-3xl tabular-nums leading-none">
							{figure}
						</span>
					</span>
				</h2>
				<div className="flex flex-wrap items-center justify-between gap-x-4">
					<p className="text-muted-foreground text-sm">{description}</p>
					{/* min-h-11 gives the link a 44 px touch area on a phone. */}
					<Link
						to={seeAllTo}
						className="inline-flex min-h-11 items-center gap-1 font-medium text-sm underline-offset-4 hover:underline sm:min-h-0"
					>
						{seeAllLabel}
						<ArrowRightIcon className="size-4 rtl:rotate-180" />
					</Link>
				</div>
			</CardHeader>
			<CardContent className="grid gap-6">{children}</CardContent>
		</Card>
	);
}

type DigestSectionErrorProps = {
	/** Runs the queries of the section again. */
	onRetry: () => void;
};

/** A section whose query failed after a period change: one line and Try again. The other sections stay. */
export function DigestSectionError({ onRetry }: DigestSectionErrorProps) {
	const { t } = useT();
	return (
		<Card>
			<CardContent className="grid justify-items-start gap-3">
				<p role="alert" className="text-sm">
					{t("overview.sectionError")}
				</p>
				<Button type="button" variant="outline" size="sm" onClick={onRetry}>
					{t("common.retry")}
				</Button>
			</CardContent>
		</Card>
	);
}

/** Placeholder of one section in its final shape: the heading line, the muted line, and a body block. */
export function DigestSectionSkeleton() {
	return (
		<Card className="gap-5">
			<CardHeader className="gap-2">
				<div className="flex items-center justify-between gap-4">
					<Skeleton className="h-7 w-48" />
					<Skeleton className="h-8 w-20" />
				</div>
				<Skeleton className="h-4 w-72 max-w-full" />
			</CardHeader>
			<CardContent className="grid gap-4">
				<Skeleton className="h-9 w-56" />
				<Skeleton className="h-56 w-full" />
			</CardContent>
		</Card>
	);
}
