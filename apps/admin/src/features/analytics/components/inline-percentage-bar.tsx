import { clampPercentage } from "@/features/analytics/lib/analytics-data";

type InlinePercentageBarProps = {
	value: number;
	label: string;
	tone?: "default" | "destructive";
};

function InlinePercentageBar({
	value,
	label,
	tone = "default",
}: InlinePercentageBarProps) {
	const percentage = clampPercentage(value);

	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percentage}
			className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
		>
			<div
				className={
					tone === "destructive"
						? "h-full origin-left bg-destructive"
						: "h-full origin-left bg-primary"
				}
				style={{ transform: `scaleX(${percentage / 100})` }}
			/>
		</div>
	);
}

export type { InlinePercentageBarProps };
export { InlinePercentageBar };
