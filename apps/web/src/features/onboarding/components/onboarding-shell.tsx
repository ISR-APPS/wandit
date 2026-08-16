import { cn } from "@wandit/ui/lib/utils";
import type { ReactNode } from "react";

type OnboardingShellProps = {
	children: ReactNode;
	className?: string;
};

export function OnboardingShell({ children, className }: OnboardingShellProps) {
	return (
		<main
			className={cn(
				"relative min-h-svh overflow-x-hidden bg-background text-foreground",
				className,
			)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 h-[640px] bg-dots"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute -start-32 -bottom-52 h-[520px] w-[620px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-1)_20%,transparent),transparent_78%)] motion-safe:animate-drift-slow"
			/>
			<div
				aria-hidden
				className="pointer-events-none absolute -end-36 -bottom-48 h-[520px] w-[620px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--ember-2)_16%,transparent),transparent_78%)] motion-safe:animate-drift-slower"
			/>
			<div
				aria-hidden
				className="mask-b-from-80% pointer-events-none absolute inset-0 hidden bg-grain dark:block"
			/>
			<div className="relative min-h-svh">{children}</div>
		</main>
	);
}
