import { Badge } from "@my-better-t-app/ui/components/badge";
import { motion, type Variants } from "motion/react";

import { Spark } from "@/components/logo";
import { InsufficientCreditsDialog } from "@/features/credits";
import { PromptBox, useCreateProjectWithPrompt } from "@/features/projects";

import { HERO } from "../lib/constants";

const container: Variants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const item: Variants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

type HeroProps = {
	promptKey: number;
	promptInitial: string;
	onPrefill: (prompt: string) => void;
};

export function Hero({ promptKey, promptInitial, onPrefill }: HeroProps) {
	const { create, isCreating, insufficientOpen, setInsufficientOpen, cost } =
		useCreateProjectWithPrompt();

	return (
		<section className="relative overflow-hidden px-4 pt-32 pb-16 md:pt-44 md:pb-24">
			{/* Dot-grid backdrop, fading out from center */}
			<div aria-hidden className="absolute inset-x-0 top-0 h-[560px] bg-dots" />
			{/* Film grain, dark mode only — sits under the content layer */}
			<div
				aria-hidden
				className="absolute inset-0 hidden bg-grain dark:block"
			/>

			<motion.div
				variants={container}
				initial="hidden"
				animate="show"
				className="relative mx-auto flex max-w-3xl flex-col items-center text-center"
			>
				<motion.div variants={item}>
					<Badge
						variant="outline"
						className="gap-1.5 border-primary/25 bg-primary/10 px-3 py-1 text-foreground"
					>
						<Spark className="size-3 text-primary" />
						{HERO.badge}
					</Badge>
				</motion.div>

				<motion.h1
					variants={item}
					className="mt-6 font-bold font-display text-[2.75rem] leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-7xl"
				>
					{HERO.titleLine1}
					<span className="block pb-1 text-gradient-ember">
						{HERO.titleLine2}
					</span>
				</motion.h1>

				<motion.p
					variants={item}
					className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg"
				>
					{HERO.sub}
				</motion.p>

				<motion.div variants={item} className="relative mt-9 w-full max-w-2xl">
					{/* Soft ember radial glow behind the prompt box */}
					<div
						aria-hidden
						className="absolute -inset-x-12 -inset-y-16 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent_70%)]"
					/>
					<PromptBox
						key={promptKey}
						variant="hero"
						initialValue={promptInitial}
						onSubmit={create}
						isSubmitting={isCreating}
						className="relative text-left"
					/>
				</motion.div>

				<motion.div
					variants={item}
					className="mt-5 flex flex-wrap items-center justify-center gap-2"
				>
					{HERO.chips.map((chip) => (
						<button
							key={chip.label}
							type="button"
							onClick={() => onPrefill(chip.prompt)}
							className="rounded-full border border-border bg-card/50 px-3 py-1.5 text-muted-foreground text-xs outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
						>
							{chip.label}
						</button>
					))}
				</motion.div>

				<motion.div
					variants={item}
					className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground"
				>
					{HERO.trust.map((line) => (
						<span key={line} className="inline-flex items-center gap-2">
							<span aria-hidden className="size-1 rounded-full bg-primary/70" />
							{line}
						</span>
					))}
				</motion.div>
			</motion.div>

			<InsufficientCreditsDialog
				open={insufficientOpen}
				onOpenChange={setInsufficientOpen}
				cost={cost}
			/>
		</section>
	);
}
