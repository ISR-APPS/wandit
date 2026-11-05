/**
 * The platform word of the sentence "Build me a [mobile app]": a night pill
 * with a spark circle. A click moves to the next platform: web, mobile,
 * desktop, then web again. The landing hero and the dashboard prompt panel
 * render it and call nextTargetPlatform. All sizes are in em, so the pill
 * follows the font size of its parent.
 */

import { type TargetPlatform, targetPlatforms } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { ChevronsUpDown } from "lucide-react";
import { motion } from "motion/react";

import { useDictionary } from "@/lib/i18n";

/** The platform after `platform` in the order of `targetPlatforms`. The last one goes back to the first. */
export function nextTargetPlatform(platform: TargetPlatform): TargetPlatform {
	const index = targetPlatforms.indexOf(platform);
	return targetPlatforms[(index + 1) % targetPlatforms.length] ?? platform;
}

/** A button inside a heading or a sentence. The parent owns the platform state. */
export function PlatformToken({
	platform,
	onFlip,
}: {
	platform: TargetPlatform;
	/** Sets the platform of nextTargetPlatform. The parent also updates what depends on it. */
	onFlip: () => void;
}) {
	const hero = useDictionary().landing.hero;
	const platformIndex = targetPlatforms.indexOf(platform);

	return (
		<button
			type="button"
			onClick={onFlip}
			// The name starts with the visible word, so voice control finds the token.
			aria-label={`${hero.platforms[platform]}, ${hero.switchTo[nextTargetPlatform(platform)]}`}
			// The vertical padding makes the hit area at least 44 px tall at 360 px.
			className="group/token inline-grid cursor-pointer py-[0.05em] align-[-0.1em] outline-none"
		>
			{/* One pill per platform in the same cell. Each pill hugs its word;
			    a flip rolls one out and the other in, with transforms only. */}
			{targetPlatforms.map((option) => (
				<motion.span
					key={option}
					initial={false}
					animate={
						option === platform
							? { y: "0%", opacity: 1, scale: 1 }
							: {
									// A pill before the current one waits above it, a later pill waits below.
									y:
										targetPlatforms.indexOf(option) < platformIndex
											? "-40%"
											: "40%",
									opacity: 0,
									scale: 0.9,
								}
					}
					// The old pill leaves fast. The new one starts 80 ms later, so they barely overlap.
					transition={
						option === platform
							? {
									type: "spring",
									bounce: 0.25,
									duration: 0.55,
									delay: 0.08,
								}
							: { duration: 0.18, ease: "easeIn" }
					}
					className={cn(
						"inline-flex h-[1.02em] w-max items-center gap-[0.14em] rounded-full bg-night ps-[0.3em] pe-[0.12em] text-white outline-offset-4 transition-colors duration-200 [grid-area:1/1] group-hover/token:bg-[#161c4a] rtl:h-[1.2em]",
						option === platform &&
							"group-focus-visible/token:outline-[3px] group-focus-visible/token:outline-white",
					)}
				>
					{hero.platforms[option]}
					<span className="grid size-[0.66em] shrink-0 place-items-center rounded-full bg-spark text-night transition-transform duration-200 group-hover/token:scale-110">
						<ChevronsUpDown className="size-[0.42em]" strokeWidth={2.75} />
					</span>
				</motion.span>
			))}
		</button>
	);
}
