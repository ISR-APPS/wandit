import { cn } from "@wandit/ui/lib/utils";

import { Reveal } from "./reveal";

type SectionHeaderProps = {
	kicker: string;
	title: string;
	sub?: string;
	align?: "center" | "start";
	className?: string;
};

export function SectionHeader({
	kicker,
	title,
	sub,
	align = "center",
	className,
}: SectionHeaderProps) {
	return (
		<Reveal
			className={cn(
				"mb-10 max-w-2xl md:mb-14",
				align === "center" && "mx-auto text-center",
				className,
			)}
		>
			<p className="font-medium font-mono text-primary text-xs uppercase tracking-[0.18em]">
				{kicker}
			</p>
			<h2 className="mt-3 font-bold font-display text-3xl tracking-[-0.02em] md:text-4xl">
				{title}
			</h2>
			{sub ? (
				<p className="mt-3 text-muted-foreground md:text-lg">{sub}</p>
			) : null}
		</Reveal>
	);
}
