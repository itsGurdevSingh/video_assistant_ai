import { ChatMistralAI } from "@langchain/mistralai";

export type MistralModelOptions = {
  apiKey: string;
  model?: string;
  temperature?: number;
};

export function createMistralModel(
  options: MistralModelOptions,
) {
  return new ChatMistralAI({
    apiKey: options.apiKey,
    model:
      options.model ??
      "open-mistral-nemo",
    temperature:
      options.temperature ?? 0,
  });
}