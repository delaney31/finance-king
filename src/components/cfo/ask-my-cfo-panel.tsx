"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Info,
  Loader2,
  MessageSquarePlus,
  RefreshCw,
  Send,
} from "lucide-react";
import type { CFOAssistantResponse } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { CfoCompactAnswerCard } from "./cfo-compact-answer-card";
import { useAskMyCfo } from "./ask-my-cfo-provider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  response?: CFOAssistantResponse;
  snapshotStale?: boolean;
}

const LOADING_STEPS = [
  "Understanding your question…",
  "Checking your balances…",
  "Reviewing upcoming bills…",
  "Preparing your answer…",
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
  const [showUsageInfo, setShowUsageInfo] = useState(false);
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
          content: data.response.compact?.advice ?? data.response.answer,
          response: data.response,
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

  const lowUsage = usage != null && usage.remainingToday < 10;

  const panelContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-fk-border/60 px-4 py-3 pr-12">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Bot className="h-5 w-5 text-fk-gold" aria-hidden />
            Ask My CFO
          </h2>
          <p className="mt-0.5 text-xs text-fk-muted">Clear answers from your real numbers</p>
          {lowUsage && usage && (
            <p className="mt-1 text-xs text-amber-400">
              {usage.remainingToday} of {usage.dailyLimit} requests left today
            </p>
          )}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUsageInfo((v) => !v)}
            className="rounded-md p-1.5 text-fk-muted hover:bg-fk-charcoal hover:text-fk-foreground"
            aria-label="Usage information"
          >
            <Info className="h-4 w-4" />
          </button>
          {showUsageInfo && usage && (
            <div className="absolute right-0 top-8 z-10 w-48 rounded-lg border border-fk-border bg-fk-navy p-3 text-xs text-fk-muted shadow-lg">
              {usage.remainingToday} of {usage.dailyLimit} AI requests remaining today
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-fk-muted">Ask anything, or try:</p>
            <div className="flex flex-wrap gap-2">
              {suggested.slice(0, 6).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendQuestion(q)}
                  className="rounded-full border border-fk-border/80 px-3 py-1.5 text-left text-xs text-fk-muted transition-colors hover:border-fk-gold/40 hover:text-fk-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, idx) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[88%] rounded-2xl rounded-br-md bg-fk-gold/15 px-3.5 py-2 text-sm">
                  {m.content}
                </div>
              </div>
            );
          }

          const userQuestion =
            [...messages].slice(0, idx).reverse().find((x) => x.role === "user")?.content ?? m.content;

          return m.response?.compact ? (
            <CfoCompactAnswerCard
              key={m.id}
              question={userQuestion}
              response={m.response}
              compact={m.response.compact}
              snapshotStale={m.snapshotStale}
              onRecalculate={() => sendQuestion(userQuestion)}
              onFollowUp={sendQuestion}
            />
          ) : (
            <p key={m.id} className="text-sm">
              {m.content}
            </p>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-fk-muted" aria-busy="true" aria-label="Analyzing your question">
            <Loader2 className="h-4 w-4 animate-spin text-fk-gold" aria-hidden />
            {LOADING_STEPS[loadingStep]}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm">
            {error}
            <Button variant="ghost" size="sm" className="mt-2 h-8" onClick={() => setError(null)}>
              <RefreshCw className="mr-1 h-3 w-3" /> Retry
            </Button>
          </div>
        )}
      </div>

      <div className="border-t border-fk-border/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={newConversation}
            title="New conversation"
            aria-label="New conversation"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Ask about spending, bills, or debt…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendQuestion(question);
              }
            }}
            className="h-9 flex-1 border-fk-border/80 bg-fk-charcoal/50 text-sm"
            disabled={loading}
            aria-label="Ask your CFO a question"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => sendQuestion(question)}
            disabled={loading || !question.trim()}
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {!isMobile && (
        <div
          className={`hidden md:flex md:flex-col md:border-l md:border-fk-border/60 md:bg-fk-navy/90 md:transition-all md:duration-300 ${
            open ? "md:w-[24rem] lg:w-[26rem] md:shrink-0" : "md:w-0 md:overflow-hidden md:border-0"
          }`}
        >
          {open && panelContent}
        </div>
      )}

      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[92vh] p-0">
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
      <Bot className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Ask My CFO</span>
      <span className="sm:hidden">CFO</span>
    </Button>
  );
}
