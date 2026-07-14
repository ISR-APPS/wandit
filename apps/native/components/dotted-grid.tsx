import { useId } from "react";
import { StyleSheet } from "react-native";
import Svg, {
	Circle,
	Defs,
	Mask,
	Pattern,
	RadialGradient,
	Rect,
	Stop,
} from "react-native-svg";

type DottedGridProps = {
	/** Dot color (plain hex/rgba — RN color parser). */
	color: string;
	opacity?: number;
	/** Vertical center of the visibility mask, e.g. "32%". */
	maskCenterY?: string;
};

/**
 * The prototype's dotted-grid backdrop: a 24px dot lattice faded out through
 * an elliptical mask so it only shows around the hero area.
 */
export function DottedGrid({
	color,
	opacity = 0.11,
	maskCenterY = "32%",
}: DottedGridProps) {
	const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
	const dotsId = `dots${uid}`;
	const fadeId = `fade${uid}`;
	const maskId = `mask${uid}`;

	return (
		<Svg style={StyleSheet.absoluteFill} pointerEvents="none">
			<Defs>
				<Pattern
					id={dotsId}
					width={24}
					height={24}
					patternUnits="userSpaceOnUse"
				>
					<Circle cx={12} cy={12} r={1} fill={color} fillOpacity={opacity} />
				</Pattern>
				<RadialGradient id={fadeId} cx="50%" cy={maskCenterY} rx="62%" ry="46%">
					<Stop offset="25%" stopColor="#ffffff" stopOpacity={1} />
					<Stop offset="72%" stopColor="#ffffff" stopOpacity={0} />
				</RadialGradient>
				<Mask id={maskId}>
					<Rect width="100%" height="100%" fill={`url(#${fadeId})`} />
				</Mask>
			</Defs>
			<Rect
				width="100%"
				height="100%"
				fill={`url(#${dotsId})`}
				mask={`url(#${maskId})`}
			/>
		</Svg>
	);
}
