// The path of a matter from intake to closed: one bar per stage, with the date the matter entered it.
// MatterDetailPage renders it under the page header. A declined matter shows intake, then declined.
import {
	MATTER_STAGE_DOT,
	type MatterStage,
	STAGE_PATH,
	type StageChangeRow,
} from "~/features/practice";
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { Card, CardContent } from "~/shared/ui/card";

type StagePathProps = {
	/** The current stage of the matter. */
	stage: MatterStage;
	/** The moves of the matter into each stage, oldest first. */
	changes: StageChangeRow[];
};

/**
 * Done and current stages show a filled bar and a date. Later stages show an empty bar.
 * Under the xl container width the five labels do not fit, so one line names only the current stage.
 */
export function StagePath({ stage, changes }: StagePathProps) {
	const { t, locale } = useT();
	const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
	const steps: readonly MatterStage[] =
		stage === "declined" ? ["intake", "declined"] : STAGE_PATH;
	const currentIndex = steps.indexOf(stage);
	const dateOf = (step: MatterStage) => {
		const change = changes.find((row) => row.stage === step);
		return change ? date.format(new Date(change.changedAt)) : null;
	};
	const currentDate = dateOf(stage);
	return (
		<Card className="py-5">
			<CardContent className="grid gap-3 px-5">
				<ol
					aria-label={t("matters.stagePath")}
					className={cn(
						"grid gap-3",
						steps.length === 2 ? "grid-cols-2" : "grid-cols-5",
					)}
				>
					{steps.map((step, index) => {
						const isReached = index <= currentIndex;
						const stepDate = isReached ? dateOf(step) : null;
						return (
							<li
								key={step}
								className="grid content-start gap-2"
								aria-current={step === stage ? "step" : undefined}
							>
								<span
									aria-hidden="true"
									className={cn(
										"h-1.5 rounded-full",
										isReached ? MATTER_STAGE_DOT[step] : "bg-muted",
									)}
								/>
								{/* Under xl the labels stay for screen readers only; the line below shows the current one. */}
								<span className="sr-only @xl/main:not-sr-only grid gap-0.5">
									<span
										className={cn(
											"text-sm",
											step === stage
												? "font-semibold"
												: isReached
													? "text-foreground"
													: "text-muted-foreground",
										)}
									>
										{t(`stages.${step}`)}
									</span>
									<span className="text-muted-foreground text-xs tabular-nums">
										{stepDate ?? " "}
									</span>
								</span>
							</li>
						);
					})}
				</ol>
				<p
					aria-hidden="true"
					className="flex @xl/main:hidden items-baseline justify-between gap-3"
				>
					<span className="font-semibold text-sm">{t(`stages.${stage}`)}</span>
					<span className="text-muted-foreground text-xs tabular-nums">
						{currentDate}
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
