"use client";

import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { VoiceMicrophoneButton } from "@/components/voice/voice-microphone-button";

type CreditCardItem = {
  id: string;
  issuer: string;
  accountId: string;
  currentBalance: number;
  creditLimit: number;
  minimumPayment: number;
  paymentDueDay: number | null;
};

export function CreditCardsGrid({ cards }: { cards: CreditCardItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cards.map((c) => {
        const util = c.creditLimit > 0 ? c.currentBalance / c.creditLimit : 0;
        return (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-base">{c.issuer}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-mono-amount text-xl">{formatMoney(c.currentBalance)}</p>
              <p className="text-sm text-fk-muted">Limit: {formatMoney(c.creditLimit)}</p>
              <Progress value={util * 100} className="mt-2" />
              <p className="text-xs text-fk-muted">
                Min payment: {formatMoney(c.minimumPayment)}
                {c.paymentDueDay ? ` · Due day ${c.paymentDueDay}` : ""}
              </p>
              <VoiceMicrophoneButton
                label="Record activity by voice"
                account={{
                  accountId: c.accountId,
                  nickname: c.issuer,
                  institution: c.issuer,
                  accountType: "CREDIT_CARD",
                  currentBalance: c.currentBalance,
                }}
                className="w-full justify-center"
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
