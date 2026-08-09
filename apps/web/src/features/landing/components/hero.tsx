import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { ChevronDown } from "lucide-react";
import {
	motion,
	useInView,
	useReducedMotion,
	type Variants,
} from "motion/react";
import { useEffect, useRef } from "react";

import { useSession } from "@/features/auth";
import {
	InsufficientCreditsDialog,
	OutOfCreditsBanner,
	useOutOfCredits,
} from "@/features/credits";
import { PromptBox, useCreateProjectWithPrompt } from "@/features/projects";

import orbAnimation from "../assets/ai-sphere-animation.json";
import { scrollToId } from "../lib/scroll";

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
	// Session-gated: signed-out visitors are never blocked here — their submit
	// goes through the auth flow, not a credit debit.
	const { outOfCredits } = useOutOfCredits();
	const { t } = useTranslation();
	const hero = useDictionary().landing.hero;

	const sectionRef = useRef<HTMLElement>(null);
	const inView = useInView(sectionRef, { amount: 0.2 });
	const reduced = useReducedMotion();
	const lottieRef = useRef<LottieRefCurrentProps>(null);

	// The orb renders SVG frames on the main thread — freeze it on a resting
	// frame under reduced motion and pause it whenever the hero is off screen.
	useEffect(() => {
		const orb = lottieRef.current;
		if (!orb) return;
		if (reduced) {
			orb.goToAndStop(60, true);
			return;
		}
		if (inView) {
			orb.play();
		} else {
			orb.pause();
		}
	}, [inView, reduced]);

	return (
		<section
			ref={sectionRef}
			className="relative flex min-h-svh flex-col overflow-hidden px-4 pt-24 pb-24 md:pt-28 md:pb-16"
		>
			{/* Dot-grid backdrop, fading out from center */}
			<div aria-hidden className="absolute inset-x-0 top-0 h-[640px] bg-dots" />
			{/* Ambient aurora — two ember blobs drifting behind the stage. No blur
			   filter: the radial alpha ramp alone keeps them soft at zero GPU cost,
			   and the bottom blob fades out before the section edge can clip it. */}
			<div
				aria-hidden
				className="absolute -start-24 -top-40 h-[480px] w-[560px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-1)_22%,transparent),transparent_78%)] motion-safe:animate-drift-slow"
			/>
			<div
				aria-hidden
				className="absolute -end-32 -bottom-48 h-[520px] w-[620px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-2)_16%,transparent),transparent_78%)] [mask-image:linear-gradient(to_bottom,black_30%,transparent_60%)] motion-safe:animate-drift-slower"
			/>
			{/* Film grain, dark mode only — fades out before the section seam */}
			<div
				aria-hidden
				className="mask-b-from-80% absolute inset-0 hidden bg-grain dark:block"
			/>

			<motion.div
				variants={container}
				initial="hidden"
				animate="show"
				className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center"
			>
				{/* The living orb — small, sharp, crowning the stage. Its gradient
				   stops are graded into the ember family in the animation JSON so
				   the focal point stays inside the one-accent palette. */}
				<motion.div
					variants={item}
					aria-hidden
					className="mask-b-from-75% pointer-events-none -mt-10 -mb-3 w-36 md:w-44"
				>
					<Lottie
						lottieRef={lottieRef}
						animationData={orbAnimation}
						loop
						autoplay={!reduced}
						className="w-full"
					/>
				</motion.div>

				<motion.p
					variants={item}
					className="relative inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3.5 py-1.5 font-medium font-mono text-[11px] text-muted-foreground uppercase tracking-[0.16em] backdrop-blur-sm"
				>
					<span
						aria-hidden
						className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse-soft"
					/>
					{t("landing.hero.eyebrow")}
				</motion.p>

				<motion.h1
					variants={item}
					className="relative mt-5 max-w-2xl text-balance font-bold font-display text-4xl leading-[1.06] tracking-[-0.03em] sm:text-5xl md:text-[3.4rem] rtl:leading-[1.2] rtl:tracking-normal"
				>
					{t("landing.hero.titleLine1")}
					<span className="block pb-1 text-gradient-ember">
						{t("landing.hero.titleLine2")}
					</span>
				</motion.h1>

				<motion.p
					variants={item}
					className="relative mt-4 max-w-2xl text-pretty text-base text-muted-foreground md:text-lg"
				>
					{t("landing.hero.sub")}
				</motion.p>

				<motion.div variants={item} className="relative mt-8 w-full max-w-2xl">
					{/* Soft ember radial glow behind the prompt box */}
					<div
						aria-hidden
						className="absolute -inset-x-12 -inset-y-16 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--color-primary)_16%,transparent),transparent_70%)]"
					/>
					{outOfCredits ? (
						<OutOfCreditsBanner className="relative mb-3 text-start" />
					) : null}
					<PromptBox
						key={promptKey}
						variant="hero"
						showBanner
						showModes
						attachmentsEnabled={Boolean(session)}
						disabled={outOfCredits}
						initialValue={promptInitial}
						onSubmit={create}
						isSubmitting={isCreating}
						className="relative text-start"
					/>
				</motion.div>

				<motion.div
					variants={item}
					className="relative mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-muted-foreground text-xs"
				>
					{hero.trust.map((line) => (
						<span key={line} className="inline-flex items-center gap-2">
							<span aria-hidden className="size-1 rounded-full bg-primary/70" />
							{line}
						</span>
					))}
				</motion.div>
			</motion.div>

			{/* Scroll cue — an invitation, not a button */}
			<motion.button
				type="button"
				onClick={() => scrollToId("how-it-works")}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.4, duration: 0.8 }}
				aria-label={t("landing.nav.links.how-it-works")}
				className="absolute bottom-6 left-1/2 flex size-11 -translate-x-1/2 items-center justify-center rounded-full border border-border/80 bg-card/60 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
			>
				<motion.span
					aria-hidden
					animate={inView ? { y: [0, 3, 0] } : { y: 0 }}
					transition={{
						duration: 1.8,
						repeat: inView ? Number.POSITIVE_INFINITY : 0,
						ease: "easeInOut",
					}}
					className="flex"
				>
					<ChevronDown className="size-4" />
				</motion.span>
			</motion.button>

			<InsufficientCreditsDialog
				open={insufficientOpen}
				onOpenChange={setInsufficientOpen}
				cost={cost}
			/>
		</section>
	);
}
