"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "fk-voice-coach-dismissed";

export function VoiceCoachMark() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-lg border border-fk-gold/40 bg-fk-gold/10 p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-fk-gold">Speak to update any account</p>
          <p className="mt-1 text-fk-muted">
            Tap the microphone and speak naturally: &ldquo;I paid $500 to State Farm from this
            account.&rdquo; Finance King will show a preview before updating anything.
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          aria-label="Dismiss voice tip"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            setVisible(false);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
