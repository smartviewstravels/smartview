"use client";

import { useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const EXAMPLE_QUESTIONS = [
  "Total pending kitni hai?",
  "Aaj kitni payment receive hui?",
  "Total expenses kitne hain?",
  "Current profit kitna hai?",
];

export default function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || sending) return;
    setError("");
    setInput("");
    setSending(true);
    const next: ChatMessage[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error("The chatbot did not answer. Please try again.");
      const data = (await res.json()) as { answer?: string };
      setMessages([
        ...next,
        {
          role: "assistant",
          text: data.answer ?? "No answer received.",
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }

  return (
    <div>
      <div className="chat-list" ref={listRef} aria-live="polite">
        {messages.length === 0 ? (
          <p className="note">
            Ask a question about your records — for example, total pending,
            today&apos;s payments, expenses or profit.
          </p>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`chat-msg ${m.role}`}>
              <div className="who">{m.role === "user" ? "You" : "Chatbot"}</div>
              <div>{m.text}</div>
            </div>
          ))
        )}
        {sending && (
          <div className="chat-msg assistant">
            <div className="who">Chatbot</div>
            <div className="note">Thinking...</div>
          </div>
        )}
      </div>

      <div className="chip-row">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="chip"
            onClick={() => void ask(q)}
            disabled={sending}
          >
            {q}
          </button>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          aria-label="Your question"
          disabled={sending}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={sending || !input.trim()}
          style={{ flexShrink: 0 }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
