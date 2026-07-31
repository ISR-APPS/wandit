import { memo, useState, useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 64rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const VIDEO_SRC = "/videos/login/wandit-builder-motion.mp4";
const POSTER_SRC = "/images/login/wandit-builder-motion-poster.jpg";

type NetworkInformation = {
	readonly saveData?: boolean;
	addEventListener: (type: "change", listener: () => void) => void;
	removeEventListener: (type: "change", listener: () => void) => void;
};

function getNetworkInformation() {
	return (
		navigator as Navigator & {
			readonly connection?: NetworkInformation;
		}
	).connection;
}

function subscribeToMediaQuery(query: string, onChange: () => void) {
	const mediaQuery = window.matchMedia(query);
	mediaQuery.addEventListener("change", onChange);

	return () => mediaQuery.removeEventListener("change", onChange);
}

function subscribeToDesktopLayout(onChange: () => void) {
	return subscribeToMediaQuery(DESKTOP_QUERY, onChange);
}

function getDesktopLayout() {
	return window.matchMedia(DESKTOP_QUERY).matches;
}

function getServerDesktopLayout() {
	return false;
}

function subscribeToReducedMotion(onChange: () => void) {
	return subscribeToMediaQuery(REDUCED_MOTION_QUERY, onChange);
}

function getReducedMotionPreference() {
	return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function getServerReducedMotionPreference() {
	return true;
}

function subscribeToDataSaver(onChange: () => void) {
	const connection = getNetworkInformation();
	connection?.addEventListener("change", onChange);

	return () => connection?.removeEventListener("change", onChange);
}

function getDataSaverPreference() {
	return getNetworkInformation()?.saveData ?? false;
}

function getServerDataSaverPreference() {
	return true;
}

const LoginVideo = memo(function LoginVideo() {
	const [isPlaying, setIsPlaying] = useState(false);

	return (
		<video
			aria-hidden="true"
			autoPlay
			className={`absolute inset-0 size-full object-cover object-top transition-opacity duration-700 ease-out ${
				isPlaying ? "opacity-100" : "opacity-0"
			}`}
			disablePictureInPicture
			disableRemotePlayback
			loop
			muted
			onError={() => setIsPlaying(false)}
			onPlaying={() => setIsPlaying(true)}
			playsInline
			poster={POSTER_SRC}
			preload="metadata"
			tabIndex={-1}
		>
			<source src={VIDEO_SRC} type="video/mp4" />
		</video>
	);
});

export const LoginVisualPanel = memo(function LoginVisualPanel() {
	const isDesktop = useSyncExternalStore(
		subscribeToDesktopLayout,
		getDesktopLayout,
		getServerDesktopLayout,
	);
	const prefersReducedMotion = useSyncExternalStore(
		subscribeToReducedMotion,
		getReducedMotionPreference,
		getServerReducedMotionPreference,
	);
	const prefersDataSaver = useSyncExternalStore(
		subscribeToDataSaver,
		getDataSaverPreference,
		getServerDataSaverPreference,
	);
	const shouldPlayVideo =
		isDesktop && !prefersReducedMotion && !prefersDataSaver;

	return (
		<div className="hidden w-1/2 overflow-hidden bg-[#f8f1e8] lg:relative lg:block lg:min-h-[100dvh]">
			{isDesktop ? (
				<img
					src={POSTER_SRC}
					alt=""
					className="absolute inset-0 size-full object-cover object-top"
					fetchPriority="high"
				/>
			) : null}

			{shouldPlayVideo ? <LoginVideo /> : null}
		</div>
	);
});
