import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

export type RadialGlowStop = {
	/** Gradient offset, e.g. "0%" | "70%". */
	offset: string;
	/** Plain hex color — RN's SVG parser does not read oklch(). */
	color: string;
	opacity: number;
};

export type RadialGlowProps = {
	/** Ellipse center/radii as percentages, mirroring CSS radial-gradient. */
	cx: string;
	cy: string;
	rx: string;
	ry: string;
	stops: RadialGlowStop[];
};

/**
 * One CSS `radial-gradient(rx ry at cx cy, …)` layer as an absolute SVG fill.
 * Stack several to reproduce the prototype's ember glows.
 */
export function RadialGlow({ cx, cy, rx, ry, stops }: RadialGlowProps) {
	const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

	return (
		<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
			<Defs>
				<RadialGradient id={id} cx={cx} cy={cy} rx={rx} ry={ry}>
					{stops.map((stop) => (
						<Stop
							key={`${stop.offset}${stop.color}`}
							offset={stop.offset}
							stopColor={stop.color}
							stopOpacity={stop.opacity}
						/>
					))}
				</RadialGradient>
			</Defs>
			<Rect width="100%" height="100%" fill={`url(#${id})`} />
		</Svg>
	);
}
