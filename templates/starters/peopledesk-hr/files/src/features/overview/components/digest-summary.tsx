// The summary paragraph at the top of the digest: one clause per section, with the figure of its h2.
// OverviewPage renders it under the period title, in the display face.
// t() has no placeholders, so each clause is a message, then a formatted value. A dot ends each clause but the last.
import { Fragment } from "react";
import { useT } from "~/shared/i18n";

type DigestSummaryProps = {
	/** Person-days off in the period: the figure of section 1. */
	daysOff: number;
	/** Change of daysOff against the period before, as a ratio. null hides it. */
	daysOffChange: number | null;
	/** Requests that wait for a manager: the figure of section 2. */
	toReview: number;
	/** Applications in the period: the figure of section 3. */
	applications: number;
	/** Change of applications against the period before, as a ratio. null hides it. */
	applicationsChange: number | null;
};

/** Three short clauses. The deltas stay neutral: more days off is not good or bad news in itself. */
export function DigestSummary({
	daysOff,
	daysOffChange,
	toReview,
	applications,
	applicationsChange,
}: DigestSummaryProps) {
	const { t, locale } = useT();
	const number = new Intl.NumberFormat(locale);
	const percent = new Intl.NumberFormat(locale, {
		style: "percent",
		signDisplay: "exceptZero",
		maximumFractionDigits: 0,
	});
	const clauses = [
		{
			key: "days-off",
			label: t("overview.summaryDaysOff"),
			value: daysOff,
			change: daysOffChange,
		},
		{
			key: "to-review",
			label: t("overview.summaryToReview"),
			value: toReview,
			change: null,
		},
		{
			key: "applications",
			label: t("overview.summaryApplications"),
			value: applications,
			change: applicationsChange,
		},
	];
	return (
		<p className="max-w-prose font-display text-2xl text-muted-foreground leading-snug">
			{clauses.map((clause, index) => (
				<Fragment key={clause.key}>
					{/* A clause never breaks inside. The line breaks only at the space between two clauses. */}
					<span className="whitespace-nowrap">
						{clause.label}{" "}
						<span className="font-numeric text-foreground tabular-nums">
							{number.format(clause.value)}
						</span>
						{clause.change === null ? null : (
							<>
								{" "}
								{/* dir="ltr" keeps "+12%" in this order in an Arabic page. */}
								<bdi dir="ltr" className="text-lg tabular-nums">
									({percent.format(clause.change)})
								</bdi>
								<span className="sr-only">{t("kpi.vsPrevious")}</span>
							</>
						)}
						{index < clauses.length - 1 ? (
							<span className="ps-2" aria-hidden>
								·
							</span>
						) : null}
					</span>{" "}
				</Fragment>
			))}
		</p>
	);
}
