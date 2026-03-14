import { describe, it, expect } from "vitest";
import { SessionStore } from "./sessionStore";

function createMockMemento() {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
    update: (key: string, value: unknown) => {
      if (value === undefined) store.delete(key);
      else store.set(key, value);
      return Promise.resolve();
    },
    keys: () => [...store.keys()],
    setKeysForSync: () => {},
  };
}

describe("SessionStore", () => {
  it("generates correct key format", () => {
    const key = SessionStore.key("ctx-1", "default", "my-pod");
    expect(key).toBe("kubiq.session.ctx-1/default/my-pod");
  });

  it("replaces spaces in keys", () => {
    const key = SessionStore.key("my context", "name space", "pod name");
    expect(key).not.toContain(" ");
  });

  it("save and get round-trip", () => {
    const store = new SessionStore(createMockMemento() as never);
    const key = SessionStore.key("ctx", "ns", "pod");

    store.save(key, "session-123", [{ role: "user", content: "hello", timestamp: 1 }]);

    const stored = store.get(key);
    expect(stored).toBeDefined();
    expect(stored!.sessionId).toBe("session-123");
    expect(stored!.messages).toHaveLength(1);
    expect(stored!.messages[0].content).toBe("hello");
  });

  it("addMessage appends to existing session", () => {
    const store = new SessionStore(createMockMemento() as never);
    const key = SessionStore.key("ctx", "ns", "pod");

    store.save(key, "sess-1", []);
    store.addMessage(key, { role: "user", content: "question", timestamp: 1 });
    store.addMessage(key, { role: "assistant", content: "answer", timestamp: 2 });

    const stored = store.get(key);
    expect(stored!.messages).toHaveLength(2);
    expect(stored!.messages[1].role).toBe("assistant");
  });

  it("caps messages at 50", () => {
    const store = new SessionStore(createMockMemento() as never);
    const key = SessionStore.key("ctx", "ns", "pod");

    const msgs = Array.from({ length: 60 }, (_, i) => ({
      role: "user" as const,
      content: `msg-${i}`,
      timestamp: i,
    }));

    store.save(key, "sess-1", msgs);
    const stored = store.get(key);
    expect(stored!.messages).toHaveLength(50);
    expect(stored!.messages[0].content).toBe("msg-10");
  });

  it("updateSessionId only changes session ID", () => {
    const store = new SessionStore(createMockMemento() as never);
    const key = SessionStore.key("ctx", "ns", "pod");

    store.save(key, "old-id", [{ role: "user", content: "hi", timestamp: 1 }]);
    store.updateSessionId(key, "new-id");

    const stored = store.get(key);
    expect(stored!.sessionId).toBe("new-id");
    expect(stored!.messages).toHaveLength(1);
  });

  it("clear removes the session", () => {
    const store = new SessionStore(createMockMemento() as never);
    const key = SessionStore.key("ctx", "ns", "pod");

    store.save(key, "sess-1", []);
    store.clear(key);

    expect(store.get(key)).toBeUndefined();
  });
});
