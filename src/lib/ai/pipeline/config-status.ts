export type AIConfigStatus = {
  providerConfigured: boolean;
  modelConfigured: boolean;
  databaseConfigured: boolean;
  authConfigured: boolean;
  openaiKeyPresent: boolean;
};

export function getAIConfigStatus(): AIConfigStatus {
  return {
    providerConfigured: Boolean(process.env.AI_PROVIDER),
    modelConfigured: Boolean(process.env.AI_MODEL ?? process.env.OPENAI_MODEL),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    authConfigured: Boolean(
      process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
    ),
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
  };
}

export function validateAIConfigAtStartup(): void {
  const status = getAIConfigStatus();
  const missing: string[] = [];

  if (!status.databaseConfigured) missing.push("DATABASE_URL");
  if (!status.authConfigured) missing.push("AUTH_SECRET");

  if (process.env.NODE_ENV === "development" && missing.length > 0) {
    console.warn(
      `[CFO] Missing required env vars: ${missing.join(", ")}`
    );
  }

  if (!status.openaiKeyPresent && process.env.AI_PROVIDER === "openai") {
    console.warn(
      "[CFO] AI_PROVIDER=openai but OPENAI_API_KEY is not set — deterministic fallback only"
    );
  }
}
