import * as BoldIcons from "@solar-icons/react-native/Bold";
import * as LinearIcons from "@solar-icons/react-native/Linear";
import type { Icon, IconProps } from "@solar-icons/react-native/lib/types";

type AppIconVariant = "bold" | "linear";

type AppIconName = keyof typeof BoldIcons & keyof typeof LinearIcons;

type AppIconProps = IconProps & {
	name: AppIconName;
	variant?: AppIconVariant;
};

const ICON_SETS: Record<AppIconVariant, Record<string, Icon>> = {
	bold: BoldIcons as Record<string, Icon>,
	linear: LinearIcons as Record<string, Icon>,
};

export function AppIcon({ name, variant = "linear", ...props }: AppIconProps) {
	const IconComponent = ICON_SETS[variant][name];

	if (!IconComponent) {
		return null;
	}

	return <IconComponent {...props} />;
}

export type { AppIconName, AppIconProps, AppIconVariant };
