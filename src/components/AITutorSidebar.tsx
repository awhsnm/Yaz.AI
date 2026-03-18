import { useState, useRef, useEffect } from "react";
import { Send, Brain, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const quickPrompts = [
  "How do I start my essay?",
  "Help me structure my argument",
  "How can I improve this paragraph's logic?",
];

const tutorResponses: Record<string, string> = {
  "How do I start my essay?":
    "A strong essay opening typically has 3 elements:\n\n1. **A hook** — a surprising fact, question, or bold statement related to your topic\n2. **Context** — 1-2 sentences that introduce the broader subject\n3. **Your thesis** — a clear statement of your main argument\n\nTry writing your thesis first, then build the hook around it. What's your main argument?",
  "Help me structure my argument":
    "Here's a proven structure for academic essays:\n\n• **Introduction** — Present your thesis\n• **Body ¶1** — Strongest argument + evidence\n• **Body ¶2** — Supporting argument + evidence\n• **Body ¶3** — Counter-argument + your rebuttal\n• **Conclusion** — Restate thesis + broader implications\n\nWhich section are you working on right now?",
  "How can I improve this paragraph's logic?":
    "Check these common logic issues:\n\n1. **Does each sentence connect** to the next? Use transition words (however, therefore, moreover)\n2. **Is your evidence specific?** Replace vague claims with data or examples\n3. **Does the paragraph support your thesis?** If not, it may belong elsewhere\n\nTry reading your paragraph aloud — gaps in logic often become obvious when spoken.",
};

const defaultResponse =
  "I can help you think through your writing, but I won't write it for you. Try asking me about:\n\n• How to **structure** your essay\n• Ways to **strengthen** an argument\n• How to **begin** or **conclude** a section\n• Logic and **flow** between paragraphs\n\nWhat are you working on?";

const AITutorSidebar = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome! I'm your AI writing tutor. I'll guide your thinking and help you build stronger arguments — but I won't write your essay for you. 💡\n\nWhat would you like help with?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = tutorResponses[text.trim()] || defaultResponse;
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: response },
      ]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-display font-semibold text-sm text-foreground">AI Tutor</h2>
          <p className="text-xs text-muted-foreground">Guides, never writes</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ai-message-enter ${
              msg.role === "assistant" ? "" : "flex justify-end"
            }`}
          >
            <div
              className={`rounded-lg px-3 py-2 text-sm font-display max-w-[90%] whitespace-pre-wrap ${
                msg.role === "assistant"
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
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
            className="text-xs bg-muted hover:bg-accent text-muted-foreground px-2.5 py-1 rounded-full font-display transition-colors flex items-center gap-1"
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
        />
        <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default AITutorSidebar;
