export const DEMO_SUGGESTED_QUESTIONS = [
  "Can I afford dinner tonight?",
  "Can I take my daughter to Disneyland?",
  "Can Pacific Luxe spend $500 on advertising?",
  "Can I afford Monterey Car Week?",
  "Can I afford the LaGrange road trip?",
  "Can I afford the Carrera S wrap?",
  "How much should I pay toward Amex?",
  "Why is my safe-to-spend amount low?",
  "What happens if my contract payment is delayed?",
  "Which account should pay the NY mortgage?",
  "What should my account balances be on August 1?",
  "What is my expected year-end buffer with and without the ESOP?",
  "How much can I safely spend today?",
  "Am I at risk of an overdraft?",
  "What is the smartest financial action I should take today?",
];

export const GENERAL_SUGGESTED_QUESTIONS = [
  "How much can I safely spend today?",
  "Can I afford this purchase?",
  "Why is my safe-to-spend amount low?",
  "Am I at risk of an overdraft?",
  "How much should I pay toward my credit card?",
  "What is the smartest financial action I should take today?",
];

export function getSuggestedQuestions(isDemoAccount: boolean): string[] {
  return isDemoAccount ? DEMO_SUGGESTED_QUESTIONS : GENERAL_SUGGESTED_QUESTIONS;
}
