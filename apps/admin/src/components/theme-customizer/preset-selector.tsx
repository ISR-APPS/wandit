import { useThemeConfig } from "@/components/active-theme";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { DEFAULT_THEME, THEMES, type ThemePreset } from "@/lib/themes";

export function PresetSelector() {
	const { theme, setTheme } = useThemeConfig();

	return (
		<div className="flex flex-col gap-3">
			<Label>Theme preset</Label>
			<Select
				value={theme.preset}
				onValueChange={(value) =>
					setTheme({
						...DEFAULT_THEME,
						preset: value as ThemePreset,
					})
				}
			>
				<SelectTrigger className="w-full">
					<SelectValue placeholder="Select a theme" />
				</SelectTrigger>
				<SelectContent align="end">
					<SelectGroup>
						{THEMES.map((preset) => (
							<SelectItem key={preset.value} value={preset.value}>
								<div className="flex shrink-0 gap-1">
									{preset.colors.map((color) => (
										<span
											key={color}
											className="size-2 rounded-full"
											style={{ backgroundColor: color }}
										/>
									))}
								</div>
								{preset.name}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
