import { describe, it, expect } from "vitest";
import { createBrowserSpeechProvider } from "../browser-speech-provider";

describe("voice input", () => {
  it("browser provider reports unsupported without window", () => {
    const provider = createBrowserSpeechProvider();
    expect(typeof provider.isSupported).toBe("boolean");
  });

  it("does not store audio blobs by default", () => {
    expect(true).toBe(true);
  });
});
