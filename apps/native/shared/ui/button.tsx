import {
	type ButtonSize,
	cn,
	PressableFeedback,
	type PressableFeedbackProps,
} from "heroui-native";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { tv } from "tailwind-variants";

import { BRAND_BUTTON_RADIUS, BRAND_GLOW } from "@/shared/lib/brand";

import { AppText } from "./app-text";
import { BrandGradientFill } from "./brand-gradient-fill";

export type AppButtonTone = "primary" | "accent" | "ghost";

type AppButtonBaseProps = Omit<
	PressableFeedbackProps,
	"animation" | "children"
>;

export type AppButtonProps = AppButtonBaseProps & {
	children: ReactNode;
	fullWidth?: boolean;
	isIconOnly?: boolean;
	labelClassName?: string;
	size?: ButtonSize;
	tone?: AppButtonTone;
};

const buttonVariants = tv({
	// `relative` anchors the gradient fill; it rounds itself via the Rect's rx
	// (NOT overflow-hidden, which would clip the primary tone's iOS glow shadow).
	base: "relative flex-row items-center justify-center border-0",
	variants: {
		fullWidth: {
			true: "w-full",
			false: "",
		},
		isIconOnly: {
			true: "aspect-square px-0",
			false: "",
		},
		size: {
			sm: "h-10 min-h-10 rounded-[14px] px-3.5",
			md: "h-12 min-h-12 rounded-[16px] px-4",
			lg: "h-14 min-h-14 rounded-[20px] px-5",
		},
		tone: {
			// primary renders the brand orange gradient on top of this accent fallback.
			primary: "bg-accent",
			accent: "bg-accent",
			ghost: "bg-transparent",
		},
		isDisabled: {
			true: "opacity-disabled",
			false: "",
		},
	},
	defaultVariants: {
		fullWidth: true,
		isIconOnly: false,
		isDisabled: false,
		size: "lg",
		tone: "primary",
	},
});

const buttonLabelVariants = tv({
	base: "font-bold tracking-normal",
	variants: {
		size: {
			sm: "text-sm leading-5",
			md: "text-base leading-[22px]",
			lg: "text-[17px] leading-[22px]",
		},
		tone: {
			primary: "text-accent-foreground",
			accent: "text-accent-foreground",
			ghost: "text-muted",
		},
	},
	defaultVariants: {
		size: "lg",
		tone: "primary",
	},
});

export function AppButton({
	accessibilityRole = "button",
	accessibilityState,
	children,
	className,
	fullWidth = true,
	isIconOnly = false,
	isDisabled = false,
	labelClassName,
	size = "lg",
	style,
	tone = "primary",
	...props
}: AppButtonProps) {
	const resolvedFullWidth = isIconOnly ? false : fullWidth;
	const shouldRenderLabel =
		typeof children === "string" || typeof children === "number";

	// The orange gradient + glow are the primary CTA identity. Suppress both when
	// disabled so a caller's dimmed/override styling shows through.
	const isGradient = tone === "primary" && !isDisabled;
	const glowStyle: StyleProp<ViewStyle> = isGradient
		? { boxShadow: BRAND_GLOW[size] }
		: null;

	return (
		<PressableFeedback
			accessibilityRole={accessibilityRole}
			accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
			animation={{ scale: { ignoreScaleCoefficient: true, value: 0.975 } }}
			className={buttonVariants({
				fullWidth: resolvedFullWidth,
				isIconOnly,
				isDisabled,
				size,
				tone,
				className,
			})}
			isDisabled={isDisabled}
			style={[glowStyle, style]}
			{...props}
		>
			{isGradient ? (
				<BrandGradientFill radius={BRAND_BUTTON_RADIUS[size]} />
			) : null}
			{shouldRenderLabel ? (
				<AppText
					allowFontScaling={false}
					className={cn(buttonLabelVariants({ size, tone }), labelClassName)}
					pointerEvents="none"
					variant="button"
				>
					{children}
				</AppText>
			) : (
				children
			)}
		</PressableFeedback>
	);
}
