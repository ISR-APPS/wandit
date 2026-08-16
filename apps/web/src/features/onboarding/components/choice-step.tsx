import { cn } from "@wandit/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { StylePreviewCard } from "./style-preview-card";

export type OnboardingChoiceOption = {
	value: string;
	label: string;
	icon: LucideIcon;
};

type ChoiceStepProps = {
	options: readonly OnboardingChoiceOption[];
	selectedValue?: string;
	columns: 2 | 3 | 4;
	variant?: "default" | "style";
	dir: "ltr" | "rtl";
	pulse: number;
	onSelect: (value: string) => void;
	titleId: string;
	disabled?: boolean;
	className?: string;
};

function getRenderedColumnCount(
	container: HTMLDivElement | null,
	fallback: number,
): number {
	if (!container || typeof window === "undefined") return fallback;

	const template = window
		.getComputedStyle(container)
		.gridTemplateColumns.trim();
	if (!template || template === "none") return fallback;

	return template.split(/\s+/).filter(Boolean).length || fallback;
}

function wrapIndex(index: number, length: number): number {
	return ((index % length) + length) % length;
}

export function ChoiceStep({
	options,
	selectedValue,
	columns,
	variant = "default",
	dir,
	pulse,
	onSelect,
	titleId,
	disabled = false,
	className,
}: ChoiceStepProps) {
	const selectedIndex = options.findIndex(
		(option) => option.value === selectedValue,
	);
	const [focusIndex, setFocusIndex] = useState(() =>
		selectedIndex >= 0 ? selectedIndex : 0,
	);
	const groupRef = useRef<HTMLDivElement>(null);
	const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const initialFocusIndexRef = useRef(selectedIndex >= 0 ? selectedIndex : 0);

	useEffect(() => {
		optionRefs.current[initialFocusIndexRef.current]?.focus();
	}, []);

	useEffect(() => {
		if (selectedIndex >= 0) setFocusIndex(selectedIndex);
	}, [selectedIndex]);

	const moveFocus = (index: number, key: string) => {
		if (options.length === 0) return;

		const renderedColumns = getRenderedColumnCount(groupRef.current, columns);
		let delta = 0;

		switch (key) {
			case "ArrowRight":
				delta = dir === "rtl" ? -1 : 1;
				break;
			case "ArrowLeft":
				delta = dir === "rtl" ? 1 : -1;
				break;
			case "ArrowDown":
				delta = renderedColumns;
				break;
			case "ArrowUp":
				delta = -renderedColumns;
				break;
			default:
				return;
		}

		const nextIndex = wrapIndex(index + delta, options.length);
		setFocusIndex(nextIndex);
		optionRefs.current[nextIndex]?.focus();
	};

	return (
		<div
			ref={groupRef}
			dir={dir}
			role="radiogroup"
			aria-labelledby={titleId}
			className={cn(
				"grid w-full gap-3 md:gap-4",
				columns === 2 && "grid-cols-2",
				// Odd count: the last card centers under the pair on small screens.
				columns === 3 &&
					"grid-cols-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:mx-auto [&>*:last-child:nth-child(odd)]:w-1/2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 sm:[&>*:last-child:nth-child(odd)]:w-full",
				columns === 4 && "grid-cols-2 sm:grid-cols-4",
				className,
			)}
		>
			{options.map((option, index) => {
				const selected = option.value === selectedValue;
				const Icon = option.icon;

				return (
					// biome-ignore lint/a11y/useSemanticElements: card buttons retain native Enter/Space activation while exposing radio state.
					<button
						key={option.value}
						ref={(node) => {
							optionRefs.current[index] = node;
						}}
						type="button"
						role="radio"
						aria-checked={selected}
						disabled={disabled}
						tabIndex={!disabled && index === focusIndex ? 0 : -1}
						onFocus={() => setFocusIndex(index)}
						onKeyDown={(event) => {
							if (!event.key.startsWith("Arrow")) return;
							event.preventDefault();
							moveFocus(index, event.key);
						}}
						onClick={() => onSelect(option.value)}
						className="group min-w-0 rounded-xl text-center outline-none disabled:pointer-events-none disabled:opacity-55"
					>
						<motion.span
							key={`${option.value}-${selected ? pulse : "idle"}`}
							initial={{ scale: 1 }}
							animate={selected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
							// Springs only take two keyframes — the 3-point pop must tween.
							transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
							className={cn(
								"flex size-full min-h-20 flex-col items-center justify-center gap-2 rounded-xl border bg-card px-3 py-3 transition-colors duration-200 group-hover:border-primary/40 group-focus-visible:border-ring group-focus-visible:ring-[3px] group-focus-visible:ring-ring/50 sm:min-h-24 md:min-h-28 md:gap-3 md:py-5",
								variant === "style" && "min-h-40 justify-start p-3",
								selected && "border-primary bg-primary/5",
							)}
						>
							{variant === "style" ? (
								<StylePreviewCard
									theme={option.value === "dark" ? "dark" : "light"}
								/>
							) : (
								<Icon aria-hidden className="size-5 text-muted-foreground" />
							)}
							<span className="inline-flex items-center gap-1.5 font-medium text-sm">
								{variant === "style" ? (
									<Icon
										aria-hidden
										className="size-3.5 text-muted-foreground"
									/>
								) : null}
								<bdi>{option.label}</bdi>
							</span>
						</motion.span>
					</button>
				);
			})}
		</div>
	);
}
