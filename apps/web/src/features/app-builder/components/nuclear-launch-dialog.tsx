/**
 * The "launch Nuclear" dialog over the page: a game-like reactor animation,
 * two stat bars, and the explanation of what Nuclear costs.
 * builder-model-picker.tsx opens it when the slider lands on Nuclear, and
 * applies the Nuclear pick only on confirm. It calls the kit Dialog and motion.
 */

import { LightningIcon } from "@phosphor-icons/react/Lightning";
import { RadioactiveIcon } from "@phosphor-icons/react/Radioactive";
import { Button } from "@wandit/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@wandit/ui/components/dialog";
import { cn } from "@wandit/ui/lib/utils";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";

/** Props of the Nuclear dialog. */
export type NuclearLaunchDialogProps = {
	/** True while a Nuclear pick waits for the user's answer. */
	open: boolean;
	/** True when Fast mode stays on after the switch: the dialog then adds the 2x line. */
	isFast: boolean;
	/** Applies the Nuclear pick. */
	onConfirm: () => void;
	/** Keeps the previous tier. Escape and a click on the overlay call it too. */
	onCancel: () => void;
};

// Embers that rise from the bottom of the reactor. Fixed spots, so they do not jump on a render. 29 and 41 spread them without a visible pattern.
const EMBERS = Array.from({ length: 14 }, (_, index) => ({
	id: `ember-${index}`,
	/** Start position from the left edge, in percent. */
	leftPercent: 8 + ((index * 29) % 84),
	/** Start delay in seconds, so the embers do not rise together. */
	delaySec: ((index * 41) % 100) / 50,
	/** Rise time in seconds. */
	durationSec: 1.6 + ((index * 17) % 10) / 10,
}));

// Three rings leave the core in turn. Each ring starts this many seconds after the one before.
const RING_STAGGER_SEC = 0.6;

// The charge meter fills in this time when the dialog opens. It ends just before the button pulse starts.
const CHARGE_DURATION_SEC = 1.2;

/**
 * A full-page dialog with a spinning trefoil, shockwave rings, rising embers,
 * a charge meter, and the cost explanation. Reduced motion shows the same
 * content without movement.
 */
export function NuclearLaunchDialog({
	open,
	isFast,
	onConfirm,
	onCancel,
}: NuclearLaunchDialogProps) {
	const { t } = useTranslation();
	const isReducedMotion = useReducedMotion() === true;
	// Charge of the meter, 0 to 100. It restarts at each open.
	const [charge, setCharge] = useState(0);

	useEffect(() => {
		if (!open) return;
		if (isReducedMotion) {
			setCharge(100);
			return;
		}
		setCharge(0);
		const controls = animate(0, 100, {
			duration: CHARGE_DURATION_SEC,
			ease: "easeOut",
			onUpdate: (value) => setCharge(Math.round(value)),
		});
		return () => controls.stop();
	}, [open, isReducedMotion]);

	const isCharged = charge === 100;

	return (
		<Dialog
			open={open}
			onOpenChange={(isOpen) => {
				if (!isOpen) onCancel();
			}}
		>
			<DialogContent
				showCloseButton={false}
				overlayClassName="bg-black/70 backdrop-blur-sm"
				className="max-w-sm overflow-hidden border-orange-500/40 bg-zinc-950 p-0 text-white shadow-[0_0_80px_rgb(249_115_22/0.35)] sm:max-w-sm"
			>
				{/* The shake moves this inner block: the kit content already uses transform to center itself. */}
				<motion.div
					animate={isReducedMotion ? {} : { x: [0, -8, 8, -5, 5, -2, 0] }}
					transition={{ duration: 0.45, delay: 0.1 }}
					className="relative"
				>
					<div className="relative flex h-52 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_55%,rgb(249_115_22/0.45),rgb(127_29_29/0.35)_45%,transparent_75%)]">
						{isReducedMotion
							? null
							: [0, 1, 2].map((ring) => (
									<motion.span
										key={ring}
										aria-hidden
										className="absolute size-24 rounded-full border-2 border-orange-400"
										initial={{ scale: 0.6, opacity: 0 }}
										animate={{ scale: [0.6, 2.6], opacity: [0.8, 0] }}
										transition={{
											duration: RING_STAGGER_SEC * 3,
											delay: ring * RING_STAGGER_SEC,
											repeat: Number.POSITIVE_INFINITY,
											ease: "easeOut",
										}}
									/>
								))}
						{isReducedMotion
							? null
							: EMBERS.map((ember) => (
									<motion.span
										key={ember.id}
										aria-hidden
										className="absolute bottom-0 size-1 rounded-full bg-amber-300 shadow-[0_0_6px_rgb(252_211_77)]"
										style={{ left: `${ember.leftPercent}%` }}
										animate={{ y: [0, -200], opacity: [0, 1, 0] }}
										transition={{
											duration: ember.durationSec,
											delay: ember.delaySec,
											repeat: Number.POSITIVE_INFINITY,
											ease: "easeOut",
										}}
									/>
								))}
						<motion.div
							aria-hidden
							initial={isReducedMotion ? false : { scale: 0, rotate: -180 }}
							animate={{ scale: 1, rotate: 0 }}
							transition={{ type: "spring", stiffness: 180, damping: 14 }}
							className="relative flex size-24 items-center justify-center rounded-full bg-amber-400 shadow-[0_0_40px_rgb(251_146_60),0_0_90px_rgb(239_68_68/0.6)]"
						>
							<motion.span
								animate={isReducedMotion ? {} : { rotate: 360 }}
								transition={{
									duration: 6,
									repeat: Number.POSITIVE_INFINITY,
									ease: "linear",
								}}
								className="flex"
							>
								<RadioactiveIcon
									weight="fill"
									className="size-20 text-zinc-950"
								/>
							</motion.span>
						</motion.div>
						<span className="absolute start-3 top-3 rounded-full border border-orange-400/50 bg-black/40 px-2 py-0.5 font-grotesk font-semibold text-[10px] text-orange-300 uppercase tracking-[0.2em]">
							{isCharged
								? t("appBuilder.chat.model.nuclearDialog.ready")
								: t("appBuilder.chat.model.nuclearDialog.charging")}
						</span>
					</div>

					<div className="space-y-4 p-5">
						<div className="space-y-1.5 text-center">
							<DialogTitle className="font-bold font-grotesk text-2xl text-orange-400 [text-shadow:0_0_18px_rgb(249_115_22/0.6)]">
								{t("appBuilder.chat.model.nuclearDialog.title")}
							</DialogTitle>
							<DialogDescription className="text-sm text-zinc-300 leading-relaxed">
								{t("appBuilder.chat.model.nuclearDialog.body")}
							</DialogDescription>
						</div>

						<div className="space-y-2">
							<StatBar
								label={t("appBuilder.chat.model.nuclearDialog.power")}
								charge={charge}
								barClassName="bg-linear-to-r from-amber-300 to-orange-500"
							/>
							<StatBar
								label={t("appBuilder.chat.model.nuclearDialog.limits")}
								charge={charge}
								barClassName="bg-linear-to-r from-orange-500 to-red-600"
							/>
						</div>

						{isFast ? (
							<p className="flex items-start gap-1.5 rounded-lg bg-red-500/15 px-2.5 py-1.5 font-medium text-red-300 text-xs">
								<LightningIcon
									weight="fill"
									className="mt-px size-3.5 shrink-0"
									aria-hidden
								/>
								{t("appBuilder.chat.model.nuclearDialog.fastBody")}
							</p>
						) : null}

						<div className="flex flex-col gap-2">
							<motion.div
								animate={
									isCharged && !isReducedMotion
										? { scale: [1, 1.03, 1] }
										: { scale: 1 }
								}
								transition={{
									duration: 1.2,
									repeat: Number.POSITIVE_INFINITY,
									ease: "easeInOut",
								}}
							>
								<Button
									type="button"
									onClick={onConfirm}
									className="h-11 w-full rounded-full bg-linear-to-r from-amber-400 via-orange-500 to-red-600 font-bold font-grotesk text-base text-white shadow-[0_0_24px_rgb(249_115_22/0.6)] hover:brightness-110"
								>
									<RadioactiveIcon
										weight="fill"
										className="size-5"
										aria-hidden
									/>
									{t("appBuilder.chat.model.nuclearDialog.confirm")}
								</Button>
							</motion.div>
							<Button
								type="button"
								variant="ghost"
								onClick={onCancel}
								className="h-9 w-full rounded-full text-zinc-400 hover:bg-white/10 hover:text-white"
							>
								{t("appBuilder.chat.model.nuclearDialog.cancel")}
							</Button>
						</div>
					</div>
				</motion.div>
			</DialogContent>
		</Dialog>
	);
}

/** One game-like stat bar. `charge` is the fill, 0 to 100. */
function StatBar({
	label,
	charge,
	barClassName,
}: {
	/** Name of the stat, shown at the start of the row. */
	label: string;
	/** Fill of the bar in percent, from the charge meter. */
	charge: number;
	/** Gradient classes of the fill. */
	barClassName: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<span className="w-20 shrink-0 font-grotesk font-semibold text-[11px] text-zinc-400 uppercase tracking-wider">
				{label}
			</span>
			<div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
				<div
					className={cn(
						"h-full origin-left rounded-full rtl:origin-right",
						barClassName,
					)}
					style={{ transform: `scaleX(${charge / 100})` }}
				/>
			</div>
			<span className="w-9 shrink-0 text-end font-mono text-[11px] text-zinc-300 tabular-nums">
				{charge}%
			</span>
		</div>
	);
}
