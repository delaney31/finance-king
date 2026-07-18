"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceFinancial, type VoiceAccountContext } from "./voice-financial-provider";

type VoiceMicrophoneButtonProps = {
  label: string;
  account?: VoiceAccountContext;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  className?: string;
};

export function VoiceMicrophoneButton({
  label,
  account,
  variant = "outline",
  size = "sm",
  className,
}: VoiceMicrophoneButtonProps) {
  const { openVoiceSheet } = useVoiceFinancial();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => openVoiceSheet(account)}
      aria-label={label}
    >
      <Mic className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="text-xs sm:text-sm">{label}</span>
    </Button>
  );
}
