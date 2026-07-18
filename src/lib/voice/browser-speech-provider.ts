import type { SpeechToTextProvider } from "./types";

type RecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function getSpeechRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export class BrowserSpeechProvider implements SpeechToTextProvider {
  readonly isSupported: boolean;
  private recognition: InstanceType<RecognitionCtor> | null = null;

  constructor() {
    this.isSupported = !!getSpeechRecognitionCtor();
  }

  start(options?: {
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
    onResult?: (transcript: string, isFinal: boolean) => void;
    onError?: (error: string) => void;
    onEnd?: () => void;
  }): void {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      options?.onError?.("Voice input is not supported in this browser");
      return;
    }

    this.recognition = new Ctor();
    this.recognition.continuous = options?.continuous ?? true;
    this.recognition.interimResults = options?.interimResults ?? true;
    this.recognition.lang = options?.lang ?? "en-US";

    let finalTranscript = "";

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      const combined = (finalTranscript + interim).trim();
      const isFinal = event.results[event.results.length - 1]?.isFinal ?? false;
      options?.onResult?.(combined, isFinal);
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        options?.onError?.("Microphone permission denied");
      } else if (event.error === "no-speech") {
        options?.onError?.("No speech detected");
      } else {
        options?.onError?.(event.error);
      }
    };

    this.recognition.onend = () => {
      options?.onEnd?.();
    };

    this.recognition.start();
  }

  stop(): void {
    this.recognition?.stop();
  }

  abort(): void {
    this.recognition?.abort();
    this.recognition = null;
  }
}

export function createBrowserSpeechProvider(): SpeechToTextProvider {
  return new BrowserSpeechProvider();
}
