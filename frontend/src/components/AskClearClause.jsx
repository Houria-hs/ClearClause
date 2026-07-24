import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../config/api";

const suggestions = [
  "What are my biggest risks?",
  "Can I cancel this contract?",
  "Explain this contract simply",
  "Are there hidden fees?",
  "What should I negotiate?",
];

export default function AskClearClause({ documentId, filename, chunks = [], showHeader = true }) {
  const [messages, setMessages] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`ask-clearclause:${documentId}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const requestControllerRef = useRef(null);
  const riskCount = chunks.filter((chunk) => chunk.risk === "High").length;

  useEffect(() => {
    // Do not implicitly return scrollIntoView's browser-specific return value:
    // React treats any returned value as an effect cleanup function.
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      requestControllerRef.current?.abort();
    };
  }, []);

  // Keep a conversation while the owner remains in this browser session. This
  // is deliberately session-scoped: document conversations are not persisted
  // to the server or leaked to another signed-in browser session.
  useEffect(() => {
    try {
      sessionStorage.setItem(`ask-clearclause:${documentId}`, JSON.stringify(messages));
    } catch {
      // Storage can be unavailable in private browsing; chat still works.
    }
  }, [documentId, messages]);

  const sendQuestion = async (value = question) => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setQuestion("");
    setError("");
    setLoading(true);
    const controller = new AbortController();
    requestControllerRef.current = controller;
    try {
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_URL}/api/documents/${documentId}/ask`,
        { question: trimmed },
        { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }
      );
      setMessages((current) => [...current, { role: "assistant", text: data.answer, sources: data.sources || [], notice: data.notice }]);
    } catch (requestError) {
      if (requestError.code !== "ERR_CANCELED") {
        setError(requestError.response?.data?.error || "ClearClause could not answer right now. Please try again.");
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <section className="mt-8 rounded-[2rem] border border-[#D9EAFE] bg-[#F5F9FF] p-5 lg:p-7" aria-label="Ask ClearClause">
      {showHeader && <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0057B8]">Document intelligence</p>
          <h2 className="mt-1 text-xl font-bold text-[#111827]">Ask ClearClause</h2>
          <p className="mt-1 text-sm text-[#5B6472]">Ask about <span className="font-semibold text-[#111827]">{filename}</span>{riskCount ? ` · ${riskCount} high-risk clause${riskCount > 1 ? "s" : ""} found` : ""}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0057B8] text-xl text-white">✦</div>
      </div>}

      {!messages.length && !loading && (
        <div className="mt-6 rounded-2xl border border-white bg-white/80 p-4">
          <p className="text-sm font-medium text-[#374151]">Ask anything about this document. ClearClause will use the uploaded text and its risk analysis—not generic assumptions.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => sendQuestion(suggestion)} className="rounded-full border border-[#C7DDF7] bg-white px-3 py-2 text-xs font-semibold text-[#0057B8] transition hover:border-[#0057B8] hover:bg-blue-50">{suggestion}</button>)}
          </div>
        </div>
      )}

      {messages.length > 0 && <div className="mt-6 max-h-[430px] space-y-4 overflow-y-auto pr-1">
        {messages.map((message, index) => <article key={`${message.role}-${index}`} className={message.role === "user" ? "ml-8 rounded-2xl rounded-tr-md bg-[#0057B8] px-4 py-3 text-sm text-white" : "mr-4 rounded-2xl rounded-tl-md border border-white bg-white px-4 py-3 text-sm leading-relaxed text-[#374151] shadow-sm"}>
          <p className={message.role === "user" ? "mb-1 text-[11px] font-bold uppercase tracking-wider text-blue-100" : "mb-1 text-[11px] font-bold uppercase tracking-wider text-[#0057B8]"}>{message.role === "user" ? "You" : "ClearClause"}</p>
          <p className="whitespace-pre-wrap">{message.text}</p>
          {message.notice && <p className="mt-3 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">{message.notice}</p>}
          {message.sources?.length > 0 && <p className="mt-3 border-t border-blue-50 pt-2 text-xs text-[#6B7280]">Referenced clauses: {message.sources.map((source) => `#${source.clause}`).join(", ")}</p>}
        </article>)}
        {loading && <div className="mr-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#5B6472]"><span className="h-2 w-2 animate-pulse rounded-full bg-[#0057B8]" /><span>Reviewing this document…</span></div>}
        <div ref={endRef} />
      </div>}

      {error && <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      <div className="mt-5 rounded-2xl border border-white bg-white p-2 shadow-sm">
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendQuestion(); } }} placeholder="Ask a question about this document…" rows={2} maxLength={1000} aria-label="Ask a question about this document" className="w-full resize-none bg-transparent px-3 py-2 text-sm text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
        <div className="flex items-center justify-between px-2 pb-1"><span className="text-[11px] text-[#9CA3AF]">Enter to send · Shift + Enter for a new line</span><button type="button" disabled={!question.trim() || loading} onClick={() => sendQuestion()} className="rounded-xl bg-[#0057B8] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#00458f] disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Thinking…" : "Ask"}</button></div>
      </div>
    </section>
  );
}
