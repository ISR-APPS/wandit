import { projectPromptMaxLength } from "@wandit/contracts";
import { Button } from "@wandit/ui/components/button";
import { cn } from "@wandit/ui/lib/utils";
import { ArrowUp, Languages, Loader2 } from "lucide-react";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { CREDIT_COSTS, PriceTag } from "@/features/credits";

// PromptBox copy lives here (not lib/constants.ts) because this component is
// owned separately from the rest of the projects feature.
const COPY = {
	placeholderHero: "Describe the product or business you want a page for…",
	placeholderCompact: "Describe your page…",
	hint: "AR & FR ready",
	generate: "Generate",
	submitLabel: "Generate page",
} as const;

export type PromptBoxProps = {
	onSubmit: (prompt: string) => void | Promise<void>;
	variant?: "hero" | "compact";
	placeholder?: string;
	showPriceTag?: boolean;
	isSubmitting?: boolean;
	initialValue?: string;
	className?: string;
};

/**
 * The ember prompt box — Wandit's signature element, shared verbatim by the
 * landing hero and the dashboard. Enter submits, Shift+Enter inserts a
 * newline; the textarea auto-grows; focus lights the ember-gradient ring.
 */
export function PromptBox({
	onSubmit,
	variant = "hero",
	placeholder,
	showPriceTag = false,
	isSubmitting = false,
	initialValue = "",
	className,
}: PromptBoxProps) {
	const [value, setValue] = useState(initialValue);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const isHero = variant === "hero";
	const maxHeight = isHero ? 240 : 160;
	const canSubmit = value.trim().length > 0 && !isSubmitting;

	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [maxHeight]);

	// Initial mount + variant change (typing resizes synchronously in onChange).
	useEffect(() => {
		resize();
	}, [resize]);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setValue(e.target.value);
		resize();
	};

	const handleSubmit = () => {
		const prompt = value.trim();
		if (!prompt || isSubmitting) return;
		void onSubmit(prompt);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div className={cn("group/prompt relative", className)}>
			{/* Resting hairline border */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-px rounded-[calc(1rem+1px)] bg-border"
			/>
			{/* Ember gradient ring + outer glow, revealed on focus */}
			<div
				aria-hidden
				className="pointer-events-none absolute -inset-[1.5px] rounded-[calc(1rem+2px)] bg-gradient-ember opacity-0 shadow-[0_0_20px_-2px_color-mix(in_oklab,var(--color-primary)_30%,transparent),0_8px_48px_-8px_color-mix(in_oklab,var(--color-primary)_25%,transparent)] transition-opacity duration-300 group-focus-within/prompt:opacity-100"
			/>
			{/* Content panel */}
			<div className="relative flex flex-col rounded-2xl bg-card shadow-xs dark:shadow-[inset_0_1px_0_0_oklch(1_0_0_/_0.04)]">
				<textarea
					ref={textareaRef}
					value={value}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					placeholder={
						placeholder ??
						(isHero ? COPY.placeholderHero : COPY.placeholderCompact)
					}
					rows={1}
					maxLength={projectPromptMaxLength}
					disabled={isSubmitting}
					className={cn(
						"w-full resize-none overflow-y-auto bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none disabled:opacity-60",
						isHero
							? "min-h-[72px] px-5 pt-4 pb-1 text-base"
							: "min-h-11 px-4 pt-3 pb-1 text-sm",
					)}
				/>
				<div
					className={cn(
						"flex items-end justify-between gap-2",
						isHero ? "px-4 pb-4" : "px-3 pb-3",
					)}
				>
					<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground">
						<Languages className="size-3 shrink-0" />
						{COPY.hint}
					</span>
					{showPriceTag ? (
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={!canSubmit}
							className={cn(
								"rounded-xl shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)]",
								isHero ? "h-10 px-4" : "h-9 px-3.5",
							)}
						>
							{isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{COPY.generate}
							<span aria-hidden className="text-primary-foreground/70">
								—
							</span>
							<PriceTag
								cost={CREDIT_COSTS.generation}
								className="text-primary-foreground/85"
							/>
						</Button>
					) : (
						<Button
							type="button"
							size="icon"
							aria-label={COPY.submitLabel}
							onClick={handleSubmit}
							disabled={!canSubmit}
							className={cn(
								"rounded-xl shadow-[0_4px_16px_-4px_color-mix(in_oklab,var(--color-primary)_50%,transparent)]",
								isHero ? "size-10" : "size-9",
							)}
						>
							{isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<ArrowUp className="size-4" />
							)}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
