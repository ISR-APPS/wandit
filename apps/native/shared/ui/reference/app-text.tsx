import { cn } from "heroui-native";
import { Text, type TextProps, type TextStyle } from "react-native";

type Variant =
	| "title"
	| "subtitle"
	| "heading"
	| "body"
	| "body-sm"
	| "caption"
	| "overline"
	| "label";

type AppTextProps = TextProps & {
	variant?: Variant;
	ref?: React.Ref<Text>;
};

const variantClasses: Record<Variant, string> = {
	title: "text-2xl font-bold text-foreground tracking-tight",
	subtitle: "text-base text-muted",
	heading: "text-lg font-bold text-foreground",
	body: "text-base text-foreground",
	"body-sm": "text-sm text-muted leading-snug",
	caption: "text-xs text-muted",
	overline: "text-xs font-semibold uppercase text-accent",
	label: "text-sm font-semibold text-foreground",
};

const variantExtraStyles: Partial<Record<Variant, TextStyle>> = {
	title: { lineHeight: 32 },
	overline: { letterSpacing: 1 },
};

export function AppText({
	variant = "body",
	className,
	style,
	ref,
	...props
}: AppTextProps) {
	const extraStyle = variantExtraStyles[variant];

	return (
		<Text
			ref={ref}
			className={cn(variantClasses[variant], className)}
			style={[extraStyle, style]}
			{...props}
		/>
	);
}
