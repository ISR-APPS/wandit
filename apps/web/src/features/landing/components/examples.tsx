import { cn } from "@my-better-t-app/ui/lib/utils";
import type * as React from "react";

import { EXAMPLES, type ExampleItem } from "../lib/constants";
import { Reveal } from "./reveal";
import { SectionHeader } from "./section-header";

// Visual config for the abstract page art — kept out of lib/constants.ts
// because it's presentation, not copy. Warm-friendly hue pairs only.
type ArtVariant = "product" | "vitrine" | "service" | "promo";

type ArtConfig = {
	variant: ArtVariant;
	from: string;
	to: string;
	accent: string;
};

const ART: Record<string, ArtConfig> = {
	watch: {
		variant: "product",
		from: "oklch(0.78 0.13 70)",
		to: "oklch(0.52 0.15 35)",
		accent: "oklch(0.62 0.16 45)",
	},
	honey: {
		variant: "product",
		from: "oklch(0.85 0.13 92)",
		to: "oklch(0.58 0.15 60)",
		accent: "oklch(0.6 0.14 75)",
	},
	serum: {
		variant: "promo",
		from: "oklch(0.82 0.09 20)",
		to: "oklch(0.55 0.15 355)",
		accent: "oklch(0.62 0.15 10)",
	},
	dental: {
		variant: "vitrine",
		from: "oklch(0.8 0.09 165)",
		to: "oklch(0.52 0.1 185)",
		accent: "oklch(0.58 0.11 170)",
	},
	formation: {
		variant: "service",
		from: "oklch(0.42 0.03 60)",
		to: "oklch(0.24 0.02 55)",
		accent: "oklch(0.66 0.16 50)",
	},
	sneakers: {
		variant: "promo",
		from: "oklch(0.68 0.18 40)",
		to: "oklch(0.4 0.17 20)",
		accent: "oklch(0.55 0.19 28)",
	},
};

const FALLBACK_ART: ArtConfig = ART.watch;

function GradientPane({
	from,
	to,
	className,
	children,
}: {
	from: string;
	to: string;
	className?: string;
	children?: React.ReactNode;
}) {
	return (
		<div
			className={cn("relative overflow-hidden rounded-md", className)}
			style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
		>
			<span aria-hidden className="absolute inset-0 bg-grain" />
			{children}
		</div>
	);
}

function NavStrip({ accent }: { accent: string }) {
	return (
		<div className="flex items-center justify-between">
			<span
				className="size-2 rounded-full"
				style={{ backgroundColor: accent }}
			/>
			<span className="flex gap-1">
				<span className="h-1 w-4 rounded-full bg-foreground/15" />
				<span className="h-1 w-4 rounded-full bg-foreground/15" />
				<span className="h-1 w-4 rounded-full bg-foreground/15" />
			</span>
		</div>
	);
}

/** Abstract CSS composition suggesting a landing page — pure divs, no text. */
function PageArt({ art }: { art: ArtConfig }) {
	const { variant, from, to, accent } = art;

	if (variant === "promo") {
		return (
			<GradientPane from={from} to={to} className="h-full">
				<span className="absolute -end-5 -top-5 size-20 rounded-full bg-white/15 blur-[2px]" />
				<span className="absolute start-3 top-[30%] h-2.5 w-1/2 rounded-full bg-white/50" />
				<span className="absolute start-3 top-[46%] h-2.5 w-1/3 rounded-full bg-white/30" />
				<span className="absolute start-3 bottom-3 h-4 w-2/5 rounded bg-white/90" />
			</GradientPane>
		);
	}

	if (variant === "vitrine") {
		return (
			<div className="flex h-full flex-col gap-1.5">
				<NavStrip accent={accent} />
				<GradientPane from={from} to={to} className="h-[42%]">
					<span className="absolute top-[34%] left-1/2 h-2 w-2/5 -translate-x-1/2 rounded-full bg-white/50" />
					<span className="absolute top-[58%] left-1/2 h-1.5 w-1/4 -translate-x-1/2 rounded-full bg-white/30" />
				</GradientPane>
				<div className="grid flex-1 grid-cols-3 gap-1.5">
					{[0, 1, 2].map((i) => (
						<div
							key={i}
							className="flex flex-col gap-1 rounded-md border border-border/60 bg-foreground/[0.04] p-1.5"
						>
							<span
								className="size-2.5 rounded-full opacity-70"
								style={{ backgroundColor: accent }}
							/>
							<span className="h-1 w-4/5 rounded-full bg-foreground/15" />
							<span className="h-1 w-3/5 rounded-full bg-foreground/10" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (variant === "service") {
		return (
			<div className="flex h-full flex-col gap-1.5">
				<NavStrip accent={accent} />
				<div className="flex flex-1 gap-2">
					<div className="flex flex-1 flex-col justify-center gap-1.5">
						<span className="h-2 w-full rounded-full bg-foreground/20" />
						<span className="h-2 w-4/5 rounded-full bg-foreground/15" />
						<span className="h-1.5 w-3/5 rounded-full bg-foreground/10" />
						<span
							className="mt-2 h-4 w-1/2 rounded"
							style={{ backgroundColor: accent }}
						/>
					</div>
					<GradientPane from={from} to={to} className="w-[42%]">
						<span className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25 blur-[1px]" />
					</GradientPane>
				</div>
			</div>
		);
	}

	// "product" — hero block, skeleton copy, CTA bar. Mirrors via dir="rtl".
	return (
		<div className="flex h-full flex-col gap-1.5">
			<NavStrip accent={accent} />
			<GradientPane from={from} to={to} className="flex-1">
				<span className="absolute start-2.5 top-[22%] h-2 w-2/5 rounded-full bg-white/50" />
				<span className="absolute start-2.5 top-[44%] h-1.5 w-1/4 rounded-full bg-white/30" />
				<span className="absolute end-3 -bottom-4 size-14 rounded-full bg-white/25 blur-[1px]" />
			</GradientPane>
			<div className="flex flex-col gap-1">
				<span className="h-1.5 w-3/4 rounded-full bg-foreground/20" />
				<span className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
			</div>
			<span className="h-4 w-2/5 rounded" style={{ backgroundColor: accent }} />
		</div>
	);
}

function ExampleCard({
	item,
	onUse,
}: {
	item: ExampleItem;
	onUse: () => void;
}) {
	const art = ART[item.id] ?? FALLBACK_ART;

	return (
		<button
			type="button"
			onClick={onUse}
			aria-label={`Start from example: ${item.name}`}
			className="group w-full rounded-2xl border border-border bg-card/60 p-3 text-left outline-none transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_16px_48px_-16px_color-mix(in_oklab,var(--color-primary)_30%,transparent)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
		>
			<div className="overflow-hidden rounded-lg border border-border/70 bg-background">
				{/* Browser chrome — traffic lights */}
				<div className="flex items-center gap-1.5 border-border/70 border-b bg-muted/50 px-2.5 py-2">
					<span className="size-2 rounded-full bg-[#f5655b]/70" />
					<span className="size-2 rounded-full bg-[#f6bd3b]/70" />
					<span className="size-2 rounded-full bg-[#43c25b]/70" />
					<span className="ms-2 h-2.5 flex-1 rounded-full bg-foreground/[0.06]" />
				</div>
				<div dir={item.rtl ? "rtl" : undefined} className="aspect-[4/3] p-2.5">
					<PageArt art={art} />
				</div>
			</div>
			<div className="mt-3 flex items-center justify-between gap-2 px-1 pb-0.5">
				<span className="truncate font-display font-semibold text-sm tracking-[-0.01em]">
					{item.name}
				</span>
				<span className="flex shrink-0 items-center gap-1.5">
					{item.rtl ? (
						<span className="rounded border border-border px-1 py-px font-mono text-[10px] text-muted-foreground">
							RTL
						</span>
					) : null}
					<span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
						{item.category}
					</span>
				</span>
			</div>
		</button>
	);
}

type ExamplesProps = {
	onUseExample: (prompt: string) => void;
};

export function Examples({ onUseExample }: ExamplesProps) {
	return (
		<section id="examples" className="scroll-mt-20 px-4 py-16 md:py-24">
			<div className="mx-auto max-w-6xl">
				<SectionHeader
					kicker={EXAMPLES.kicker}
					title={EXAMPLES.title}
					sub={EXAMPLES.sub}
				/>
				<div className="grid gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
					{EXAMPLES.items.map((item, index) => (
						<Reveal key={item.id} delay={(index % 3) * 0.07}>
							<ExampleCard
								item={item}
								onUse={() => onUseExample(item.prompt)}
							/>
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}
