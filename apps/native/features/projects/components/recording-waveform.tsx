import type { AudioRecorder } from "expo-audio";
import { useAudioRecorderState } from "expo-audio";
import { useThemeColor } from "heroui-native";
import { memo, useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import Animated, {
	Easing,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";

const BAR_COUNT = 34;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 30;
const BAR_WIDTH = 2.5;
const BAR_GAP = 2.5;
const METER_INTERVAL_MS = 66;
// Speech mostly lives between these dBFS levels. Mapping this narrow window
// (instead of the full -60..0 hardware range) is what makes the bars visibly
// ride the voice: quiet moments drop to stubs, normal speech moves mid-range.
const METER_FLOOR_DB = -50;
const METER_CEIL_DB = -10;
// Older bars fade out toward the left so the strip reads as flowing motion.
const BAR_MIN_OPACITY = 0.3;
const WAVEFORM_BARS = Array.from({ length: BAR_COUNT }, (_, index) => ({
	id: `waveform-bar-${index}`,
	index,
}));

type RecordingWaveformProps = {
	elapsedSeconds: number;
	recorder: AudioRecorder;
};

export function RecordingWaveform({
	elapsedSeconds,
	recorder,
}: RecordingWaveformProps) {
	const accent = useThemeColor("accent");
	const foreground = useThemeColor("foreground");
	const levelValuesRef = useRef<Array<SharedValue<number> | null>>([]);

	const registerLevel = useCallback(
		(index: number, level: SharedValue<number>) => {
			levelValuesRef.current[index] = level;
		},
		[],
	);

	return (
		<View className="min-w-0 flex-1 flex-row items-center gap-2.5">
			{/* Reference layout: recording dot + timer on the left, then the live
			    bars flow toward the confirm button on the right. */}
			<View className="flex-row items-center gap-2">
				<PulsingRecordDot color={accent} />
				<Text
					className="font-mono text-[13px]"
					style={{ color: foreground, fontVariant: ["tabular-nums"] }}
				>
					{formatElapsed(elapsedSeconds)}
				</Text>
			</View>
			{/* justify-end + overflow-hidden: on narrow screens the OLD bars clip
			    away on the left while the newest stay visible on the right. */}
			<View
				className="h-9 min-w-0 flex-1 flex-row items-center justify-end overflow-hidden"
				style={{ gap: BAR_GAP }}
			>
				<WaveformMeter recorder={recorder} levelValuesRef={levelValuesRef} />
				{WAVEFORM_BARS.map((bar) => (
					<WaveformBar
						key={bar.id}
						index={bar.index}
						color={accent}
						onRegister={registerLevel}
					/>
				))}
			</View>
		</View>
	);
}

const WaveformMeter = memo(function WaveformMeter({
	levelValuesRef,
	recorder,
}: {
	levelValuesRef: React.MutableRefObject<Array<SharedValue<number> | null>>;
	recorder: AudioRecorder;
}) {
	const state = useAudioRecorderState(recorder, METER_INTERVAL_MS);

	useEffect(() => {
		const levels = levelValuesRef.current;
		if (levels.length === 0) {
			return;
		}

		const nextLevel = state.isRecording ? normalizeMetering(state.metering) : 0;

		for (let index = 0; index < BAR_COUNT - 1; index += 1) {
			const shiftedLevel = levels[index + 1]?.get() ?? 0;
			levels[index]?.set(
				withTiming(shiftedLevel, {
					duration: 70,
					easing: Easing.out(Easing.cubic),
				}),
			);
		}

		levels[BAR_COUNT - 1]?.set(
			withTiming(nextLevel, {
				duration: 70,
				easing: Easing.out(Easing.cubic),
			}),
		);
	}, [levelValuesRef, state.isRecording, state.metering]);

	return null;
});

function WaveformBar({
	color,
	index,
	onRegister,
}: {
	color: string;
	index: number;
	onRegister: (index: number, level: SharedValue<number>) => void;
}) {
	const level = useSharedValue(0);

	useEffect(() => {
		onRegister(index, level);
	}, [index, level, onRegister]);

	const animatedStyle = useAnimatedStyle(() => ({
		height: BAR_MIN_HEIGHT + level.get() * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT),
	}));

	return (
		<Animated.View
			style={[
				{
					backgroundColor: color,
					borderRadius: BAR_WIDTH,
					// Static fade by age: oldest (left) faint, newest (right) solid.
					opacity:
						BAR_MIN_OPACITY + (1 - BAR_MIN_OPACITY) * (index / (BAR_COUNT - 1)),
					width: BAR_WIDTH,
				},
				animatedStyle,
			]}
		/>
	);
}

function PulsingRecordDot({ color }: { color: string }) {
	const pulse = useSharedValue(0);

	useEffect(() => {
		pulse.set(
			withRepeat(
				withTiming(1, {
					duration: 760,
					easing: Easing.inOut(Easing.ease),
				}),
				-1,
				true,
			),
		);
	}, [pulse]);

	// Soft terracotta pulse (reference design) instead of an alarm-red dot.
	const animatedStyle = useAnimatedStyle(() => ({
		opacity: 0.45 + pulse.get() * 0.45,
		transform: [{ scale: 0.85 + pulse.get() * 0.25 }],
	}));

	return (
		<Animated.View
			accessibilityElementsHidden
			importantForAccessibility="no"
			className="h-2 w-2 rounded-full"
			style={[{ backgroundColor: color }, animatedStyle]}
		/>
	);
}

function normalizeMetering(metering: number | undefined) {
	if (typeof metering !== "number" || Number.isNaN(metering)) {
		return 0;
	}

	const clamped = Math.min(METER_CEIL_DB, Math.max(METER_FLOOR_DB, metering));
	const linear = (clamped - METER_FLOOR_DB) / (METER_CEIL_DB - METER_FLOOR_DB);

	// A slightly expansive curve keeps quiet passages low instead of letting
	// mic auto-gain push every bar toward the ceiling.
	return linear ** 1.2;
}

function formatElapsed(seconds: number) {
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;

	return `${minutes}:${String(remainder).padStart(2, "0")}`;
}
