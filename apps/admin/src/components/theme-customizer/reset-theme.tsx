import { useThemeConfig } from "@/components/active-theme";
import { Button } from "@/components/ui/button";
import { DEFAULT_THEME } from "@/lib/themes";

export function ResetThemeButton() {
	const { setTheme } = useThemeConfig();

	return (
		<Button className="mt-4 w-full" onClick={() => setTheme(DEFAULT_THEME)}>
			Reset to default
		</Button>
	);
}
