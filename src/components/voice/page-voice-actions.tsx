"use client";

import { VoiceMicrophoneButton } from "@/components/voice/voice-microphone-button";

export function PageVoiceActions({ label = "Record activity by voice" }: { label?: string }) {
  return (
    <VoiceMicrophoneButton label={label} variant="outline" className="shrink-0" />
  );
}
