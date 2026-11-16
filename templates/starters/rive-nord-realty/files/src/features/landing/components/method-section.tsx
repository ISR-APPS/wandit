// Section 03, the method: the cobalt band with four steps, outlined numerals, and one stamp per step.
// LandingPage renders it. The texts live in the `method` group of messages.ts.
// The stamps slam down one after the other when the band enters the screen (use-reveal.ts and landing.css).
import { useT } from "~/shared/i18n";
import { cn } from "~/shared/lib/utils";
import { useReveal } from "../hooks/use-reveal";
import { DISPLAY, FIGURES, WRAP } from "../lib/type-styles";
import { SectionHead } from "./section-head";
import { Stamp } from "./stamp";

// The delay class of each stamp, so they land in reading order.
const SLAM_DELAYS = ["", "rn-slam-2", "rn-slam-3", "rn-slam-4"] as const;

/** Four columns on a wide screen, two on a tablet, one on a phone. The last stamp is red on paper: "Sold". */
export function MethodSection() {
	const { t } = useT();
	const revealRef = useReveal<HTMLOListElement>();
	const steps = [
		{
			title: t("method.step1Title"),
			body: t("method.step1Body"),
			stamp: t("method.step1Stamp"),
		},
		{
			title: t("method.step2Title"),
			body: t("method.step2Body"),
			stamp: t("method.step2Stamp"),
		},
		{
			title: t("method.step3Title"),
			body: t("method.step3Body"),
			stamp: t("method.step3Stamp"),
		},
		{
			title: t("method.step4Title"),
			body: t("method.step4Body"),
			stamp: t("method.step4Stamp"),
		},
	];

	return (
		<section
			id="method"
			aria-labelledby="method-title"
			className={cn(
				WRAP,
				"rn-on-primary bg-primary py-[clamp(56px,8vw,110px)] text-background",
			)}
		>
			<SectionHead
				tag={t("method.tag")}
				title={t("method.title")}
				note={t("method.note")}
				titleId="method-title"
				onPrimary
			/>
			<ol
				ref={revealRef}
				className="rn-stagger grid border-background/28 border-s sm:grid-cols-2 lg:grid-cols-4"
			>
				{steps.map((step, index) => (
					<li
						key={step.title}
						className="flex flex-col border-background/28 border-e border-b px-[clamp(14px,1.6vw,28px)] pt-2 pb-7.5 lg:min-h-85 lg:border-b-0"
					>
						<span
							aria-hidden="true"
							className={cn(
								DISPLAY,
								FIGURES,
								"rn-outline-num text-[clamp(84px,8vw,128px)] leading-none tracking-[0.02em]",
							)}
						>
							{String(index + 1).padStart(2, "0")}
						</span>
						<h3
							className={cn(
								DISPLAY,
								"mt-3 mb-2.5 text-[clamp(24px,1.9vw,30px)] leading-none",
							)}
						>
							{step.title}
						</h3>
						<p className="mb-6 max-w-[30ch] text-[14px] leading-relaxed opacity-92">
							{step.body}
						</p>
						<Stamp
							tone={index === steps.length - 1 ? "destructive" : "paper"}
							className={cn(
								"rn-slam mt-auto self-start px-3.25 pt-2.25 pb-2 text-[15px]",
								SLAM_DELAYS[index],
								index === steps.length - 1 && "bg-background",
							)}
						>
							{step.stamp}
						</Stamp>
					</li>
				))}
			</ol>
		</section>
	);
}
