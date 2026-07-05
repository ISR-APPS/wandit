import {
	cn,
	Typography,
	type TypographyColor,
	type TypographyRootProps,
	type TypographyType,
	type TypographyWeight,
} from "heroui-native";
import type { Ref } from "react";
import type { Text as RNText } from "react-native";

type AppTextVariant =
	| "display"
	| "hero"
	| "title"
	| "subtitle"
	| "heading"
	| "section"
	| "body"
	| "body-sm"
	| "caption"
	| "counter"
	| "metric"
	| "metric-lg"
	| "option-title"
	| "option-description"
	| "overline"
	| "label"
	| "button";

type AppTextPreset = {
	className?: string;
	color?: TypographyColor;
	type: TypographyType;
	weight?: TypographyWeight;
};

export type AppTextProps = Omit<TypographyRootProps, "type"> & {
	ref?: Ref<RNText>;
	type?: TypographyType;
	variant?: AppTextVariant;
};

const appTextPresets: Record<AppTextVariant, AppTextPreset> = {
	display: {
		className: "text-[32px] font-black leading-[33px] tracking-normal",
		type: "h1",
	},
	hero: {
		className: "text-[34px] font-black leading-[35px] tracking-normal",
		type: "h1",
	},
	title: {
		className: "text-[30px] font-black leading-[32px] tracking-normal",
		type: "h2",
	},
	subtitle: {
		className: "text-[15px] font-normal leading-[23px] tracking-normal",
		color: "muted",
		type: "body-sm",
	},
	heading: {
		className: "text-[22px] font-extrabold leading-[24px] tracking-normal",
		type: "h4",
	},
	section: {
		className: "text-[20px] font-extrabold leading-[22px] tracking-normal",
		type: "h5",
	},
	body: {
		className: "text-[16px] font-normal leading-[24px] tracking-normal",
		type: "body",
	},
	"body-sm": {
		className: "text-[15px] font-normal leading-[22px] tracking-normal",
		color: "muted",
		type: "body-sm",
	},
	caption: {
		className: "text-[13px] font-normal leading-[18px] tracking-normal",
		color: "muted",
		type: "body-xs",
	},
	counter: {
		className: "text-[13px] font-bold leading-4 tracking-normal",
		color: "muted",
		type: "body-xs",
	},
	metric: {
		className: "font-display text-[40px] leading-[50px] tracking-normal",
		type: "h2",
	},
	"metric-lg": {
		className: "font-display text-[44px] leading-[54px] tracking-normal",
		type: "h1",
	},
	"option-title": {
		className: "text-[17px] font-extrabold leading-[22px] tracking-normal",
		type: "body",
	},
	"option-description": {
		className: "text-[13px] font-normal leading-[18px] tracking-normal",
		color: "muted",
		type: "body-xs",
	},
	overline: {
		className: "text-[12px] font-bold uppercase leading-4 tracking-[1px]",
		color: "muted",
		type: "body-xs",
	},
	label: {
		className: "text-[15px] leading-[20px] tracking-normal",
		type: "body-sm",
		weight: "semibold",
	},
	button: {
		className: "text-[17px] font-bold leading-[22px] tracking-normal",
		type: "body",
	},
};

export type { AppTextVariant };

export function AppText({
	className,
	color,
	ref,
	type,
	variant = "body",
	weight,
	...props
}: AppTextProps) {
	const preset = appTextPresets[variant];
	return (
		<Typography
			ref={ref}
			className={cn(preset.className, className)}
			color={color ?? preset.color}
			type={type ?? preset.type}
			weight={weight ?? preset.weight}
			{...props}
		/>
	);
}
