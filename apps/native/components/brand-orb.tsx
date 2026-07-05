import LottieView from "lottie-react-native";
import { useEffect, useId } from "react";
import { View } from "react-native";
import Animated, {
	Easing,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import Svg, {
	Circle,
	ClipPath,
	Defs,
	Ellipse,
	G,
	RadialGradient,
	Stop,
} from "react-native-svg";

// Brand orbs from the prototypes. "ember" is the dark welcome orb — the
// prototype embeds a Lottie (glossy bubble + speckles) and only falls back to
// a CSS glow when it fails to load, so we play the extracted Lottie asset.
// "aurora" is the light home orb: a cream sphere with spinning ember/violet/
// gold blobs and a top-left highlight. Everything is drawn inside one SVG and
// clipped by a circle ClipPath: View borderRadius+overflow does NOT reliably
// round-clip children on iOS, which used to leak the blobs as a square.

type BrandOrbProps = {
	size: number;
	variant?: "ember" | "aurora";
};

type BlobSpec = {
	/** Center as a fraction of the blob layer (layer square inset from orb). */
	cx: number;
	cy: number;
	/** Diameter as a fraction of the layer. */
	d: number;
	color: string;
	opacity: number;
};

type SpinLayerSpec = {
	/** CSS inset of the layer as a fraction of the orb (-0.25 = inset:-25%). */
	inset: number;
	duration: number;
	reverse: boolean;
	blobs: BlobSpec[];
};

const SPIN_LAYERS: SpinLayerSpec[] = [
	{
		inset: -0.25,
		duration: 13000,
		reverse: false,
		blobs: [
			{ cx: 0.3, cy: 0.62, d: 0.55, color: "#F97C3D", opacity: 0.9 },
			{ cx: 0.72, cy: 0.34, d: 0.48, color: "#C097DF", opacity: 0.85 },
			{ cx: 0.56, cy: 0.9, d: 0.52, color: "#F7C97B", opacity: 0.95 },
		],
	},
	{
		inset: -0.15,
		duration: 21000,
		reverse: true,
		blobs: [
			{ cx: 0.35, cy: 0.73, d: 0.38, color: "#EC785B", opacity: 0.7 },
			{ cx: 0.73, cy: 0.61, d: 0.3, color: "#FFFFFF", opacity: 1 },
		],
	},
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useLoop(duration: number, easing = Easing.linear) {
	const progress = useSharedValue(0);
	useEffect(() => {
		progress.set(withRepeat(withTiming(1, { duration, easing }), -1, false));
	}, [progress, duration, easing]);
	return progress;
}

/**
 * One soft blob orbiting the orb center. The blobs are radially symmetric
 * gradients, so spinning the whole layer (CSS wOrbSpin) is equivalent to
 * orbiting each blob center — which keeps the geometry inside the SVG where
 * the circular ClipPath can do its job.
 */
function OrbitingBlob({
	blob,
	layer,
	size,
	fillId,
}: {
	blob: BlobSpec;
	layer: SpinLayerSpec;
	size: number;
	fillId: string;
}) {
	const progress = useLoop(layer.duration);
	const center = size / 2;
	const scale = 1 - 2 * layer.inset;
	const x0 = (layer.inset + blob.cx * scale) * size;
	const y0 = (layer.inset + blob.cy * scale) * size;
	const radius = (blob.d / 2) * scale * size;
	const orbit = Math.hypot(x0 - center, y0 - center);
	const baseAngle = Math.atan2(y0 - center, x0 - center);
	const direction = layer.reverse ? -1 : 1;

	const animatedProps = useAnimatedProps(() => {
		const angle = baseAngle + direction * progress.get() * 2 * Math.PI;
		return {
			cx: center + orbit * Math.cos(angle),
			cy: center + orbit * Math.sin(angle),
		};
	});

	return (
		<AnimatedCircle animatedProps={animatedProps} r={radius} fill={fillId} />
	);
}

export function BrandOrb({ size, variant = "ember" }: BrandOrbProps) {
	const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
	const float = useSharedValue(0);

	useEffect(() => {
		float.set(
			withRepeat(
				withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
				-1,
				true,
			),
		);
	}, [float]);

	const floatStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: float.get() * -7 }],
	}));

	if (variant === "ember") {
		// The Lottie loop carries its own motion (bubble drift + speckles), so no
		// extra float transform — same as the prototype's .orb-slot.
		return (
			<LottieView
				source={require("../assets/lottie/brand-orb.json")}
				autoPlay
				loop
				style={{ width: size, height: size }}
			/>
		);
	}

	const center = size / 2;

	return (
		<Animated.View style={[{ width: size, height: size }, floatStyle]}>
			{/* Under-glow on its own circle layer: RN boxShadow follows the view's
			    border radius, and on the square wrapper it painted a white rect. */}
			<View
				style={{
					position: "absolute",
					width: size,
					height: size,
					borderRadius: center,
					boxShadow: `0 ${size * 0.14}px ${size * 0.32}px ${-size * 0.12}px rgba(209, 96, 34, 0.5)`,
				}}
			/>
			<Svg width={size} height={size}>
				<Defs>
					<ClipPath id={`clip${uid}`}>
						<Circle cx={center} cy={center} r={center} />
					</ClipPath>
					<RadialGradient
						id={`sphere${uid}`}
						cx="32%"
						cy="28%"
						rx="75%"
						ry="75%"
					>
						<Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
						<Stop offset="45%" stopColor="#F4F1EC" stopOpacity={1} />
						<Stop offset="100%" stopColor="#E5D9C9" stopOpacity={1} />
					</RadialGradient>
					{SPIN_LAYERS.map((layer, layerIndex) =>
						layer.blobs.map((blob, blobIndex) => (
							<RadialGradient
								key={blob.color}
								id={`blob${uid}${layerIndex}${blobIndex}`}
								cx="50%"
								cy="50%"
								rx="50%"
								ry="50%"
							>
								<Stop
									offset="0%"
									stopColor={blob.color}
									stopOpacity={blob.opacity}
								/>
								<Stop
									offset="55%"
									stopColor={blob.color}
									stopOpacity={blob.opacity * 0.75}
								/>
								<Stop offset="100%" stopColor={blob.color} stopOpacity={0} />
							</RadialGradient>
						)),
					)}
					{/* Prototype's `inset 0 -8px 22px oklch(0.66 0.19 35 / 0.12)`: a rim
					    gradient centered above the sphere so only the bottom edge shades. */}
					<RadialGradient id={`rim${uid}`} cx="50%" cy="22%" rx="82%" ry="82%">
						<Stop offset="0%" stopColor="#E4643C" stopOpacity={0} />
						<Stop offset="74%" stopColor="#E4643C" stopOpacity={0} />
						<Stop offset="100%" stopColor="#E4643C" stopOpacity={0.14} />
					</RadialGradient>
					<RadialGradient id={`hl${uid}`} cx="50%" cy="50%" rx="50%" ry="50%">
						<Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.95} />
						<Stop offset="70%" stopColor="#FFFFFF" stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<G clipPath={`url(#clip${uid})`}>
					<Circle
						cx={center}
						cy={center}
						r={center}
						fill={`url(#sphere${uid})`}
					/>
					{SPIN_LAYERS.map((layer, layerIndex) =>
						layer.blobs.map((blob, blobIndex) => (
							<OrbitingBlob
								key={blob.color}
								blob={blob}
								layer={layer}
								size={size}
								fillId={`url(#blob${uid}${layerIndex}${blobIndex})`}
							/>
						)),
					)}
					<Circle cx={center} cy={center} r={center} fill={`url(#rim${uid})`} />
					<Ellipse
						cx="37%"
						cy="23%"
						rx="25%"
						ry="17%"
						fill={`url(#hl${uid})`}
					/>
				</G>
			</Svg>
		</Animated.View>
	);
}
