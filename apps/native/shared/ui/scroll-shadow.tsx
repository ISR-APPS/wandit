import {
	ScrollShadow as HeroScrollShadow,
	type ScrollShadowOrientation,
	type ScrollShadowProps,
	type ScrollShadowVisibility,
} from "heroui-native";
import { forwardRef, useId } from "react";
import type { StyleProp, View, ViewStyle } from "react-native";
import Svg, {
	Defs,
	Rect,
	Stop,
	LinearGradient as SvgLinearGradient,
} from "react-native-svg";

type GradientPoint = {
	x?: number;
	y?: number;
};

export type AppScrollShadowLinearGradientProps = {
	colors: readonly string[];
	locations?: readonly number[];
	start?: GradientPoint;
	end?: GradientPoint;
	style?: StyleProp<ViewStyle>;
};

export type AppScrollShadowLinearGradientComponent =
	ScrollShadowProps["LinearGradientComponent"];

export type AppScrollShadowProps = Omit<
	ScrollShadowProps,
	"LinearGradientComponent"
> & {
	LinearGradientComponent?: AppScrollShadowLinearGradientComponent;
};

export type AppScrollShadowOrientation = ScrollShadowOrientation;
export type AppScrollShadowVisibility = ScrollShadowVisibility;
export type AppScrollShadowRef = View;

function getOffset(
	locations: readonly number[] | undefined,
	index: number,
	count: number,
) {
	const location = locations?.[index];

	if (typeof location === "number") {
		return location;
	}

	return count <= 1 ? 0 : index / (count - 1);
}

function getPercent(value: number | undefined, fallback: number) {
	return `${(value ?? fallback) * 100}%`;
}

export function AppScrollShadowLinearGradient({
	colors,
	locations,
	start,
	end,
	style,
}: AppScrollShadowLinearGradientProps) {
	const rawId = useId();
	const gradientId = `app-scroll-shadow-${rawId.replace(
		/[^A-Za-z0-9_-]/g,
		"",
	)}`;
	const resolvedStart = start ?? { x: 0, y: 0 };
	const resolvedEnd = end ?? { x: 0, y: 1 };

	return (
		<Svg
			height="100%"
			pointerEvents="none"
			preserveAspectRatio="none"
			style={style}
			width="100%"
		>
			<Defs>
				<SvgLinearGradient
					id={gradientId}
					x1={getPercent(resolvedStart.x, 0)}
					x2={getPercent(resolvedEnd.x, 0)}
					y1={getPercent(resolvedStart.y, 0)}
					y2={getPercent(resolvedEnd.y, 1)}
				>
					{colors.map((color, index) => {
						const offset = getOffset(locations, index, colors.length);
						return (
							<Stop
								key={`${color}:${offset}`}
								offset={`${offset * 100}%`}
								stopColor={color}
							/>
						);
					})}
				</SvgLinearGradient>
			</Defs>
			<Rect
				fill={`url(#${gradientId})`}
				height="100%"
				width="100%"
				x="0"
				y="0"
			/>
		</Svg>
	);
}

const defaultLinearGradientComponent =
	AppScrollShadowLinearGradient as AppScrollShadowLinearGradientComponent;

export const AppScrollShadow = forwardRef<
	AppScrollShadowRef,
	AppScrollShadowProps
>(
	(
		{ LinearGradientComponent = defaultLinearGradientComponent, ...props },
		ref,
	) => (
		<HeroScrollShadow
			ref={ref}
			LinearGradientComponent={LinearGradientComponent}
			{...props}
		/>
	),
);

AppScrollShadow.displayName = "AppScrollShadow";
