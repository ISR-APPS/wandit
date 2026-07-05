import { cn, useThemeColor } from "heroui-native";
import { BrandGradientFill } from "@/shared/ui/brand-gradient-fill";
import { AppPressableFeedback } from "@/shared/ui/pressable-feedback";
import { WanditIcon, type WanditIconName } from "./wandit-icon";

type IconCircleButtonProps = {
	icon: WanditIconName;
	onPress?: () => void;
	/** Diameter in px (prototype: 44 app bars, 38 composer). */
	size?: number;
	iconSize?: number;
	/**
	 * chrome  — white pill on cream (dark: raised pill), app bars.
	 * outline — hairline only, composer sub-buttons.
	 * ember   — brand gradient fill (preview/play button).
	 */
	variant?: "chrome" | "outline" | "ember";
	iconColor?: string;
	accessibilityLabel: string;
	className?: string;
};

export function IconCircleButton({
	icon,
	onPress,
	size = 44,
	iconSize = 17,
	variant = "chrome",
	iconColor,
	accessibilityLabel,
	className,
}: IconCircleButtonProps) {
	const foreground = useThemeColor("foreground");
	const defaultIconColor = variant === "ember" ? "#FFFFFF" : foreground;

	return (
		<AppPressableFeedback
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			animation={{ scale: { ignoreScaleCoefficient: true, value: 0.95 } }}
			onPress={onPress}
			className={cn(
				"relative items-center justify-center rounded-full",
				variant === "chrome" &&
					"border border-border bg-surface dark:bg-surface-tertiary/65",
				variant === "outline" && "border border-border bg-transparent",
				className,
			)}
			style={{
				width: size,
				height: size,
				boxShadow:
					variant === "ember"
						? "0 6px 16px -6px rgba(209, 96, 34, 0.6)"
						: undefined,
			}}
		>
			{variant === "ember" ? <BrandGradientFill radius={size / 2} /> : null}
			<WanditIcon
				name={icon}
				size={iconSize}
				color={iconColor ?? defaultIconColor}
			/>
		</AppPressableFeedback>
	);
}
