interface SuggestedPromptsProps {
  prompts: string[];
  onSelectPrompt: (prompt: string) => void;
}

export const SuggestedPrompts = ({ prompts, onSelectPrompt }: SuggestedPromptsProps) => (
  <div className="flex flex-wrap gap-2">
    {prompts.map((prompt) => (
      <button
        key={prompt}
        type="button"
        onClick={() => onSelectPrompt(prompt)}
        className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition hover:bg-slate-100"
      >
        {prompt}
      </button>
    ))}
  </div>
);
