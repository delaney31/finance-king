"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/utils/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VoiceMicrophoneButton } from "@/components/voice/voice-microphone-button";
import type { VoiceAccountContext } from "@/components/voice/voice-financial-provider";

export type AccountCardData = {
  id: string;
  nickname: string;
  institution: string;
  accountType: string;
  routingTag: string;
  currentBalance: number;
  protectedBalance: number;
  minimumTargetBalance: number;
  accountLastFour?: string | null;
};

function toVoiceContext(a: AccountCardData): VoiceAccountContext {
  return {
    accountId: a.id,
    nickname: a.nickname,
    institution: a.institution,
    accountType: a.accountType,
    accountLastFour: a.accountLastFour,
    currentBalance: a.currentBalance,
  };
}

export function AccountsGrid({ accounts }: { accounts: AccountCardData[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {accounts.map((a) => (
        <Card key={a.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/accounts/${a.id}`} className="hover:text-fk-gold">
                <CardTitle className="text-base">{a.nickname}</CardTitle>
              </Link>
              <Badge variant="outline">{a.routingTag}</Badge>
            </div>
            <p className="text-sm text-fk-muted">
              {a.institution} · {a.accountType}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="font-mono-amount text-2xl font-semibold">
              {formatMoney(a.currentBalance)}
            </p>
            {a.protectedBalance > 0 && (
              <p className="text-xs text-fk-gold">Protected: {formatMoney(a.protectedBalance)}</p>
            )}
            {a.minimumTargetBalance > 0 && (
              <p className="text-xs text-fk-muted">Floor: {formatMoney(a.minimumTargetBalance)}</p>
            )}
            <VoiceMicrophoneButton
              label="Update by voice"
              account={toVoiceContext(a)}
              className="w-full justify-center"
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}