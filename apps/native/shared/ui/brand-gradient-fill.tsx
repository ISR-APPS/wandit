import { useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { useAppTheme } from "@/shared/contexts/app-theme-context";
import { BRAND_GRADIENT_DARK, BRAND_GRADIENT_LIGHT } from "@/shared/lib/brand";

type Props = {
	/** Corner radius so the gradient matches its rounded container. */
	radius?: number;
};

/**
 * Absolutely-positioned brand-orange gradient (light -> base, 135deg).
 * Drop it as the first child of a rounded, relatively-positioned container to
 * fill it with the FitCalAI primary gradient. Uses react-native-svg because
 * expo-linear-gradient is not a dependency.
 *
 * The Svg is sized from a measured wrapper (onLayout) instead of percentage
 * dimensions: inside auto-width containers (pill buttons) a percent-sized
 * Svg squares itself to the parent height, leaving the label half unpainted.
 */
export function BrandGradientFill({ radius = 0 }: Props) {
	// useId can contain ":" which breaks SVG url() refs — strip to alphanumerics.
	const gradientId = `brandGradient${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
	const { isDark } = useAppTheme();
	const [from, to] = isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT_LIGHT;
	const [size, setSize] = useState<{ width: number; height: number } | null>(
		null,
	);

	return (
		<View
			style={StyleSheet.absoluteFill}
			pointerEvents="none"
			onLayout={(event) => {
				const { width, height } = event.nativeEvent.layout;
				setSize((current) =>
					current?.width === width && current?.height === height
						? current
						: { width, height },
				);
			}}
		>
			{size ? (
				<Svg width={size.width} height={size.height}>
					<Defs>
						{/* x1,y1 -> x2,y2 top-left -> bottom-right approximates the 135deg ramp */}
						<LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
							<Stop offset="0" stopColor={from} />
							<Stop offset="1" stopColor={to} />
						</LinearGradient>
					</Defs>
					<Rect
						x="0"
						y="0"
						width={size.width}
						height={size.height}
						rx={radius}
						fill={`url(#${gradientId})`}
					/>
				</Svg>
			) : null}
		</View>
	);
}
