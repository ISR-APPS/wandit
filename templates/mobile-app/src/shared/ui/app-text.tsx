/**
 * App text. Screens render text through AppText, never through the React Native Text.
 * It maps five text roles to Uniwind classes. Change the type scale here.
 * The faces come from the `--font-*` tokens in src/global.css.
 */
import { cn } from "heroui-native";
import { Text, type TextProps } from "react-native";

/**
 * Text roles. `display` is the one big line of a hero, `title` the screen title,
 * and `caption` small, muted text.
 */
export type AppTextVariant =
	| "display"
	| "title"
	| "heading"
	| "body"
	| "caption";

// Utility classes only. HeroUI Typography classes sit outside the CSS layers.
// On the web, they beat every className that a screen adds, for example `text-4xl`.
const variantClasses = {
	display: "font-display text-5xl leading-tight tracking-tight text-foreground",
	title: "font-display text-3xl leading-9 tracking-tight text-foreground",
	heading: "font-semibold text-xl leading-7 tracking-tight text-foreground",
	body: "font-normal text-base leading-7 text-foreground",
	caption: "font-normal text-sm leading-6 text-muted",
} as const satisfies Record<AppTextVariant, string>;

/** React Native Text props plus a text role. */
export type AppTextProps = TextProps & {
	/** Text role. It sets the size, the face, and the default color. */
	variant?: AppTextVariant;
	/** Uniwind classes. They win over the role, for example `text-danger` or `text-center`. */
	className?: string;
};

/**
 * Text with a role preset. To change the face, change the role: two font-* classes conflict.
 * A nested AppText repeats the role of its parent, or it falls back to `body`.
 */
export function AppText({
	variant = "body",
	className,
	...props
}: AppTextProps) {
	// The React Native Text is black by default. A design world can rewrite a role
	// without a color class, so the theme color comes first and the role can win.
	return (
		<Text
			className={cn("text-foreground", variantClasses[variant], className)}
			{...props}
		/>
	);
}
