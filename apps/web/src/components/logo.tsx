import { cn } from "@my-better-t-app/ui/lib/utils";

/** Four-point ember spark — the Wandit brand mark. */
export function Spark({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			className={cn("size-4 shrink-0", className)}
		>
			<path d="M12 2c1.05 4.44 3.94 7.33 10 10-6.06 1.06-8.95 3.95-10 10-1.05-4.44-3.94-7.33-10-10 6.06-1.06 8.95-3.95 10-10Z" />
		</svg>
	);
}

type LogoProps = {
	size?: "sm" | "md";
	withWordmark?: boolean;
	className?: string;
};

export function Logo({
	size = "sm",
	withWordmark = true,
	className,
}: LogoProps) {
	return (
		<span
			className={cn(
				"inline-flex select-none items-center text-foreground",
				size === "sm" ? "gap-1.5" : "gap-2",
				className,
			)}
		>
			<Spark
				className={cn("text-primary", size === "sm" ? "size-4" : "size-5")}
			/>
			{withWordmark ? (
				<span
					className={cn(
						"font-bold font-display lowercase leading-none tracking-tight",
						size === "sm" ? "text-lg" : "text-2xl",
					)}
				>
					wandit
				</span>
			) : null}
		</span>
	);
}
