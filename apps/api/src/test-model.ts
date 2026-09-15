import { createMistralModel } from "@video-assistant/ai";
import {config} from "dotenv";

config({
  path: new URL("../../../.env", import.meta.url),
});

const apiKey = process.env.MISTRAL_API_KEY;

if (!apiKey) {
  throw new Error(
    "MISTRAL_API_KEY is not defined",
  );
}

const model = createMistralModel({
  apiKey,
  model: "open-mistral-nemo",
  temperature: 0,
});

const response = await model.invoke(
  "Explain what a vector database does in one sentence.",
);

console.log(response.content);