/**
 * Question the agent asks before it continues: a radio list of options,
 * a "Something else" input, and a Continue button. After the user answers,
 * the card shows the answer with a check mark and no controls.
 * Rendered by chat-message.tsx for each `data-question` part.
 * Pure presentation: `onAnswer` hands the choice to the caller, who sends it.
 */

import { Button } from "@wandit/ui/components/button";
import { Input } from "@wandit/ui/components/input";
import { CircleCheck } from "lucide-react";
import { useId, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { MessageCard } from "./message-card";

/** Props of one `data-question` part, as chat-message.tsx passes them. */
export type QuestionCardProps = {
	/** What the agent asks, one sentence. Shown as the card title. */
	question: string;
	/** Answers the agent offers, in order. Each one is a radio row. */
	options: string[];
	/** null while the question is open. The mock service fills it with the next user message. */
	answer: string | null;
	/** Gets the typed text, trimmed, or the chosen option. The caller sends it as a user message. */
	onAnswer: (text: string) => void;
};

/** Keeps the pick and the typed text in local state until the `answer` prop closes the card. */
export function QuestionCard({
	question,
	options,
	answer,
	onAnswer,
}: QuestionCardProps) {
	const { t } = useTranslation();
	const id = useId();
	const [chosen, setChosen] = useState<string | null>(null);
	const [typed, setTyped] = useState("");
	const otherLabel = t("appBuilder.chat.question.other");
	const typedTrimmed = typed.trim();
	// The typed text wins over the radio, because it is the more specific answer.
	const answerText = typedTrimmed.length > 0 ? typedTrimmed : chosen;

	if (answer !== null) {
		return (
			<MessageCard className="p-4">
				<p dir="auto" className="font-semibold text-sm">
					{question}
				</p>
				<div className="mt-2 flex items-center gap-2 text-sm">
					<CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
					<span dir="auto">{answer}</span>
				</div>
			</MessageCard>
		);
	}

	return (
		<MessageCard className="p-4">
			<p id={`${id}-title`} dir="auto" className="font-semibold text-sm">
				{question}
			</p>
			<div
				role="radiogroup"
				aria-labelledby={`${id}-title`}
				className="mt-3 flex flex-col gap-1"
			>
				{options.map((option) => (
					<label
						key={option}
						className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-sm hover:bg-accent"
					>
						<input
							type="radio"
							name={id}
							value={option}
							checked={option === chosen}
							onChange={() => setChosen(option)}
							className="size-4 shrink-0 appearance-none rounded-full border-2 border-stone transition-colors checked:border-[5px] checked:border-primary"
						/>
						<span dir="auto">{option}</span>
					</label>
				))}
			</div>
			<Input
				dir="auto"
				value={typed}
				placeholder={otherLabel}
				aria-label={otherLabel}
				onChange={(event) => setTyped(event.target.value)}
				className="mt-2 h-8 text-sm"
			/>
			<div className="mt-3 flex justify-end">
				<Button
					size="sm"
					disabled={answerText === null}
					onClick={() => {
						if (answerText !== null) onAnswer(answerText);
					}}
				>
					{t("appBuilder.chat.question.continue")}
				</Button>
			</div>
		</MessageCard>
	);
}
