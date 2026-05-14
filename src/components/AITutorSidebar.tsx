import { useState, useRef, useEffect } from "react";
import { Send, Brain, Lightbulb, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AITutorSidebarProps {
  essayId: string;
  topic: string;
  subject: string;
  currentDraft: string;
  restoredChatHistory?: Message[];
  onChatHistoryChange?: (history: Message[]) => void;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor`;

const quickPrompts = [
  "How do I start my essay?",
  "Help me structure my argument",
  "How can I improve my last paragraph?",
];

const AITutorSidebar = ({ essayId, topic, subject, currentDraft, restoredChatHistory, onChatHistoryChange }: AITutorSidebarProps) => {
  const welcomeMsg: Message = {
    id: "welcome",
    role: "assistant",
    content: `Welcome! I'm your AI writing tutor. 💡\n\nYour essay topic: **"${topic}"**${subject ? ` (${subject})` : ""}\n\nI'll guide your thinking and help you build stronger arguments — but I won't write your essay for you.\n\nHow would you like to start? You can ask me about:\n• How to **begin** your essay\n• How to **structure** your argument\n• How to **strengthen** a specific paragraph`,
  };

  const [messages, setMessages] = useState<Message[]>(
    restoredChatHistory && restoredChatHistory.length > 0 ? restoredChatHistory : [welcomeMsg]
  );
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    onChatHistoryChange?.(messages);
  }, [messages, onChatHistoryChange]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    if (!essayId) {
      toast({ title: "No active essay", description: "AI tutor requires an active essay.", variant: "destructive" });
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Persist user message
    supabase.from("messages").insert({ essay_id: essayId, content: userMsg.content, sender: "user" }).then(() => {});

    // Build conversation history (exclude welcome message)
    const history = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: history, topic, subject, currentDraft }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      if (!resp.body) throw new Error("No response stream");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.id === "streaming") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { id: "streaming", role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Finalize streaming message with stable id
      setMessages((prev) =>
        prev.map((m) =>
          m.id === "streaming" ? { ...m, id: Date.now().toString() } : m
        )
      );

      // Persist assistant message
      if (assistantContent) {
        supabase.from("messages").insert({ essay_id: essayId, content: assistantContent, sender: "ai" }).then(() => {});
      }
    } catch (e) {
      console.error("AI tutor error:", e);
      const errorMsg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "AI Tutor Error", description: errorMsg, variant: "destructive" });
      if (!assistantContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: "I'm having trouble connecting right now. Please try again in a moment.",
          },
        ]);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="font-display font-semibold text-sm text-foreground">AI Tutor</h2>
          <p className="text-xs text-muted-foreground">Guides, never writes</p>
        </div>
        <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
          <BookOpen className="w-3 h-3" />
          <span className="text-xs font-display font-medium truncate max-w-[120px]">{topic}</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-message-enter ${msg.role === "assistant" ? "" : "flex justify-end"}`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm font-display max-w-[90%] ${
                msg.role === "assistant"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span className="whitespace-pre-wrap">{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="ai-message-enter">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => sendMessage(prompt)}
            disabled={isStreaming}
            className="text-xs bg-muted hover:bg-accent text-muted-foreground px-2.5 py-1 rounded-full font-display transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            <Lightbulb className="w-3 h-3" />
            {prompt}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder="Ask for guidance..."
          className="font-display text-sm"
          disabled={isStreaming}
        />
        <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || isStreaming}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AITutorSidebar;
