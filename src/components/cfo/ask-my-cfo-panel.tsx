"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquarePlus, RefreshCw, Send } from "lucide-react";
import type { CFOAssistantResponse } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CfoResultCard } from "./cfo-result-card";
import { useAskMyCfo } from "./ask-my-cfo-provider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CFOAssistantResponse;
  intent?: string;
  snapshotStale?: boolean;
}

const LOADING_STEPS = [
  "Classifying your question…",
  "Running financial calculations…",
  "Checking protected reserves…",
  "Building your answer…",
];

export function AskMyCfoPanel() {
  const { open, setOpen } = useAskMyCfo();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [usage, setUsage] = useState<{ remainingToday: number; dailyLimit: number } | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const fetchSuggested = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/cfo/suggested-questions");
      if (res.ok) {
        const data = await res.json();
        setSuggested(data.questions ?? []);
      }
    } catch {
      setSuggested(["How much can I safely spend today?"]);
    }
  }, []);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/cfo/usage");
      if (res.ok) setUsage(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSuggested();
      fetchUsage();
    }
  }, [open, fetchSuggested, fetchUsage]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [loading]);

  const sendQuestion = async (q: string) => {
    if (!q.trim() || loading) return;
    setError(null);
    setLoading(true);
    setLoadingStep(0);

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: q.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");

    try {
      const url = conversationId
        ? `/api/v1/cfo/conversations/${conversationId}/messages`
        : "/api/v1/cfo/conversations";

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim(), conversationId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");

      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId,
          role: "assistant",
          content: data.response.answer,
          response: data.response,
          intent: data.intent,
          snapshotStale: data.snapshotStale,
        },
      ]);
      fetchUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const newConversation = () => {
    setConversationId(undefined);
    setMessages([]);
    setError(null);
  };

  const handleSimulateAmount = (amount: number) => {
    sendQuestion(`Can I afford a $${amount} purchase today?`);
  };

  const panelContent = (
    <div className="flex h-full flex-col">
      <div className="flex flex-col space-y-1.5 border-b border-fk-border p-4 pr-12">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Bot className="h-5 w-5 text-fk-gold" />
          Ask My CFO
        </h2>
        <p className="text-xs text-fk-muted">
          Grounded in your confirmed balances. Finance King calculates; your CFO explains.
        </p>
        {usage && (
          <p className="text-xs text-fk-muted">
            {usage.remainingToday} of {usage.dailyLimit} AI requests remaining today
          </p>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-fk-muted">Try a suggested question:</p>
            <div className="flex flex-wrap gap-2">
              {suggested.slice(0, 8).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-fk-border px-3 py-1.5 text-left text-xs hover:border-fk-gold/50 hover:bg-fk-charcoal"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            {m.role === "user" ? (
              <div className="max-w-[85%] rounded-lg bg-fk-gold/20 px-3 py-2 text-sm">{m.content}</div>
            ) : m.response ? (
              <CfoResultCard
                response={m.response}
                intent={m.intent}
                snapshotStale={m.snapshotStale}
                onRecalculate={() => sendQuestion(m.content)}
                onSimulateAmount={handleSimulateAmount}
              />
            ) : (
              <p className="text-sm">{m.content}</p>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-fk-muted">
            <Loader2 className="h-4 w-4 animate-spin text-fk-gold" />
            {LOADING_STEPS[loadingStep]}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm">
            {error}
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError(null)}>
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-fk-border p-4 space-y-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={newConversation} title="New conversation">
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Ask about safe-to-spend, affordability, debt…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendQuestion(question);
              }
            }}
            rows={2}
            className="flex-1 resize-none"
            disabled={loading}
          />
          <Button
            size="icon"
            onClick={() => sendQuestion(question)}
            disabled={loading || !question.trim()}
            className="shrink-0"
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-fk-muted">
          Educational guidance only — not fiduciary, legal, or tax advice.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop side panel */}
      {!isMobile && (
        <div
          className={`hidden md:flex md:flex-col md:border-l md:border-fk-border md:bg-fk-navy/80 md:transition-all md:duration-300 ${
            open ? "md:w-[28rem] md:shrink-0" : "md:w-0 md:overflow-hidden md:border-0"
          }`}
        >
          {open && panelContent}
        </div>
      )}

      {/* Mobile full-screen sheet */}
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="p-0">
            {panelContent}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}

export function AskMyCfoButton() {
  const { toggle, open } = useAskMyCfo();

  return (
    <Button
      onClick={toggle}
      variant={open ? "default" : "outline"}
      size="sm"
      className="gap-2 border-fk-gold/50 text-fk-gold hover:bg-fk-gold/10"
    >
      <Bot className="h-4 w-4" />
      <span className="hidden sm:inline">Ask My CFO</span>
      <span className="sm:hidden">CFO</span>
    </Button>
  );
}
