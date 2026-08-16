import { cn } from "@wandit/ui/lib/utils";
import { motion, useReducedMotion } from "motion/react";

import { Spark } from "@/components/logo";

type SparkFlareProps = {
	pulse: number;
	className?: string;
};

export function SparkFlare({ pulse, className }: SparkFlareProps) {
	const reducedMotion = useReducedMotion();
	const angle = pulse * 90;
	const hasPulse = pulse > 0;

	return (
		<div
			aria-hidden
			className={cn("relative grid size-14 place-items-center", className)}
		>
			<motion.span
				key={`halo-${pulse}`}
				initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72 }}
				animate={
					reducedMotion
						? { opacity: hasPulse ? [0, 0.35, 0] : 0 }
						: hasPulse
							? { opacity: [0, 0.35, 0], scale: [0.72, 1.3, 1.5] }
							: { opacity: 0, scale: 1 }
				}
				transition={{ duration: reducedMotion ? 0.3 : 0.58, ease: "easeOut" }}
				className="absolute inset-0 rounded-full bg-gradient-ember blur-xl"
			/>

			<motion.span
				key={`spark-${pulse}`}
				initial={
					reducedMotion
						? { opacity: 1 }
						: { rotate: hasPulse ? angle - 90 : angle, scale: 1 }
				}
				animate={
					reducedMotion
						? { opacity: hasPulse ? [1, 0.55, 1] : 1 }
						: { rotate: angle, scale: hasPulse ? [1, 1.28, 1] : 1 }
				}
				transition={
					reducedMotion
						? { duration: 0.3, ease: "easeOut" }
						: {
								// Springs only take two keyframes; the 3-point scale pulse
								// must tween while the rotation keeps its spring snap.
								rotate: { type: "spring", stiffness: 400, damping: 20 },
								scale: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
							}
				}
				className="relative flex text-primary"
			>
				<Spark className="size-8" />
			</motion.span>
		</div>
	);
}
