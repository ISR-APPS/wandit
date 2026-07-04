import type React from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { Uniwind, useUniwind } from "uniwind";

import { type ThemeName, getThemeIdFromName, isLightTheme } from "@/shared/lib/app-theme";

interface AppThemeContextType {
  currentTheme: string;
  isLight: boolean;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useUniwind();
  const currentTheme = theme as string;

  const isLight = useMemo(() => {
    return isLightTheme(currentTheme);
  }, [currentTheme]);

  const isDark = useMemo(() => {
    return !isLightTheme(currentTheme);
  }, [currentTheme]);

  const setTheme = useCallback((newTheme: ThemeName) => {
    Uniwind.setTheme(newTheme as Parameters<typeof Uniwind.setTheme>[0]);
  }, []);

  const toggleTheme = useCallback(() => {
    const themeId = getThemeIdFromName(currentTheme);

    if (themeId === "default") {
      Uniwind.setTheme(isLight ? "dark" : "light");
      return;
    }

    Uniwind.setTheme(
      (isLight ? `${themeId}-dark` : `${themeId}-light`) as Parameters<
        typeof Uniwind.setTheme
      >[0],
    );
  }, [currentTheme, isLight]);

  const value = useMemo(
    () => ({
      currentTheme: theme,
      isLight,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [isDark, isLight, setTheme, theme, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = () => {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
};

export type { ThemeName };
