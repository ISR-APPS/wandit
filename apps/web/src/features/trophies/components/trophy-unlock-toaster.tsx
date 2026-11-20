/**
 * Shows a toast for each new trophy, then marks the trophies as seen.
 * routes/_auth/route.tsx mounts it one time, except on the OAuth pages. It renders nothing itself.
 * It reads useTrophiesQuery, calls useMarkTrophiesSeen, and uses the Sonner Toaster of the root route.
 */
import { Link } from "@tanstack/react-router";
import {
	TROPHY_POINTS,
	type TrophyDefinition,
	type TrophyId,
} from "@wandit/contracts";
import { formatNumber } from "@wandit/internationalization";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/lib/i18n";
import { useMarkTrophiesSeen } from "../api/trophies.mutations";
import { useTrophiesQuery } from "../api/trophies.queries";
import { type TrophyView, toTrophyViews } from "../lib/helpers";
import { useTrophyText } from "../lib/hooks";
import { TrophyMedallion } from "./trophy-medallion";

/** Above this count, one summary toast replaces the toasts of each trophy. A first visit can unlock many at once. */
const MAX_SINGLE_TOASTS = 3;

/** 7 s. Long enough to read a name and a rarity, short enough to not cover the page. */
const TOAST_DURATION_MS = 7000;

// The night card of the credits menu. Thus a toast reads as a Wandit moment, not as a system notice.
const TOAST_CARD_CLASS =
	"flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3.5 rounded-2xl bg-night p-3 pe-4 text-paper shadow-modal outline-offset-2 ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-spark";

/** One toast for each new trophy, or one summary toast above 3. Then it posts the ids as seen. */
export function TrophyUnlockToaster() {
	const trophiesQuery = useTrophiesQuery();
	const { mutate: markSeen } = useMarkTrophiesSeen();
	// A refetch before the seen call ends returns the same new trophies. The ref stops a second toast.
	const shownIdsRef = useRef(new Set<TrophyId>());

	useEffect(() => {
		if (!trophiesQuery.data) return;
		const fresh = toTrophyViews(trophiesQuery.data).filter(
			(view) =>
				view.state === "unlocked" &&
				view.isNew &&
				!shownIdsRef.current.has(view.definition.id),
		);
		if (fresh.length === 0) return;
		for (const view of fresh) {
			shownIdsRef.current.add(view.definition.id);
		}
		if (fresh.length <= MAX_SINGLE_TOASTS) {
			for (const view of fresh) {
				toast.custom(
					(toastId) => (
						<UnlockToast
							definition={view.definition}
							onOpen={() => toast.dismiss(toastId)}
						/>
					),
					{ duration: TOAST_DURATION_MS },
				);
			}
		} else {
			toast.custom(
				(toastId) => (
					<SummaryToast
						trophies={fresh}
						onOpen={() => toast.dismiss(toastId)}
					/>
				),
				{ duration: TOAST_DURATION_MS },
			);
		}
		markSeen({ trophyIds: fresh.map((view) => view.definition.id) });
	}, [trophiesQuery.data, markSeen]);

	return null;
}

/** One new trophy: the key pops in, and 8 rays burst behind it. */
function UnlockToast({
	definition,
	onOpen,
}: {
	definition: TrophyDefinition;
	/** Closes the toast when the user follows the link. */
	onOpen: () => void;
}) {
	const { dir, locale, t } = useTranslation();
	const trophyText = useTrophyText();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const text = trophyText(definition);
	const points = TROPHY_POINTS[definition.rarity];

	return (
		<Link
			to="/trophies"
			dir={dir}
			onClick={onOpen}
			className={TOAST_CARD_CLASS}
		>
			<span className="relative grid size-16 shrink-0 place-items-center">
				{shouldReduceMotion ? null : <RayBurst />}
				<motion.span
					// The tilt mirrors in RTL, so the key swings in from the reading start.
					initial={
						shouldReduceMotion
							? false
							: { scale: 0.4, rotate: dir === "rtl" ? 14 : -14, opacity: 0 }
					}
					animate={{ scale: 1, rotate: 0, opacity: 1 }}
					transition={{ type: "spring", stiffness: 420, damping: 16 }}
					className="relative"
				>
					<TrophyMedallion
						trophyId={definition.id}
						state="unlocked"
						progressRatio={1}
						size="sm"
						className="animate-none"
					/>
				</motion.span>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-grotesk font-semibold text-[11px] text-spark uppercase tracking-[0.08em] rtl:tracking-normal">
					{t("trophies.toast.unlocked")}
				</span>
				<span className="mt-0.5 block truncate font-bold font-grotesk text-[15px] tracking-[-0.01em]">
					{text.name}
				</span>
				<span className="mt-0.5 block truncate text-paper/60 text-xs">
					{t(`trophies.rarity.${definition.rarity}`)}
					{" · "}
					<bdi>
						{t("trophies.toast.points", {
							points: t("trophies.units.points", {
								count: points,
								countDisplay: formatNumber(points, locale),
							}),
						})}
					</bdi>
				</span>
			</span>
		</Link>
	);
}

/** Many new trophies at once: up to 3 keys in a fan, the count, and a link to the page. */
function SummaryToast({
	trophies,
	onOpen,
}: {
	/** The new trophies, in catalog order. More than MAX_SINGLE_TOASTS items. */
	trophies: TrophyView[];
	/** Closes the toast when the user follows the link. */
	onOpen: () => void;
}) {
	const { dir, locale, t } = useTranslation();
	const shouldReduceMotion = useReducedMotion() ?? false;
	const fan = trophies.slice(0, MAX_SINGLE_TOASTS);

	return (
		<Link
			to="/trophies"
			dir={dir}
			onClick={onOpen}
			className={TOAST_CARD_CLASS}
		>
			<span className="relative grid size-16 shrink-0 place-items-center">
				{shouldReduceMotion ? null : <RayBurst />}
				<span className="relative flex -space-x-7">
					{fan.map((view, index) => (
						<motion.span
							key={view.definition.id}
							initial={shouldReduceMotion ? false : { scale: 0.4, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							// Each key lands a little after the one before it.
							transition={{
								type: "spring",
								stiffness: 420,
								damping: 18,
								delay: index * 0.08,
							}}
						>
							<TrophyMedallion
								trophyId={view.definition.id}
								state="unlocked"
								progressRatio={1}
								size="sm"
								className="size-10 animate-none rounded-xl"
							/>
						</motion.span>
					))}
				</span>
			</span>
			<span className="min-w-0 flex-1">
				<span className="block font-bold font-grotesk text-[15px] tracking-[-0.01em]">
					{t("trophies.toast.many", {
						count: trophies.length,
						countDisplay: formatNumber(trophies.length, locale),
					})}
				</span>
				<span className="mt-0.5 block text-paper/60 text-xs">
					{t("trophies.toast.manyBody")}
				</span>
				<span className="mt-1.5 block font-grotesk font-semibold text-spark text-xs">
					{t("trophies.toast.open")}
				</span>
			</span>
		</Link>
	);
}

// 8 rays, one each 45 degrees. Each ray runs from radius 30 to radius 46 in the 100 x 100 box.
const RAY_ANGLES_DEG = [0, 45, 90, 135, 180, 225, 270, 315];

/** The burst behind a new key. The caller leaves it out when the user asks for reduced motion. */
function RayBurst() {
	return (
		<svg
			aria-hidden="true"
			viewBox="0 0 100 100"
			className="pointer-events-none absolute -inset-4 size-[calc(100%+2rem)] text-spark"
		>
			{RAY_ANGLES_DEG.map((angle, index) => {
				const radians = (angle * Math.PI) / 180;
				return (
					<motion.line
						key={angle}
						x1={50 + 30 * Math.cos(radians)}
						y1={50 + 30 * Math.sin(radians)}
						x2={50 + 46 * Math.cos(radians)}
						y2={50 + 46 * Math.sin(radians)}
						stroke="currentColor"
						strokeWidth={index % 2 === 0 ? 3 : 2}
						strokeLinecap="round"
						initial={{ pathLength: 0, opacity: 0 }}
						animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
						transition={{ duration: 0.9, delay: 0.12, ease: "easeOut" }}
					/>
				);
			})}
		</svg>
	);
}
