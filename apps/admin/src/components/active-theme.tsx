import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

import {
	applyThemeConfig,
	readThemeConfig,
	THEME_CONFIG_STORAGE_KEY,
	type ThemeConfig,
} from "@/lib/themes";

type ThemeConfigContextValue = {
	theme: ThemeConfig;
	setTheme: (theme: ThemeConfig) => void;
};

const ThemeConfigContext = createContext<ThemeConfigContextValue | undefined>(
	undefined,
);

export function ActiveThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setTheme] = useState<ThemeConfig>(readThemeConfig);

	useEffect(() => {
		applyThemeConfig(theme);
		window.localStorage.setItem(
			THEME_CONFIG_STORAGE_KEY,
			JSON.stringify(theme),
		);
	}, [theme]);

	return (
		<ThemeConfigContext.Provider value={{ theme, setTheme }}>
			{children}
		</ThemeConfigContext.Provider>
	);
}

export function useThemeConfig() {
	const context = useContext(ThemeConfigContext);
	if (!context) {
		throw new Error(
			"useThemeConfig must be used within an ActiveThemeProvider",
		);
	}

	return context;
}
