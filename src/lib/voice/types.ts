export type VoiceInputState =
  | "IDLE"
  | "REQUESTING_PERMISSION"
  | "LISTENING"
  | "PROCESSING"
  | "READY"
  | "ERROR";

export interface SpeechToTextProvider {
  readonly isSupported: boolean;
  start(options?: {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    onResult?: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
  }): void;
  stop(): void;
  abort(): void;
}

export interface SpeechToTextBlobProvider {
  transcribe(input: Blob): Promise<{
    transcript: string;
    confidence?: number;
  }>;
}
