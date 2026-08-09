import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";
import {
	ArrowRight,
	Clapperboard,
	Code2,
	Megaphone,
	Palette,
	Sparkles,
	Target,
} from "lucide-react";
import { motion } from "motion/react";

import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

const ROLE_ICONS = [Code2, Palette, Clapperboard, Megaphone, Target];

/** Slight scatter so the old-way stack reads as clutter, not a tidy list. */
const ROLE_TILTS = [-1.6, 1.2, -0.8, 1.6, -1.2];

export function Problem() {
	const { t } = useTranslation();
	const dictionary = useDictionary().landing;
	const problem = dictionary.problem;
	// The ember card resolves the role clutter into concrete deliverables —
	// the same artifact list the showcase animates one section above.
	const artifacts = dictionary.howItWorks.demo.artifacts;

	return (
		<section className="overflow-hidden px-4 py-20 md:py-28">
			<div className="mx-auto max-w-5xl">
				<SectionHeader
					kicker={t("landing.problem.kicker")}
					title={t("landing.problem.title")}
				/>

				<div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:gap-x-8 md:gap-y-4">
					{/* Full-width label row keeps both column tops aligned below it */}
					<Reveal className="md:col-span-3">
						<p className="font-medium font-mono text-muted-foreground text-xs uppercase tracking-[0.16em] rtl:tracking-normal">
							{t("landing.problem.intro")}
						</p>
					</Reveal>

					{/* The old way — a pile of people and tools */}
					<Reveal>
						<div className="flex flex-col gap-3 md:gap-2.5">
							{problem.roles.map((role, index) => {
								const Icon = ROLE_ICONS[index % ROLE_ICONS.length];
								return (
									<motion.div
										key={role}
										initial={{ opacity: 0, y: 14, rotate: 0 }}
										whileInView={{
											opacity: 1,
											y: 0,
											rotate: ROLE_TILTS[index % ROLE_TILTS.length],
										}}
										viewport={{ once: true, margin: "-64px" }}
										transition={{
											duration: 0.5,
											delay: index * 0.08,
											ease: "easeOut",
										}}
										className="flex items-center gap-3 rounded-xl border border-border border-dashed bg-muted/40 px-4 py-3"
									>
										<span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
											<Icon className="size-4" />
										</span>
										<span className="text-muted-foreground text-sm md:text-base">
											{role}
										</span>
									</motion.div>
								);
							})}
						</div>
					</Reveal>

					{/* The turn — lands after the clutter has piled up */}
					<Reveal
						delay={0.55}
						className="flex items-center justify-center self-center"
					>
						<span className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-card">
							<ArrowRight className="size-4.5 max-md:rotate-90 rtl:md:-scale-x-100" />
						</span>
					</Reveal>

					{/* The Wandit way — one calm ember card, the final beat */}
					<Reveal delay={0.75} className="flex">
						<motion.div
							initial={{ scale: 0.96 }}
							whileInView={{ scale: 1 }}
							viewport={{ once: true, margin: "-64px" }}
							transition={{
								type: "spring",
								stiffness: 200,
								damping: 22,
								delay: 0.75,
							}}
							className="relative flex flex-1 flex-col justify-center overflow-hidden rounded-2xl border border-primary/25 bg-card p-6 shadow-card md:p-8"
						>
							<div
								aria-hidden
								className="absolute -end-20 -top-24 size-56 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-primary)_22%,transparent),transparent_70%)]"
							/>
							<span className="relative inline-flex items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1 font-medium font-mono text-[11px] text-ember-strong uppercase tracking-[0.16em] rtl:tracking-normal">
								<Sparkles className="size-3" />
								{t("landing.problem.solution")}
							</span>
							<p className="relative mt-4 text-pretty font-display font-semibold text-xl leading-snug tracking-[-0.01em] md:text-2xl rtl:tracking-normal">
								{t("landing.problem.resolution")}
							</p>
							{/* The payoff in concrete terms — what the one AI delivers */}
							<div className="relative mt-6 flex flex-wrap gap-2">
								{artifacts.map((artifact, index) => (
									<motion.span
										key={artifact}
										initial={{ opacity: 0, y: 8 }}
										whileInView={{ opacity: 1, y: 0 }}
										viewport={{ once: true, margin: "-64px" }}
										transition={{ delay: 0.95 + index * 0.08, duration: 0.4 }}
										className="rounded-full border border-border bg-background/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground uppercase tracking-[0.08em] [&:lang(ar)]:tracking-normal"
									>
										{artifact}
									</motion.span>
								))}
							</div>
						</motion.div>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
