import type { AIProvider } from "./types";
import { RulesBasedProvider } from "./providers/rules-based";
import { OpenAIProvider } from "./providers/openai";
import { getAIConfig } from "./config";

export function createAIProvider(): AIProvider {
  const config = getAIConfig();
  if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAIProvider();
  }
  return new RulesBasedProvider();
}

export { RulesBasedProvider, classifyIntentRules } from "./providers/rules-based";
export { OpenAIProvider } from "./providers/openai";
