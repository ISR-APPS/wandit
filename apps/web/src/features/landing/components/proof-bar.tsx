import {
	useDictionary,
	useTranslation,
} from "@wandit/internationalization/react";

import { Reveal } from "./reveal";

function MarqueeRow({ items, hidden }: { items: string[]; hidden?: boolean }) {
	return (
		<div
			aria-hidden={hidden || undefined}
			className="flex shrink-0 items-center"
		>
			{items.map((item) => (
				<span
					key={item}
					className="mx-7 inline-flex shrink-0 items-center gap-2.5 font-mono text-foreground/70 text-xs uppercase tracking-[0.08em] [&:lang(ar)]:tracking-normal"
				>
					<span aria-hidden className="size-1 rounded-full bg-primary/70" />
					{item}
				</span>
			))}
		</div>
	);
}

export function ProofBar() {
	const { t } = useTranslation();
	const proofBar = useDictionary().landing.proofBar;

	return (
		<section className="border-border border-y bg-card/30 py-7 md:py-9">
			<Reveal className="flex flex-col items-center gap-4">
				<h2 className="max-w-2xl text-balance px-4 text-center font-display font-semibold text-lg tracking-[-0.01em] md:text-xl rtl:tracking-normal">
					{t("landing.proofBar.title")}
				</h2>
				{/* Infinite ticker — four single-list rows: the -50% loop spans two of
				   them, and assistive tech only ever sees the first (unduplicated) row */}
				<div
					dir="ltr"
					className="mask-x-from-85% mask-x-to-100% relative w-full overflow-hidden"
				>
					<div className="flex w-max motion-safe:animate-marquee">
						<MarqueeRow items={proofBar.items} />
						<MarqueeRow items={proofBar.items} hidden />
						<MarqueeRow items={proofBar.items} hidden />
						<MarqueeRow items={proofBar.items} hidden />
					</div>
				</div>
			</Reveal>
		</section>
	);
}
