import { Badge } from "@wandit/ui/components/badge";
import { Button } from "@wandit/ui/components/button";
import { Slider } from "@wandit/ui/components/slider";
import { cn } from "@wandit/ui/lib/utils";
import { Check } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

import { useAuthModal, useSession } from "@/features/auth";

import { PRICING } from "../lib/constants";
import { scrollToTop } from "../lib/scroll";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

function FeatureRow({ label }: { label: string }) {
	return (
		<li className="flex items-start gap-2.5 text-sm">
			<Check className="mt-0.5 size-4 shrink-0 text-success" />
			<span>{label}</span>
		</li>
	);
}

function PlanCard({
	popular,
	className,
	children,
}: {
	popular?: boolean;
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"relative flex h-full flex-col rounded-2xl border border-border bg-card/60 p-6",
				popular &&
					"border-primary/40 bg-card shadow-[0_0_56px_-20px_color-mix(in_oklab,var(--color-primary)_50%,transparent)] ring-1 ring-primary/30",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function Pricing() {
	const { data: session } = useSession();
	const { open } = useAuthModal();
	const [credits, setCredits] = useState<number>(PRICING.pro.slider.initial);

	const startBuilding = () => {
		if (session) {
			scrollToTop();
			return;
		}
		open();
	};

	return (
		<section id="pricing" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-5xl">
				<SectionHeader kicker={PRICING.kicker} title={PRICING.title} />
				<div className="grid gap-4 md:grid-cols-3 md:gap-5">
					{/* Free */}
					<Reveal>
						<PlanCard>
							<h3 className="font-display font-semibold text-lg">
								{PRICING.free.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{PRICING.free.tagline}
							</p>
							<div className="mt-5 font-bold font-display text-3xl tracking-[-0.02em]">
								{PRICING.free.price}
							</div>
							<p className="mt-1 font-mono text-muted-foreground text-xs">
								{PRICING.free.creditsLine}
							</p>
							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{PRICING.free.features.map((f) => (
									<FeatureRow key={f} label={f} />
								))}
							</ul>
							<Button
								variant="outline"
								className="mt-8"
								onClick={startBuilding}
							>
								{PRICING.free.cta}
							</Button>
						</PlanCard>
					</Reveal>

					{/* Pro */}
					<Reveal delay={0.07}>
						<PlanCard popular>
							<Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 border-none bg-gradient-ember font-medium font-mono text-[10px] text-[oklch(0.2_0.03_55)] uppercase tracking-[0.14em]">
								{PRICING.pro.badge}
							</Badge>
							<h3 className="font-display font-semibold text-lg">
								{PRICING.pro.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{PRICING.pro.tagline}
							</p>
							<div className="mt-5 font-bold font-mono text-3xl tabular-nums tracking-[-0.02em]">
								{credits.toLocaleString("en-US")}
								<span className="ms-2 font-mono font-normal text-muted-foreground text-sm">
									{PRICING.pro.creditsUnit}
								</span>
							</div>
							<p className="mt-1 font-mono text-muted-foreground text-xs">
								{PRICING.pro.priceNote}
							</p>
							<div className="mt-5">
								<div className="mb-2.5 flex items-center justify-between text-xs">
									<span className="text-muted-foreground">
										{PRICING.pro.sliderLabel}
									</span>
									<span className="font-mono tabular-nums">
										{credits.toLocaleString("en-US")}
									</span>
								</div>
								<Slider
									value={[credits]}
									onValueChange={(value) =>
										setCredits(value[0] ?? PRICING.pro.slider.initial)
									}
									min={PRICING.pro.slider.min}
									max={PRICING.pro.slider.max}
									step={PRICING.pro.slider.step}
									aria-label={PRICING.pro.sliderLabel}
								/>
							</div>
							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{PRICING.pro.features.map((f) => (
									<FeatureRow key={f} label={f} />
								))}
							</ul>
							<Button className="mt-8" onClick={startBuilding}>
								{PRICING.pro.cta}
							</Button>
						</PlanCard>
					</Reveal>

					{/* Business */}
					<Reveal delay={0.14}>
						<PlanCard>
							<h3 className="font-display font-semibold text-lg">
								{PRICING.business.name}
							</h3>
							<p className="mt-1 text-muted-foreground text-sm">
								{PRICING.business.tagline}
							</p>
							<div className="mt-5 font-bold font-display text-3xl tracking-[-0.02em]">
								{PRICING.business.price}
							</div>
							<p className="mt-1 font-mono text-muted-foreground text-xs">
								&nbsp;
							</p>
							<ul className="mt-6 flex flex-1 flex-col gap-2.5">
								{PRICING.business.features.map((f) => (
									<FeatureRow key={f} label={f} />
								))}
							</ul>
							<Button variant="outline" className="mt-8" asChild>
								<a href={PRICING.business.contactHref}>
									{PRICING.business.cta}
								</a>
							</Button>
						</PlanCard>
					</Reveal>
				</div>
				<Reveal className="mt-8 text-center">
					<p className="font-mono text-muted-foreground text-xs">
						{PRICING.note}
					</p>
				</Reveal>
			</div>
		</section>
	);
}
