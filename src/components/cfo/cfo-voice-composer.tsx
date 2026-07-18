"use client";

import { Mic, MicOff, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useVoiceInput } from "@/lib/voice/use-voice-input";

export function CfoVoiceComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled,
  loading,
  inputAriaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  disabled?: boolean;
  loading?: boolean;
  inputAriaLabel: string;
}) {
  const voice = useVoiceInput();
  const displayValue =
    voice.isListening || voice.state === "READY" ? voice.transcript || value : value;

  const handleUseTranscript = () => {
    if (voice.transcript.trim()) {
      onChange(voice.transcript.trim());
    }
    voice.reset();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {voice.isSupported && (
          <Button
            type="button"
            variant={voice.isListening ? "default" : "outline"}
            size="icon"
            className={`h-10 w-10 shrink-0 ${
              voice.isListening
                ? "animate-pulse border-red-500/50 bg-red-500/20 text-red-400"
                : ""
            }`}
            onClick={voice.toggleListening}
            disabled={disabled || loading}
            aria-label={voice.isListening ? "Stop listening" : "Start voice input"}
            title={voice.isListening ? "Tap to stop" : "Tap to speak"}
          >
            {voice.isListening ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}

        <Input
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            onChange(e.target.value);
            if (voice.state === "READY") voice.setTranscript(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="h-10 flex-1 border-fk-border/80 bg-fk-charcoal/50 text-sm"
          disabled={disabled || voice.isListening}
          aria-label={inputAriaLabel}
        />
      </div>

      {(voice.isListening || voice.state === "READY" || voice.error) && (
        <div className="rounded-lg border border-fk-border/60 bg-fk-charcoal/40 px-3 py-2 text-xs">
          {voice.isListening && (
            <p className="flex items-center gap-2 text-fk-gold">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {voice.stateLabel} — Tap mic to stop
            </p>
          )}
          {voice.state === "PROCESSING" && (
            <p className="text-fk-muted">{voice.stateLabel}</p>
          )}
          {voice.state === "READY" && voice.transcript && (
            <div className="space-y-2">
              <p className="text-fk-muted">
                Transcript ready — edit if needed, then use or send.
              </p>
              <p className="text-sm text-fk-foreground">{voice.transcript}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="h-7 text-xs" onClick={handleUseTranscript}>
                  Use transcript
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={voice.startListening}
                >
                  <RotateCcw className="mr-1 h-3 w-3" /> Record again
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={voice.cancel}>
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
              </div>
            </div>
          )}
          {voice.error && <p className="text-amber-400">{voice.error}</p>}
        </div>
      )}
    </div>
  );
}
