import { cn } from "@/lib/utils";

type LogoProps = {
	className?: string;
};

/** Four-point ember spark — shared with the Wandit web app. */
export default function Logo({ className }: LogoProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
			className={cn("size-4 shrink-0 text-primary", className)}
		>
			<path d="M12 2c1.05 4.44 3.94 7.33 10 10-6.06 1.06-8.95 3.95-10 10-1.05-4.44-3.94-7.33-10-10 6.06-1.06 8.95-3.95 10-10Z" />
		</svg>
	);
}
