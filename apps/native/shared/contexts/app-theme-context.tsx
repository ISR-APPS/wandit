// The shared UI kit resolves the theme context from this path. The app's
// active provider lives in contexts/app-theme-context.tsx; re-export it so the
// kit and the app always read the same context instance.
export {
	AppThemeProvider,
	useAppTheme,
} from "@/contexts/app-theme-context";
