/**
 * A premium device around a mini app screen: a phone for a mobile app and a
 * browser window for a web app. When `platform` changes, the frame morphs
 * between the two (motion layout) and the content crossfades. The hero,
 * how-it-works and languages sections put a FitScreen inside it.
 */

import type { TargetPlatform } from "@wandit/contracts";
import { cn } from "@wandit/ui/lib/utils";
import { Lock } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useState } from "react";

type DeviceFrameProps = {
	platform: TargetPlatform;
	/** Address in the browser bar, like "ledgerly.wandit.app". The phone ignores it. */
	url?: string;
	/** Sets the frame width, for example "w-[300px]". The height follows the screen. */
	className?: string;
	/** The screen, usually a FitScreen with a MiniApp inside. */
	children: ReactNode;
};

/*
 * Phone geometry for a 360x780 screen and a bezel of 3.4% of the frame
 * width. The outer radius is 14% of the width. The frame is 2.087 times as
 * tall as it is wide. So the same radius is 6.71% of the height. Percent
 * radii scale with the box, so the corners stay round during the morph.
 */
const PHONE_RADIUS = "14% / 6.71%";
/** About 14 px on a 560 px wide browser window. */
const BROWSER_RADIUS = "2.5% / 3.6%";
/*
 * The morph runs in three beats. First, the old screen fades out fast.
 * Then the solid shell changes shape. Last, the new screen fades in.
 * A screen never shows at the wrong size inside a shell that is still moving.
 */
const MORPH_TRANSITION = {
	layout: { type: "spring", bounce: 0.12, duration: 0.7 },
	default: { duration: 0.2, ease: "easeOut" },
} as const;
const SCREEN_IN = { duration: 0.32, delay: 0.34, ease: "easeOut" } as const;
const SCREEN_OUT = { duration: 0.14, ease: "easeIn" } as const;

/** A phone or a browser window that sizes itself from its width and morphs when `platform` changes. */
export function DeviceFrame({
	platform,
	url,
	className,
	children,
}: DeviceFrameProps) {
	const isMobile = platform === "mobile";
	// The first screen shows at once. A screen that replaces another one fades in.
	// This code does not use AnimatePresence initial={false}. That prop also blocks
	// the mount animations of the motion elements in the screen, like the sweep shimmer.
	const [firstPlatform, setFirstPlatform] = useState<TargetPlatform | null>(
		platform,
	);
	if (firstPlatform !== null && platform !== firstPlatform) {
		setFirstPlatform(null);
	}
	const isFirstScreen = firstPlatform !== null;

	return (
		// The outer box sizes the device and holds the side buttons, which sit outside the clip.
		<motion.div
			layout
			// Measure the layout only when the platform changes, not on every parent render.
			layoutDependency={platform}
			transition={MORPH_TRANSITION}
			className={cn("relative isolate", className)}
		>
			<AnimatePresence initial={false}>
				{isMobile ? <SideButtons key="buttons" /> : null}
			</AnimatePresence>
			{/* The shell clips the content, so the device resizes like one object during the morph. */}
			<motion.div
				layout
				layoutDependency={platform}
				initial={false}
				animate={{
					borderRadius: isMobile ? PHONE_RADIUS : BROWSER_RADIUS,
					backgroundColor: isMobile ? "#0b0c10" : "#ffffff",
				}}
				transition={MORPH_TRANSITION}
				className={cn(
					"relative overflow-hidden",
					isMobile
						? "shadow-[0_0_0_1.5px_#2d3039,inset_0_0_0_1.5px_rgba(255,255,255,0.14),0_60px_110px_-36px_rgba(58,20,4,0.6),0_26px_50px_-26px_rgba(58,20,4,0.5)]"
						: "shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-night)_10%,transparent),0_60px_110px_-36px_rgba(58,20,4,0.5),0_26px_50px_-26px_rgba(58,20,4,0.35)]",
				)}
			>
				<AnimatePresence mode="popLayout">
					<motion.div
						key={platform}
						// The content keeps its own size while the shell scales around it.
						layout
						layoutDependency={platform}
						initial={{ opacity: isFirstScreen ? 1 : 0 }}
						animate={{ opacity: 1, transition: SCREEN_IN }}
						exit={{ opacity: 0, transition: SCREEN_OUT }}
						// The content is the size container, so an exiting body keeps its own cqw units.
						className="@container"
					>
						{isMobile ? (
							<PhoneBody>{children}</PhoneBody>
						) : (
							<BrowserBody url={url}>{children}</BrowserBody>
						)}
					</motion.div>
				</AnimatePresence>
			</motion.div>
		</motion.div>
	);
}

function PhoneBody({ children }: { children: ReactNode }) {
	return (
		<div className="p-[3.4cqw]">
			{/* Inner radius = outer radius minus the bezel, so the curves stay parallel. */}
			<div className="relative overflow-hidden rounded-[10.6cqw] bg-black">
				{children}
				{/* Dynamic island: 32% of the screen width, 2.8% of it from the top. */}
				<span className="absolute top-[2.6cqw] left-1/2 h-[8.7cqw] w-[29.8cqw] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]" />
				{/* A faint glass reflection on the top left corner. */}
				<span className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.02)_28%,transparent_42%)]" />
			</div>
		</div>
	);
}

function BrowserBody({ url, children }: { url?: string; children: ReactNode }) {
	return (
		<>
			<div className="grid h-[clamp(26px,6cqw,42px)] grid-cols-[1fr_auto_1fr] items-center border-night/8 border-b bg-[#f3f4f8] px-[2.4cqw]">
				<span className="flex gap-[1cqw]">
					<span className="size-[clamp(6px,1.3cqw,10px)] rounded-full bg-[#d9dbe4]" />
					<span className="size-[clamp(6px,1.3cqw,10px)] rounded-full bg-[#d9dbe4]" />
					<span className="size-[clamp(6px,1.3cqw,10px)] rounded-full bg-[#d9dbe4]" />
				</span>
				<span className="flex h-[clamp(17px,3.9cqw,28px)] w-[46cqw] min-w-0 items-center justify-center gap-[0.8cqw] rounded-full bg-white px-[2cqw] font-medium text-[clamp(8px,1.55cqw,12.5px)] text-night/60 shadow-[0_1px_2px_color-mix(in_oklab,var(--color-night)_6%,transparent)] ring-1 ring-night/6">
					<Lock className="size-[1.05em] shrink-0" strokeWidth={2.4} />
					<span dir="ltr" className="truncate">
						{url}
					</span>
				</span>
			</div>
			{children}
		</>
	);
}

/** Action, volume and power buttons, drawn just outside the phone edges. */
function SideButtons() {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1, transition: { duration: 0.3, delay: 0.45 } }}
			exit={{ opacity: 0, transition: { duration: 0.12 } }}
			className="pointer-events-none absolute inset-0"
		>
			<span className="absolute -start-[1%] top-[15.5%] h-[3.6%] w-[1%] rounded-s-[2px] bg-[#2b2e37]" />
			<span className="absolute -start-[1%] top-[22%] h-[7%] w-[1%] rounded-s-[2px] bg-[#2b2e37]" />
			<span className="absolute -start-[1%] top-[30.5%] h-[7%] w-[1%] rounded-s-[2px] bg-[#2b2e37]" />
			<span className="absolute -end-[1%] top-[24%] h-[11%] w-[1%] rounded-e-[2px] bg-[#2b2e37]" />
		</motion.div>
	);
}
