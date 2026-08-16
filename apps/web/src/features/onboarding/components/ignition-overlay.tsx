import { cn } from "@wandit/ui/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { Spark } from "@/components/logo";

const STATUS_INTERVAL_MS = 1400;

const PARTICLES = [
	{ delay: 0, duration: 1.65, x: -34, y: -96, size: 3, color: 1 },
	{ delay: 0.18, duration: 1.85, x: 27, y: -128, size: 5, color: 2 },
	{ delay: 0.36, duration: 1.7, x: -12, y: -142, size: 4, color: 1 },
	{ delay: 0.54, duration: 1.9, x: 43, y: -88, size: 3, color: 2 },
	{ delay: 0.72, duration: 1.75, x: -46, y: -118, size: 6, color: 2 },
	{ delay: 0.9, duration: 1.6, x: 11, y: -106, size: 3, color: 1 },
	{ delay: 1.08, duration: 1.95, x: 35, y: -138, size: 4, color: 1 },
	{ delay: 1.26, duration: 1.8, x: -25, y: -82, size: 5, color: 2 },
] as const;

type IgnitionOverlayProps = {
	lines: readonly string[];
	className?: string;
};

export function IgnitionOverlay({ lines, className }: IgnitionOverlayProps) {
	const reducedMotion = useReducedMotion();
	const [lineIndex, setLineIndex] = useState(0);

	useEffect(() => {
		if (lines.length < 2) return;

		const id = window.setInterval(() => {
			setLineIndex((index) => (index + 1) % lines.length);
		}, STATUS_INTERVAL_MS);

		return () => window.clearInterval(id);
	}, [lines.length]);

	const activeLine = lines[lineIndex % Math.max(lines.length, 1)] ?? "";

	return (
		<div
			role="status"
			aria-live="polite"
			aria-atomic="true"
			className={cn(
				"relative flex min-h-svh w-full flex-col items-center justify-center px-6 text-center",
				className,
			)}
		>
			<div aria-hidden className="relative grid size-40 place-items-center">
				<motion.span
					animate={
						reducedMotion
							? { opacity: 0.28, scale: 1 }
							: {
									opacity: [0.2, 0.38, 0.2],
									scale: [0.86, 1.15, 0.86],
								}
					}
					transition={{
						duration: 1.8,
						repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
					className="absolute inset-7 rounded-full bg-gradient-ember blur-2xl"
				/>

				{!reducedMotion
					? PARTICLES.map((particle) => (
							<motion.span
								key={`${particle.x}-${particle.y}`}
								initial={{ x: 0, y: 0, opacity: 1, scale: 0.7 }}
								animate={{
									x: [0, particle.x],
									y: [0, particle.y],
									opacity: [1, 0.8, 0],
									scale: [0.7, 1, 0.45],
								}}
								transition={{
									delay: particle.delay,
									duration: particle.duration,
									repeat: Number.POSITIVE_INFINITY,
									repeatDelay: 0.18,
									ease: "easeOut",
								}}
								className="absolute start-1/2 top-1/2 rounded-full"
								style={{
									width: particle.size,
									height: particle.size,
									backgroundColor: `var(--ember-${particle.color})`,
								}}
							/>
						))
					: null}

				<motion.span
					animate={reducedMotion ? { scale: 1.4 } : { scale: [1, 1.4, 1] }}
					transition={{
						duration: 1.4,
						repeat: reducedMotion ? 0 : Number.POSITIVE_INFINITY,
						ease: "easeInOut",
					}}
					className="relative grid size-14 place-items-center rounded-full border border-primary/30 bg-background text-primary"
				>
					<Spark className="size-7" />
				</motion.span>
			</div>

			<div className="mt-5 h-5 overflow-hidden">
				<AnimatePresence mode="wait" initial={false}>
					<motion.p
						key={`${lineIndex}-${activeLine}`}
						initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 5 }}
						animate={{ opacity: 1, y: 0 }}
						exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
						transition={{ duration: 0.25, ease: "easeOut" }}
						className="font-mono text-[11px] text-muted-foreground"
					>
						{activeLine}
					</motion.p>
				</AnimatePresence>
			</div>

			<div
				dir="ltr"
				aria-hidden
				className="mt-4 h-0.5 w-44 overflow-hidden rounded-full bg-border"
			>
				{reducedMotion ? (
					<span className="block h-full w-full bg-gradient-ember opacity-70" />
				) : (
					<motion.span
						className="block h-full w-1/3 rounded-full bg-gradient-ember"
						animate={{ x: ["-100%", "300%"] }}
						transition={{
							duration: STATUS_INTERVAL_MS / 1000,
							repeat: Number.POSITIVE_INFINITY,
							ease: "easeInOut",
						}}
					/>
				)}
			</div>
		</div>
	);
}
