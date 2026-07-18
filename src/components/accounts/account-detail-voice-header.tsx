"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VoiceMicrophoneButton } from "@/components/voice/voice-microphone-button";
import type { VoiceAccountContext } from "@/components/voice/voice-financial-provider";

export function AccountDetailVoiceHeader({
  account,
}: {
  account: VoiceAccountContext;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Link href="/accounts" className="text-fk-muted hover:text-fk-foreground" aria-label="Back to accounts">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{account.nickname}</h1>
      </div>
      <VoiceMicrophoneButton
        label="Tell Finance King what changed"
        account={account}
      />
    </div>
  );
}
