// The object record: a centered wall label with the materials line and ten specification rows.
// LandingPage renders it. The "Details" link of the header jumps here.
import { useT } from "~/shared/i18n";
import { CHAPTER, KICKER, MICRO, WRAP } from "../lib/type-styles";

/** One specification row. A row with a `figure` promotes the number to the display face. */
type SpecRow = {
	label: string;
	/** Words before the number, for example "LED module,". */
	prefix?: string;
	/** The number, set at 1.35rem in the display face. */
	figure?: string;
	/** The unit or the whole value after the number. */
	text: string;
};

/** Two columns of five rows from 600px. The only centered block of the page with the footer wordmark. */
export function SpecsSection() {
	const { t } = useT();
	const columns: SpecRow[][] = [
		[
			{
				label: t("specs.height"),
				figure: t("specs.heightValue"),
				text: t("specs.heightUnit"),
			},
			{
				label: t("specs.diameter"),
				figure: t("specs.diameterValue"),
				text: t("specs.diameterUnit"),
			},
			{
				label: t("specs.weight"),
				figure: t("specs.weightValue"),
				text: t("specs.weightUnit"),
			},
			{ label: t("specs.materials"), text: t("specs.materialsValue") },
			{ label: t("specs.colorways"), text: t("specs.colorwaysValue") },
		],
		[
			{
				label: t("specs.light"),
				prefix: t("specs.lightPrefix"),
				figure: t("specs.lightValue"),
				text: t("specs.lightUnit"),
			},
			{
				label: t("specs.output"),
				figure: t("specs.outputValue"),
				text: t("specs.outputUnit"),
			},
			{
				label: t("specs.battery"),
				figure: t("specs.batteryValue"),
				text: t("specs.batteryUnit"),
			},
			{ label: t("specs.charging"), text: t("specs.chargingValue") },
			{ label: t("specs.cable"), text: t("specs.cableValue") },
		],
	];
	return (
		<section
			id="details"
			aria-labelledby="details-title"
			className={`${CHAPTER} scroll-mt-[4.5rem]`}
		>
			<div className={WRAP}>
				<div
					data-reveal
					className="lume-placard mx-auto max-w-[62rem] rounded-[1.2rem] border border-foreground/16 px-5 py-10 sm:p-[clamp(2rem,5vw,4rem)]"
				>
					<div className="mb-[clamp(2.2rem,4vw,3.4rem)] text-center">
						<p className={`${KICKER} mb-[1.2rem] justify-center`}>
							{t("specs.kicker")}
						</p>
						<h2
							id="details-title"
							className="font-display font-medium text-[clamp(1.7rem,3vw,2.4rem)] tracking-[-0.01em]"
						>
							{t("specs.title")}
						</h2>
						<p className="lume-serif mx-auto mt-2 max-w-[34em] text-balance text-[1.02rem] text-foreground/72">
							{t("specs.medium")}
						</p>
						<div
							aria-hidden="true"
							className="mx-auto mt-[1.4rem] h-px w-[3.4rem] bg-primary"
						/>
					</div>
					<div className="grid sm:grid-cols-2 sm:gap-x-[clamp(2rem,5vw,4.5rem)]">
						{columns.map((rows) => (
							<dl key={rows[0]?.label}>
								{rows.map((row) => (
									<div
										key={row.label}
										className="flex flex-col gap-1 border-foreground/16 border-t py-[0.95rem] sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
									>
										<dt className={`${MICRO} flex-none text-[0.72rem]`}>
											{row.label}
										</dt>
										<dd className="text-[0.98rem] sm:text-end">
											{row.prefix !== undefined && `${row.prefix} `}
											{row.figure !== undefined && (
												<b className="font-display font-medium text-[1.35rem] tabular-nums tracking-[-0.01em]">
													{row.figure}
												</b>
											)}
											{row.figure !== undefined && " "}
											{row.text}
										</dd>
									</div>
								))}
							</dl>
						))}
					</div>
					<p className="mt-[clamp(2rem,4vw,3rem)] text-center text-[0.82rem] text-foreground/52">
						{t("specs.footLead")}{" "}
						<b className="font-medium text-(--lume-brass-deep)">
							{t("specs.footValue")}
						</b>{" "}
						{t("specs.footEnd")}
					</p>
				</div>
			</div>
		</section>
	);
}
