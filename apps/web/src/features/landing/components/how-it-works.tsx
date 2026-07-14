import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

export function HowItWorks() {
	const { t } = useTranslation();
	const howItWorks = useDictionary().landing.howItWorks;

	return (
		<section id="how-it-works" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					kicker={t("landing.howItWorks.kicker")}
					title={t("landing.howItWorks.title")}
				/>
				<div className="grid gap-4 md:grid-cols-3 md:gap-6">
					{howItWorks.steps.map((step, index) => (
						<Reveal key={step.title} delay={index * 0.08}>
							<div className="relative h-full rounded-2xl border border-border bg-card/50 p-6 md:p-7">
								<span className="font-medium font-mono text-primary text-sm tabular-nums">
									{String(index + 1).padStart(2, "0")}
								</span>
								<h3 className="mt-3 font-display font-semibold text-xl tracking-[-0.01em]">
									{step.title}
								</h3>
								<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
									{step.body}
								</p>
							</div>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
