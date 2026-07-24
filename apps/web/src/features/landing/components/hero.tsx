import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import Lottie from "lottie-react";
import { motion, type Variants } from "motion/react";

import { useSession } from "@/features/auth";
import { InsufficientCreditsDialog } from "@/features/credits";
import { PromptBox, useCreateProjectWithPrompt } from "@/features/projects";

import orbAnimation from "../assets/ai-sphere-animation.json";

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
};

export function Hero({ promptKey, promptInitial }: HeroProps) {
	const { create, isCreating, insufficientOpen, setInsufficientOpen, cost } =
		useCreateProjectWithPrompt();
	const { data: session } = useSession();
	const { t } = useTranslation();
	const hero = useDictionary().landing.hero;

	return (
		<section className="relative overflow-hidden px-4 pt-32 pb-16 md:pt-40 md:pb-24">
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
				{/* Animated orb, radially masked so it melts into the backdrop */}
				<motion.div
					variants={item}
					aria-hidden
					className="mask-b-from-60% mask-radial-[50%_50%] mask-radial-from-30% pointer-events-none mx-auto -mt-24 -mb-10 hidden w-64 md:block"
				>
					<Lottie
						animationData={orbAnimation}
						loop
						autoplay
						className="w-full"
					/>
				</motion.div>

				<motion.h1
					variants={item}
					className="mt-6 font-bold font-display text-[2.75rem] leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-7xl"
				>
					{t("landing.hero.titleLine1")}
					<span className="block pb-1 text-gradient-ember">
						{t("landing.hero.titleLine2")}
					</span>
				</motion.h1>

				<motion.p
					variants={item}
					className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg"
				>
					{t("landing.hero.sub")}
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
						showBanner
						showModes
						attachmentsEnabled={Boolean(session)}
						initialValue={promptInitial}
						onSubmit={create}
						isSubmitting={isCreating}
						className="relative text-start"
					/>
				</motion.div>

				<motion.div
					variants={item}
					className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-[11px] text-muted-foreground"
				>
					{hero.trust.map((line) => (
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
