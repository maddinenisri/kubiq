import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

// ── NDJSON wire types ──────────────────────────────────────────────────────────

interface StreamEventLine {
  type: "stream_event";
  event: {
    type: string;           // content_block_delta | message_stop | message_start | ...
    index?: number;
    delta?: { type: string; text?: string };
  };
}

interface SystemInitLine {
  type: "system";
  subtype: "init";
  session_id: string;
}

interface AssistantLine {
  type: "assistant";
  message: {
    role: "assistant";
    content: Array<{ type: "text"; text: string }>;
  };
}

interface ResultLine {
  type: "result";
  subtype: "success" | "error";
  error?: string;
}

type NdjsonLine = StreamEventLine | SystemInitLine | AssistantLine | ResultLine | { type: string };

// ── Public API ─────────────────────────────────────────────────────────────────

export interface SessionEvents {
  text_delta: (text: string) => void;
  turn_complete: (fullText: string) => void;
  session_init: (sessionId: string) => void;
  error: (message: string) => void;
}

export declare interface ClaudeSession {
  on<K extends keyof SessionEvents>(event: K, listener: SessionEvents[K]): this;
  emit<K extends keyof SessionEvents>(event: K, ...args: Parameters<SessionEvents[K]>): boolean;
}

/**
 * Wraps a persistent `claude --print --input-format stream-json --output-format stream-json`
 * process for a single pod panel.
 *
 * Lifecycle:
 *   new ClaudeSession()  → start()  → send() / send() / ...  → dispose()
 *
 * On send(), a user message NDJSON line is written to stdin.
 * Stdout is parsed line-by-line; text_delta events stream tokens in real-time.
 * turn_complete fires when the full assistant turn is done.
 */
export class ClaudeSession extends EventEmitter {
  private process: ChildProcess | null = null;
  private lineBuffer = "";
  private currentTurnText = "";
  private _sessionId: string | null = null;
  private _disposed = false;

  get sessionId(): string | null {
    return this._sessionId;
  }

  /**
   * Spawn the claude process.
   * @param resumeSessionId  If provided, passes --resume <id> to continue a previous conversation.
   */
  start(resumeSessionId?: string): void {
    if (this._disposed) throw new Error("Session already disposed");

    const args = [
      "--print",
      "--output-format", "stream-json",
      "--input-format",  "stream-json",
      "--verbose",
      "--include-partial-messages",
    ];

    if (resumeSessionId) {
      args.push("--resume", resumeSessionId);
    }

    this.process = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      env:   process.env,
    });

    // ── stdout: parse NDJSON line-by-line ──────────────────────────────────────
    this.process.stdout!.on("data", (chunk: Buffer) => {
      this.lineBuffer += chunk.toString("utf8");
      const lines = this.lineBuffer.split("\n");
      // Last element may be incomplete — keep it in the buffer
      this.lineBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) this.parseLine(trimmed);
      }
    });

    // ── stderr: surface meaningful errors ─────────────────────────────────────
    let stderrBuf = "";
    this.process.stderr!.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
    });

    this.process.on("close", (code) => {
      if (this._disposed) return;
      if (code !== 0) {
        this.emit("error",
          `Claude Code process exited with code ${code}.\n` +
          (stderrBuf.trim() ? `stderr: ${stderrBuf.trim()}` : "") +
          "\n\nRun `claude` in your terminal to verify authentication."
        );
      }
    });

    this.process.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        this.emit("error",
          "Claude Code CLI not found.\n\n" +
          "Install: npm install -g @anthropic-ai/claude-code\n" +
          "Auth:    claude"
        );
      } else {
        this.emit("error", err.message);
      }
    });
  }

  /**
   * Send a user message to the running claude process via stdin.
   * The message is written as a single NDJSON line.
   */
  send(text: string): void {
    if (!this.process?.stdin) {
      this.emit("error", "Session not started or already disposed");
      return;
    }
    this.currentTurnText = "";

    const line = JSON.stringify({
      type:    "user",
      message: { role: "user", content: text },
    });

    this.process.stdin.write(line + "\n", "utf8");
  }

  /** Terminate the child process cleanly */
  dispose(): void {
    this._disposed = true;
    try {
      this.process?.stdin?.end();
      this.process?.kill();
    } catch { /* ignore */ }
    this.process = null;
    this.removeAllListeners();
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  private parseLine(raw: string): void {
    let obj: NdjsonLine;
    try {
      obj = JSON.parse(raw);
    } catch {
      return; // skip non-JSON lines (e.g. empty keep-alives)
    }

    switch (obj.type) {
      // Session ID arrives on the very first line
      case "system": {
        const sys = obj as SystemInitLine;
        if (sys.subtype === "init" && sys.session_id) {
          this._sessionId = sys.session_id;
          this.emit("session_init", sys.session_id);
        }
        break;
      }

      // Streaming token deltas
      case "stream_event": {
        const se = obj as StreamEventLine;
        if (
          se.event.type === "content_block_delta" &&
          se.event.delta?.type === "text_delta" &&
          se.event.delta.text
        ) {
          this.currentTurnText += se.event.delta.text;
          this.emit("text_delta", se.event.delta.text);
        }
        break;
      }

      // Full assistant message — turn is done
      case "assistant": {
        const a = obj as AssistantLine;
        const fullText = a.message.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");
        // Use the accumulated delta text if available (more accurate for streaming),
        // fall back to the complete message object
        this.emit("turn_complete", this.currentTurnText || fullText);
        this.currentTurnText = "";
        break;
      }

      // Result signals the very end of a turn (after assistant message)
      case "result": {
        const r = obj as ResultLine;
        if (r.subtype === "error" && r.error) {
          this.emit("error", r.error);
        }
        break;
      }
    }
  }
}
