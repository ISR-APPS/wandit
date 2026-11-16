// The results section on pale sky: what a graduating class becomes, as two fact plates and four meters.
// LandingPage renders it after the admission band. The copy and the survey base are in the `results` group.
import { useT } from "~/shared/i18n";
import { BAND, EYEBROW, H2, WRAP } from "../lib/type-styles";
import { ResultMeter } from "./result-meter";

/** Heading and plates on the start side, meters on the end side. One column under 900px. */
export function ResultsSection() {
	const { t } = useT();
	const meters = [
		{
			label: t("results.firstYearLabel"),
			context: t("results.firstYearContext"),
			percent: 92,
			tone: "navy",
		},
		{
			label: t("results.employmentLabel"),
			context: t("results.employmentContext"),
			percent: 87,
			tone: "sky",
		},
		{
			label: t("results.internshipLabel"),
			context: t("results.internshipContext"),
			percent: 100,
			tone: "navy",
		},
		{
			label: t("results.mastersLabel"),
			context: t("results.mastersContext"),
			percent: 34,
			tone: "sky",
		},
	] as const;
	const plates = [
		{ value: t("results.plate1Value"), label: t("results.plate1Label") },
		{ value: t("results.plate2Value"), label: t("results.plate2Label") },
	];
	return (
		<section
			id="results"
			aria-labelledby="results-title"
			// Pale sky, not sand: the theme sand is a tan beige, so the page keeps it for small accents only.
			className={`${BAND} bg-(--cn-pale)`}
		>
			<div
				className={`${WRAP} grid items-start gap-[clamp(28px,4vw,68px)] min-[900px]:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]`}
			>
				<div data-stagger="" className="flex min-w-0 flex-col gap-4">
					<span data-pop="" className={EYEBROW}>
						{t("results.eyebrow")}
					</span>
					<h2 id="results-title" data-pop="" className={`${H2} max-w-[14ch]`}>
						{t("results.title")}
					</h2>
					<p
						data-pop=""
						className="text-(--cn-ink-2) text-[0.9375rem] leading-[1.6]"
					>
						{t("results.body")}
					</p>
					<ul
						aria-label={t("results.platesLabel")}
						className="mt-1 grid grid-cols-1 gap-3 min-[440px]:grid-cols-2"
					>
						{plates.map((plate) => (
							<li
								key={plate.label}
								data-pop=""
								className="cn-r bg-card px-5 py-4.5"
							>
								<b className="block font-bold font-display text-[clamp(1.35rem,2vw,1.75rem)] tabular-nums leading-none tracking-[-0.03em]">
									{plate.value}
								</b>
								<span className="mt-2 block text-(--cn-ink-2) text-[0.8125rem] leading-[1.45]">
									{plate.label}
								</span>
							</li>
						))}
					</ul>
				</div>
				<ul
					aria-label={t("results.metersLabel")}
					data-stagger=""
					className="flex min-w-0 flex-col gap-[clamp(18px,2.2vw,26px)] min-[900px]:pt-2"
				>
					{meters.map((meter) => (
						<ResultMeter key={meter.label} {...meter} />
					))}
				</ul>
			</div>
		</section>
	);
}
