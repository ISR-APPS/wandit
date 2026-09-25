/**
 * App text. Screens render text through AppText, never through the React Native Text.
 * It maps four text roles to HeroUI Native Typography. Change the type scale here.
 */
import { Typography, type TypographyRootProps } from "heroui-native";

/** Text roles. `title` is the screen title; `caption` is small, muted text. */
export type AppTextVariant = "title" | "heading" | "body" | "caption";

const variantProps = {
	title: { type: "h2" },
	heading: { type: "h4" },
	body: { type: "body" },
	caption: { type: "body-sm", color: "muted" },
} as const satisfies Record<
	AppTextVariant,
	Pick<TypographyRootProps, "type" | "color">
>;

/** HeroUI Native Typography props without `type`. `variant` sets the text role. */
export type AppTextProps = Omit<TypographyRootProps, "type"> & {
	/** Text role. It sets the size, the weight, and the default color. */
	variant?: AppTextVariant;
};

/** Typography with a role preset. A `color` prop overrides the preset color. */
export function AppText({ variant = "body", ...props }: AppTextProps) {
	return <Typography {...variantProps[variant]} {...props} />;
}
