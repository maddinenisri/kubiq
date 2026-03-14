import { useState, useRef, useEffect, useCallback } from "react";
import { Markdown } from "../common";
import { postMessage } from "../../lib/vscode";
import { useExtensionState } from "../../context/ExtensionStateContext";

export function ChatTab() {
  const { state, dispatch } = useExtensionState();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(scrollToBottom, [state.chatMessages, state.streamText, scrollToBottom]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || state.streaming) return;
    // Add user message to local state immediately for instant UI feedback
    dispatch({
      type: "EXT_MESSAGE",
      message: {
        type: "chat_history",
        messages: [...state.chatMessages, { role: "user", content: text, timestamp: Date.now() }],
      },
    });
    postMessage({ type: "user_message", text });
    setInput("");
  }, [input, state.streaming, state.chatMessages, dispatch]);

  const handleNewChat = useCallback(() => {
    postMessage({ type: "new_chat" });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-end px-2.5 py-1 bg-bg2 border-b border-border shrink-0">
        <button
          onClick={handleNewChat}
          className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] bg-bg3 border border-border2 text-dim hover:text-accent hover:border-accent/30 cursor-pointer transition-colors"
        >
          + New Chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {state.chatMessages.length === 0 && !state.streaming && (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-dim text-sm">
            <div className="text-2xl text-accent/40">⬡</div>
            <span>AI diagnosis will appear here</span>
          </div>
        )}
        {state.chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[82%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed whitespace-pre-wrap break-words
                ${msg.role === "user"
                  ? "bg-[#1a2a45] border border-[#2a3a60] text-[#d0d8f0] rounded-br-sm"
                  : "bg-[#1a1e28] border border-[#2e3448] text-[#c8cfe0] rounded-tl-sm"
                }`}
            >
              <div style={{ color: msg.role === "user" ? "#d0d8f0" : "#c8cfe0" }}>
                {msg.content || <em style={{ color: "#5a6380" }}>Empty response</em>}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming */}
        {state.streaming && state.streamText && (
          <div className="flex justify-start">
            <div className="max-w-[82%] px-3.5 py-2.5 rounded-lg text-sm leading-relaxed bg-bg3 border border-border2 rounded-tl-sm whitespace-pre-wrap break-words">
              {state.streamText}
              <span className="text-accent animate-pulse font-light">▌</span>
            </div>
          </div>
        )}

        {/* Thinking */}
        {state.streaming && !state.streamText && (
          <div className="flex justify-start">
            <div className="px-3.5 py-2.5 rounded-lg bg-bg3 border border-border2 rounded-tl-sm flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "0ms" }} />
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-bg2 border-t border-accent/10 shrink-0">
        <div className="flex gap-2 px-3.5 py-3 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={state.streaming}
            placeholder="Ask about this pod…"
            rows={1}
            className="flex-1 bg-bg3 border border-border2 text-text rounded-lg px-3 py-2.5 font-ui text-sm resize-none outline-none leading-relaxed max-h-[120px] transition-all focus:border-accent focus:shadow-[0_0_0_2px_rgba(74,240,200,0.1)] disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={state.streaming || !input.trim()}
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 cursor-pointer transition-all self-end disabled:opacity-30 disabled:cursor-not-allowed bg-gradient-to-br from-accent to-accent/60 hover:shadow-[0_4px_12px_rgba(74,240,200,0.25)] active:scale-95"
          >
            {state.streaming ? (
              <div className="w-4 h-4 rounded-full border-2 border-bg/30 border-t-bg animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#0d0f14">
                <path d="M1.5 1l13 7-13 7V9.5l9-1.5-9-1.5V1z" />
              </svg>
            )}
          </button>
        </div>
        <div className="flex justify-end px-3.5 pb-1.5 gap-1.5 text-[10px] text-text/25">
          <span>
            <kbd className="px-1 py-0.5 rounded border border-accent/10 text-accent/40 font-mono text-[9px] bg-accent/5">
              Enter
            </kbd>{" "}
            send
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-accent/10 text-accent/40 font-mono text-[9px] bg-accent/5">
              Shift+Enter
            </kbd>{" "}
            newline
          </span>
        </div>
      </div>
    </div>
  );
}
