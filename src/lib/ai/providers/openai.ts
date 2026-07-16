import type { AIProvider, IntentRequest, IntentResult, StructuredAIRequest, TokenUsage } from "../types";
import { getAIConfig, estimateCostUsd } from "../config";
import { parseIntentJson } from "./rules-based";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  readonly model: string;
  private apiKey: string;
  private config = getAIConfig();

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.OPENAI_API_KEY ?? "";
    this.model = this.config.model;
  }

  private async chat(messages: { role: string; content: string }[]): Promise<{
    content: string;
    usage: TokenUsage;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: this.config.temperature,
          max_tokens: this.config.maxTokens,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API error: ${res.status} ${err}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "{}";
      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;

      return {
        content,
        usage: {
          promptTokens,
          completionTokens,
          estimatedCostUsd: estimateCostUsd(this.name, this.model, promptTokens, completionTokens),
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async classifyIntent(input: IntentRequest): Promise<IntentResult> {
    const history = (input.conversationHistory ?? [])
      .slice(-4)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const { content, usage } = await this.chat([
      {
        role: "system",
        content: `You classify personal finance questions into intents. Return JSON only:
{"intent":"SAFE_TO_SPEND|CAN_I_AFFORD|EXPLAIN_METRIC|DEBT_PAYMENT|CREDIT_UTILIZATION|OVERDRAFT_RISK|INCOME_DELAY|UPCOMING_BILLS|MONTHLY_REVIEW|ACCOUNT_ROUTING|GENERAL_FINANCIAL_QUESTION|UNKNOWN","confidence":0.0-1.0,"extractedParams":{}}
Extract amount, purchaseName, metricName, debtName, incomeName, horizon, isBusiness when present.`,
      },
      {
        role: "user",
        content: `${history ? `History:\n${history}\n\n` : ""}Question: ${input.question}`,
      },
    ]);

    const parsed = parseIntentJson(content);
    if (parsed) return { ...parsed, usage };
    return {
      intent: "UNKNOWN",
      confidence: 0.3,
      extractedParams: {},
      usage,
    };
  }

  async generateStructuredResponse<T>(
    request: StructuredAIRequest<T>
  ): Promise<{ data: T; usage: TokenUsage }> {
    const { content, usage } = await this.chat([
      { role: "system", content: request.systemPrompt },
      {
        role: "user",
        content: `${request.userPrompt}\n\nRespond with valid JSON matching this schema:\n${request.schema}`,
      },
    ]);

    const data = JSON.parse(content) as T;
    return { data, usage };
  }
}
