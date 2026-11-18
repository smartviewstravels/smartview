import { requireAdmin } from "@/lib/auth";
import ChatBox from "@/components/ChatBox";


export default async function ChatPage() {
  await requireAdmin();

  return (
    <div>
      <h1>AI Chatbot</h1>
      <p className="note" style={{ marginBottom: 16 }}>
        The chatbot is read-only. It answers from your live records and cannot
        change anything.
      </p>
      <ChatBox />
    </div>
  );
}
