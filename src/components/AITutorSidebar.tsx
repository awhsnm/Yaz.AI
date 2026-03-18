import { useState, useRef, useEffect } from "react";
import { Send, Brain, Lightbulb, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const getTopicQuickPrompts = () => [
  "How do I start my essay?",
  "Help me structure my argument",
  "How can I improve this paragraph's logic?",
];

const getTopicResponses = (topic: string): Record<string, string> => ({
  "How do I start my essay?": `Great question! Since your essay is about **"${topic}"**, here's how to begin:\n\n1. **A hook** — Start with a surprising fact, bold claim, or thought-provoking question related to ${topic}\n2. **Context** — Give 1-2 sentences of background so the reader understands why ${topic} matters\n3. **Your thesis** — State your main argument clearly\n\nWhat angle or position do you want to take on "${topic}"?`,
  "Help me structure my argument": `For an essay on **"${topic}"**, here's a solid structure:\n\n• **Introduction** — Present your thesis on ${topic}\n• **Body ¶1** — Your strongest argument + specific evidence\n• **Body ¶2** — Supporting argument + examples\n• **Body ¶3** — Counter-argument about ${topic} + your rebuttal\n• **Conclusion** — Restate thesis + broader implications\n\nWhich part are you working on? I can help you think through each section.`,
  "How can I improve this paragraph's logic?": `When writing about **"${topic}"**, check these common logic issues:\n\n1. **Does each sentence connect** to the next? Use transitions (however, therefore, moreover)\n2. **Is your evidence specific** to ${topic}? Replace vague claims with concrete data or examples\n3. **Does the paragraph support your thesis?** Every paragraph should tie back to your main argument about ${topic}\n\nTry reading your paragraph aloud — gaps in logic often become obvious when spoken.`,
});

const getDefaultResponse = (topic: string) =>
  `I can help you think through your essay on **"${topic}"**, but I won't write it for you. Try asking me about:\n\n• How to **start** your essay on ${topic}\n• Ways to **structure** your argument\n• How to **strengthen** a specific paragraph\n• Logic and **flow** between your ideas\n\nWhat are you working on?`;

const AITutorSidebar = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome! I'm your AI writing tutor. 💡\n\nBefore we begin, **what is the topic of your essay?** Knowing your topic will help me guide you much more effectively.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [essayTopic, setEssayTopic] = useState<string | null>(null);
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
      let response: string;

      if (!essayTopic) {
        // First message sets the topic
        setEssayTopic(text.trim());
        response = `Great! Your essay topic is **"${text.trim()}"**. I'll tailor all my guidance to help you write a strong essay on this subject. 🎯\n\nI'll guide your thinking and help you build stronger arguments — but I won't write your essay for you.\n\nHow would you like to start? You can ask me about:\n• How to **begin** your essay\n• How to **structure** your argument\n• How to develop **strong points** for your topic`;
      } else {
        const topicResponses = getTopicResponses(essayTopic);
        response = topicResponses[text.trim()] || getDefaultResponse(essayTopic);
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: response },
      ]);
      setIsTyping(false);
    }, 800);
  };

  const quickPrompts = essayTopic ? getTopicQuickPrompts() : [];

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
        {essayTopic && (
          <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5">
            <BookOpen className="w-3 h-3" />
            <span className="text-xs font-display font-medium truncate max-w-[120px]">{essayTopic}</span>
          </div>
        )}
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

      {/* Quick prompts - only show after topic is set */}
      {quickPrompts.length > 0 && (
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
      )}

      {/* Input */}
      <div className="p-3 border-t border-border flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder={essayTopic ? "Ask for guidance..." : "Enter your essay topic..."}
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
