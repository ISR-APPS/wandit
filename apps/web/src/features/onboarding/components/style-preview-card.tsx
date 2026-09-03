import { cn } from "@wandit/ui/lib/utils";

import { Spark } from "@/components/logo";

export type StylePreviewTheme = "light" | "dark";

type StylePreviewCardProps = {
	theme: StylePreviewTheme;
	className?: string;
};

export function StylePreviewCard({ theme, className }: StylePreviewCardProps) {
	const dark = theme === "dark";

	return (
		<div
			dir="ltr"
			aria-hidden
			className={cn(
				"w-full overflow-hidden rounded-lg border shadow-xs",
				dark
					? "border-white/10 bg-[oklch(0.18_0.008_60)]"
					: "border-[#e7e4dc] bg-[#fcfbf8]",
				className,
			)}
		>
			<div
				className={cn(
					"flex h-6 items-center gap-1 border-b px-2",
					dark ? "border-white/10" : "border-[#e7e4dc]",
				)}
			>
				<span className="size-1.5 rounded-full bg-[#d4d3d0]/70" />
				<span className="size-1.5 rounded-full bg-[#d4d3d0]/50" />
				<span className="size-1.5 rounded-full bg-[#d4d3d0]/35" />
				<Spark
					className={cn(
						"ms-auto size-2.5",
						dark ? "text-[oklch(0.84_0.14_75)]" : "text-[oklch(0.62_0.16_45)]",
					)}
				/>
			</div>

			<div className="space-y-2.5 p-3">
				<div
					className={cn("h-8 rounded-md", dark ? "bg-white/8" : "bg-[#f2efe7]")}
				/>
				<div
					className={cn(
						"h-1.5 w-4/5 rounded-full",
						dark ? "bg-white/14" : "bg-[#d4d3d0]/70",
					)}
				/>
				<div
					className={cn(
						"h-1.5 w-3/5 rounded-full",
						dark ? "bg-white/9" : "bg-[#d4d3d0]/45",
					)}
				/>
				<div className="flex gap-1.5 pt-0.5">
					<span
						className={cn(
							"h-3.5 w-8 rounded-full",
							dark ? "bg-[oklch(0.74_0.16_55)]" : "bg-[oklch(0.62_0.16_45)]",
						)}
					/>
					<span
						className={cn(
							"h-3.5 flex-1 rounded-sm",
							dark ? "bg-white/6" : "bg-[#f7f4ed]",
						)}
					/>
				</div>
			</div>
		</div>
	);
}
