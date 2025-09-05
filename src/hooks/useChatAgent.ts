import { useState, useCallback, useEffect } from "react";
import { superleeEngine } from "@/lib/agent/superlee";
import type { Message, Plan, ChatState } from "@/types/agents";

export function useChatAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [status, setStatus] = useState<string>("");
  const [awaitingFile, setAwaitingFile] = useState<boolean>(false);
  const [awaitingInput, setAwaitingInput] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ id: string; title: string; lastMessage: string; timestamp: number; messageCount: number; messages: Message[] }>>([]);

  // Load messages and history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("superleeMessages");
      if (saved) {
        const loadedMessages = JSON.parse(saved);
        setMessages(loadedMessages);
      }
      const savedHistory = localStorage.getItem("superleeHistory");
      if (savedHistory) {
        const loadedHistory = JSON.parse(savedHistory);
        if (Array.isArray(loadedHistory)) setHistory(loadedHistory);
      }
    } catch {
      // Ignore errors, start with empty chat
    }
  }, []);

  // Show greeting automatically when there's no prior chat
  useEffect(() => {
    if (messages.length === 0) {
      showGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("superleeMessages", JSON.stringify(messages));
    } catch {
      // Ignore errors
    }
  }, [messages]);

  // Helper to persist history
  const persistHistory = useCallback((items: typeof history) => {
    try {
      localStorage.setItem("superleeHistory", JSON.stringify(items));
    } catch {}
  }, [history]);

  const showGreeting = useCallback(async () => {
    const greeting = await superleeEngine.getGreeting();
    if (greeting.type === "message") {
      setMessages([{
        role: "agent",
        text: greeting.text,
        ts: Date.now(),
        buttons: greeting.buttons
      }]);
    }
  }, []);

  const addMessage = useCallback((role: Message["role"], text: string, buttons?: string[]) => {
    setMessages((prev) => [...prev, { role, text, ts: Date.now(), buttons }]);
  }, []);

  const addCompleteMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const updateLastMessage = useCallback((updates: Partial<Message>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      updated[updated.length - 1] = { ...updated[updated.length - 1], ...updates };
      return updated;
    });
  }, []);

  const simulateTyping = useCallback((callback: () => Promise<void> | void, delay = 500) => {
    setIsTyping(true);
    setTimeout(async () => {
      try {
        await callback();
      } finally {
        setIsTyping(false);
      }
    }, delay);
  }, []);

  const processPrompt = useCallback((prompt: string, file?: File) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    // Add user message
    addMessage("you", trimmedPrompt);
    setStatus("");
    setAwaitingFile(false);
    setAwaitingInput(null);

    // Simulate typing and then process
    simulateTyping(async () => {
      // Process with Superlee engine
      const response = await superleeEngine.processMessage(trimmedPrompt, file);

      if (response.type === "message") {
        // Only add message if text is not empty (to handle silent responses)
        if (response.text.trim()) {
          // If response has image or links, use addCompleteMessage for full Message object
          if (response.image || response.links) {
            addCompleteMessage({
              role: "agent",
              text: response.text,
              ts: Date.now(),
              buttons: response.buttons,
              image: response.image,
              links: response.links
            });
          } else {
            // Use regular addMessage for text-only responses
            addMessage("agent", response.text, response.buttons);
          }
        }
        setCurrentPlan(null);
        return;
      }

      if (response.type === "awaiting_file") {
        setAwaitingFile(true);
        addMessage("agent", "Unggah berkas untuk melanjutkan.");
        return;
      }

      if (response.type === "awaiting_input") {
        setAwaitingInput(response.prompt);
        addMessage("agent", response.prompt);
        return;
      }

      if (response.type === "plan") {
        // AI has a plan
        setCurrentPlan({
          type: response.intent.kind as "swap" | "register",
          steps: response.plan,
          intent: response.intent,
        });

        // Plan will be shown in PlanBox only, no need for chat message
      }
    });
  }, [addMessage, simulateTyping]);

  const clearPlan = useCallback(() => {
    setCurrentPlan(null);
    setStatus("");
  }, []);

  const updateStatus = useCallback((newStatus: string) => {
    setStatus(newStatus);
    simulateTyping(() => {
      addMessage("agent", `ℹ️ ${newStatus}`);
    }, 400);
  }, [addMessage, simulateTyping]);

  const newChat = useCallback(() => {
    // Snapshot current session into history (if it has any user message)
    try {
      if (messages.length > 0) {
        const userMsgs = messages.filter(m => m.role === "you");
        if (userMsgs.length > 0) {
          const firstUser = userMsgs[0];
          const lastMsg = messages[messages.length - 1];
          const item = {
            id: `sess-${Date.now()}`,
            title: (firstUser.text || "Session").slice(0, 30),
            lastMessage: (lastMsg.text || "").slice(0, 80),
            timestamp: firstUser.ts || Date.now(),
            messageCount: messages.length,
            messages: messages,
          };
          const newHistory = [item, ...history].slice(0, 50);
          setHistory(newHistory);
          persistHistory(newHistory);
        }
      }
    } catch {}

    superleeEngine.reset();
    setMessages([]);
    setCurrentPlan(null);
    setStatus("");
    setAwaitingFile(false);
    setAwaitingInput(null);
    setIsTyping(false);
    try {
      localStorage.setItem("superleeMessages", JSON.stringify([]));
    } catch {}
  }, [messages, history, persistHistory]);

  const getEngineFile = useCallback(() => {
    return superleeEngine.getContext().registerData?.file;
  }, []);

  const openSession = useCallback((id: string) => {
    const sess = history.find(h => h.id === id);
    if (!sess) return;
    superleeEngine.reset();
    setMessages(sess.messages || []);
    setCurrentPlan(null);
    setStatus("");
    setAwaitingFile(false);
    setAwaitingInput(null);
    setIsTyping(false);
    try {
      localStorage.setItem("superleeMessages", JSON.stringify(sess.messages || []));
    } catch {}
  }, [history]);

  return {
    messages,
    currentPlan,
    status,
    awaitingFile,
    awaitingInput,
    isTyping,
    history,
    addMessage,
    addCompleteMessage,
    updateLastMessage,
    processPrompt,
    clearPlan,
    updateStatus,
    newChat,
    openSession,
    getEngineFile,
    engine: superleeEngine,
  };
}
