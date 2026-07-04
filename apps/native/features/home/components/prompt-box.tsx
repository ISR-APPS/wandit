import { Button, Input, Surface, TextField } from "heroui-native";
import { useState } from "react";

type PromptBoxProps = {
	onSubmit: (prompt: string) => void;
};

export function PromptBox({ onSubmit }: PromptBoxProps) {
	const [prompt, setPrompt] = useState("");

	function handleSubmit() {
		const trimmed = prompt.trim();
		if (!trimmed) {
			return;
		}
		onSubmit(trimmed);
		setPrompt("");
	}

	return (
		<Surface variant="secondary" className="gap-3 rounded-2xl p-4">
			<TextField>
				<Input
					value={prompt}
					onChangeText={setPrompt}
					placeholder="A landing page for…"
					multiline
					className="min-h-20"
				/>
			</TextField>
			<Button onPress={handleSubmit} isDisabled={!prompt.trim()}>
				<Button.Label>Create</Button.Label>
			</Button>
		</Surface>
	);
}
