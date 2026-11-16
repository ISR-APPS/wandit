// The method: four steps hung on one brass arc, with an arched door in the middle that offers a call.
// LandingPage renders it. On xl screens the arc draws itself in view; below that the steps form a list or a grid.
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { MethodDoor } from "./method-door";
import { SectionHead } from "./section-head";

const STEPS = ["visit", "sketch", "material", "site"] as const;

// Where each medallion and step text sits on the arc, in percent of the 1200 by 640 spine box.
// The medallions sit on the curve. Each text hangs under its medallion; 7.5rem is half of its w-60 width.
const ARC_PLACES = [
	{ medal: "start-[3.3%] top-[65.6%]", step: "start-0 top-[74%]" },
	{
		medal: "start-[26.6%] top-[25%]",
		step: "start-[calc(26.6%_-_7.5rem)] top-[33%]",
	},
	{
		medal: "start-[73.4%] top-[25%]",
		step: "start-[calc(73.4%_-_7.5rem)] top-[33%]",
	},
	{ medal: "start-[96.7%] top-[65.6%]", step: "end-0 top-[74%]" },
];

/** The method section. The arc and the list hold the same four steps; CSS shows one of them. */
export function MethodSection() {
	const { t } = useT();
	return (
		<section
			id="method"
			aria-labelledby="method-title"
			className="louz-section louz-sand"
		>
			<div className="mx-auto max-w-[1340px] px-5 sm:px-8">
				<SectionHead
					tag={t("method.tag")}
					title={t("method.title")}
					titleId="method-title"
					intro={t("method.intro")}
					className="mb-12 xl:mb-4"
				/>

				<div
					data-reveal
					className="louz-spine relative mb-12 hidden aspect-[1200/640] w-full xl:block"
				>
					<svg
						viewBox="0 0 1200 640"
						preserveAspectRatio="none"
						aria-hidden="true"
						focusable="false"
						className="absolute inset-0 size-full overflow-visible"
					>
						<path
							className="louz-spine-path"
							d="M40 420 A560 300 0 0 1 1160 420"
							pathLength={1}
							fill="none"
							strokeWidth={3}
							strokeLinecap="round"
						/>
					</svg>
					<ol>
						{STEPS.map((step, index) => (
							<li key={step}>
								<span
									aria-hidden="true"
									className={cn(
										"louz-medal louz-on-arc absolute flex size-[58px] -translate-x-1/2 -translate-y-1/2 items-center justify-center font-display text-[1.4rem] rtl:translate-x-1/2",
										`louz-on-arc-${index + 1}`,
										ARC_PLACES[index]?.medal,
									)}
								>
									{index + 1}
								</span>
								<div
									className={cn(
										"louz-on-arc absolute w-60",
										`louz-on-arc-${index + 1}`,
										ARC_PLACES[index]?.step,
									)}
								>
									<h3 className="mb-1.5 font-display font-normal text-[1.25rem]">
										{t(`method.${step}.title`)}
									</h3>
									<p className="mb-2.5 text-[0.95rem] leading-normal">
										{t(`method.${step}.body`)}
									</p>
									<span className="louz-chip inline-block font-bold text-[0.72rem] leading-none">
										{t(`method.${step}.chip`)}
									</span>
								</div>
							</li>
						))}
					</ol>
					<MethodDoor className="absolute start-1/2 top-[58%] -translate-x-1/2 rtl:translate-x-1/2" />
				</div>

				<ol className="grid gap-x-14 gap-y-10 sm:grid-cols-2 xl:hidden">
					{STEPS.map((step, index) => (
						<li key={step} data-reveal className="relative ps-[4.4rem]">
							{/* The rail joins the medallions in the one-column list only. */}
							{index < STEPS.length - 1 && (
								<span
									aria-hidden="true"
									className="absolute start-[27px] top-[60px] -bottom-10 w-0.5 bg-foreground/25 sm:hidden"
								/>
							)}
							<span
								aria-hidden="true"
								className="louz-medal absolute start-0 top-0 flex size-14 items-center justify-center font-display text-[1.3rem]"
							>
								{index + 1}
							</span>
							<h3 className="mb-1.5 pt-3 font-display font-normal text-[1.25rem]">
								{t(`method.${step}.title`)}
							</h3>
							<p className="mb-2.5 max-w-[52ch] text-[0.95rem] leading-normal">
								{t(`method.${step}.body`)}
							</p>
							<span className="louz-chip inline-block font-bold text-[0.72rem] leading-none">
								{t(`method.${step}.chip`)}
							</span>
						</li>
					))}
				</ol>
				<MethodDoor className="mx-auto mt-14 xl:hidden" />
			</div>
		</section>
	);
}
