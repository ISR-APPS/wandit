import { HOW_IT_WORKS } from "../lib/constants";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

export function HowItWorks() {
	return (
		<section id="how-it-works" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					kicker={HOW_IT_WORKS.kicker}
					title={HOW_IT_WORKS.title}
				/>
				<div className="grid gap-4 md:grid-cols-3 md:gap-6">
					{HOW_IT_WORKS.steps.map((step, index) => (
						<Reveal key={step.number} delay={index * 0.08}>
							<div className="relative h-full rounded-2xl border border-border bg-card/50 p-6 md:p-7">
								<span className="font-medium font-mono text-primary text-sm tabular-nums">
									{step.number}
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
