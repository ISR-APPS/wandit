import { useTranslation } from "@wandit/internationalization/react";
import { useThemeColor } from "heroui-native";
import { useId } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
	Defs,
	LinearGradient,
	Path,
	Stop,
	Text as SvgText,
} from "react-native-svg";

import { BrandOrb } from "@/components/brand-orb";
import { DottedGrid } from "@/components/dotted-grid";
import { RadialGlow } from "@/components/radial-glow";
import { WanditIcon } from "@/components/wandit-icon";
import { useAppTheme } from "@/contexts/app-theme-context";
import { enableAuthBypass } from "@/lib/dev-auth-bypass";
import { BRAND_GLOW } from "@/shared/lib/brand";
import { AppPressableFeedback } from "@/shared/ui/pressable-feedback";

function GoogleIcon() {
	return (
		<Svg width={18} height={18} viewBox="0 0 24 24">
			<Path
				fill="#4285F4"
				d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z"
			/>
			<Path
				fill="#34A853"
				d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24Z"
			/>
			<Path
				fill="#FBBC05"
				d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1Z"
			/>
			<Path
				fill="#EA4335"
				d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
			/>
		</Svg>
	);
}

/** Gradient-filled "Sell it." line (SVG — RN has no background-clip:text). */
function GradientHeadlineLine({ text }: { text: string }) {
	const id = `headline${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

	return (
		<Svg width="100%" height={46}>
			<Defs>
				<LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
					<Stop offset="0" stopColor="#FFBC56" />
					<Stop offset="1" stopColor="#FD6A3A" />
				</LinearGradient>
			</Defs>
			<SvgText
				x="50%"
				y="38"
				textAnchor="middle"
				fontFamily="BricolageGrotesque_800ExtraBold"
				fontSize="40"
				letterSpacing="-1.2"
				fill={`url(#${id})`}
			>
				{text}
			</SvgText>
		</Svg>
	);
}

/** Pre-login welcome (dark prototype §1a), theme-aware. */
export function WelcomeScreen() {
	const { t } = useTranslation();
	const insets = useSafeAreaInsets();
	const { isDark } = useAppTheme();
	const accent = useThemeColor("accent");

	function signInWithGoogle() {
		// DEV BYPASS: real Google OAuth can't round-trip in Expo Go (wandit://
		// isn't registered there), so the button drops straight into the app.
		// Restore the call below on a dev build, then delete lib/dev-auth-bypass.ts.
		// await authClient.signIn.social({ provider: "google", callbackURL: "/" });
		enableAuthBypass();
	}

	return (
		<View className="flex-1 bg-background">
			<DottedGrid
				color={isDark ? "#A79D91" : "#8F877B"}
				opacity={isDark ? 0.11 : 0.15}
				maskCenterY="32%"
			/>
			<RadialGlow
				cx="50%"
				cy="118%"
				rx="120%"
				ry="55%"
				stops={[
					{ offset: "0%", color: "#FD6A3A", opacity: isDark ? 0.28 : 0.18 },
					{ offset: "70%", color: "#FD6A3A", opacity: 0 },
				]}
			/>
			<View
				className="flex-1 items-center px-7"
				style={{
					paddingTop: insets.top + 30,
					paddingBottom: insets.bottom + 28,
				}}
			>
				<View className="mt-1.5 flex-row items-center gap-[7px]">
					<WanditIcon name="spark" size={17} color={accent} />
					<Text className="font-display text-[21px] text-foreground tracking-[-0.42px]">
						wandit
					</Text>
				</View>

				<View className="mt-16">
					<BrandOrb size={210} variant="ember" />
				</View>

				<View className="mt-[34px] w-full">
					<Text className="text-center font-display-extrabold text-[40px] text-foreground leading-[42px] tracking-[-1.2px]">
						{t("native.auth.welcome.headline1")}
					</Text>
					<Text className="text-center font-display-extrabold text-[40px] text-foreground leading-[42px] tracking-[-1.2px]">
						{t("native.auth.welcome.headline2")}
					</Text>
					<GradientHeadlineLine text={t("native.auth.welcome.headline3")} />
				</View>

				<Text className="mt-2 max-w-[290px] text-center text-[14.5px] text-muted leading-[22px]">
					{t("native.auth.welcome.tagline")}
				</Text>

				<View className="flex-1" />

				<AppPressableFeedback
					accessibilityRole="button"
					animation={{ scale: { ignoreScaleCoefficient: true, value: 0.975 } }}
					onPress={signInWithGoogle}
					className="h-[52px] w-full flex-row items-center justify-center gap-2.5 rounded-full bg-foreground"
					style={{ boxShadow: BRAND_GLOW.lg }}
				>
					<GoogleIcon />
					<Text className="font-sans-semibold text-[15.5px] text-background">
						{t("native.auth.welcome.googleCta")}
					</Text>
				</AppPressableFeedback>

				<View className="mt-4 flex-row items-center gap-1.5">
					<WanditIcon name="spark" size={10} color={accent} />
					<Text className="font-mono text-[10.5px] text-muted">
						{t("native.auth.welcome.betaHint")}
					</Text>
				</View>
			</View>
		</View>
	);
}
