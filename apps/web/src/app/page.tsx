"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Video = {
  id: string;
  title?: string | null;
  status: string;
  durationSeconds?: number | null;
};

type User = {
  id: string;
  email: string;
  name: string;
};

type Session = {
  id: string;
  title?: string | null;
  updatedAt: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type PersistedMessage = {
  role: "user" | "assistant";
  content: string;
};

type Source = {
  chunkIndex: number;
  startSeconds: number;
  endSeconds: number;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function Home() {
  const [video, setVideo] = useState<Video | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [uploading, setUploading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    const storedToken = window.localStorage.getItem("video-assistant-token");
    if (!storedToken) {
      queueMicrotask(() => setAuthLoading(false));
      return;
    }

    void fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Session expired");
        const result = (await response.json()) as { user: User };
        setAuthToken(storedToken);
        setUser(result.user);
      })
      .catch(() => window.localStorage.removeItem("video-assistant-token"))
      .finally(() => setAuthLoading(false));
  }, []);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authMode === "register"
            ? { name: authName, email: authEmail, password: authPassword }
            : { email: authEmail, password: authPassword },
        ),
      });

      const result = (await response.json()) as { token?: string; user?: User; error?: string };
      if (!response.ok || !result.token || !result.user) {
        throw new Error(result.error ?? "Authentication failed");
      }

      window.localStorage.setItem("video-assistant-token", result.token);
      setAuthToken(result.token);
      setUser(result.user);
      setAuthPassword("");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    if (authToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
    }
    window.localStorage.removeItem("video-assistant-token");
    setAuthToken(null);
    setUser(null);
    setVideo(null);
    setMessages([]);
  }

  function authHeaders(): Record<string, string> {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setVideo(null);
    setSessions([]);
    setActiveSessionId(null);
    setMessages([]);

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/videos`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed. Check the API and try again.");
      }

      const uploadedVideo = (await response.json()) as Video;
      setVideo(uploadedVideo);
      await loadSessions(uploadedVideo.id);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function loadSessions(videoId: string) {
    const response = await fetch(`${API_URL}/videos/${videoId}/chat/sessions`, {
      headers: authHeaders(),
    });
    if (!response.ok) return;

    const nextSessions = (await response.json()) as Session[];
    setSessions(nextSessions);
    if (nextSessions[0]) await selectSession(videoId, nextSessions[0].id);
  }

  async function selectSession(videoId: string, sessionId: string) {
    setActiveSessionId(sessionId);
    setMessages([]);
    setError(null);

    const response = await fetch(
      `${API_URL}/videos/${videoId}/chat/sessions/${sessionId}/messages`,
      { headers: authHeaders() },
    );

    if (!response.ok) {
      setError("Could not load this conversation.");
      return;
    }

    const persistedMessages = (await response.json()) as PersistedMessage[];
    setMessages(
      persistedMessages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    );
  }

  async function createSession() {
    if (!video) return;

    setError(null);
    const response = await fetch(`${API_URL}/videos/${video.id}/chat/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ title: "New conversation" }),
    });

    if (!response.ok) {
      setError("Could not create a new conversation.");
      return;
    }

    const session = (await response.json()) as Session;
    setSessions((current) => [session, ...current]);
    setActiveSessionId(session.id);
    setMessages([]);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video || !activeSessionId || !question.trim() || streaming) return;

    const text = question.trim();
    setQuestion("");
    setError(null);
    setStreaming(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch(
        `${API_URL}/videos/${video.id}/chat/sessions/${activeSessionId}/messages/stream`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ question: text }),
        },
      );

      if (!response.ok || !response.body) {
        throw new Error("The chat service could not be reached.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const payload = JSON.parse(dataLine.slice(6)) as {
            type?: string;
            token?: string;
            answer?: string;
            sources?: Source[];
            error?: string;
          };

          if (payload.type === "token" && payload.token) {
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + payload.token };
              }
              return next;
            });
          }

          if (payload.type === "complete") {
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = {
                  ...last,
                  content: payload.answer ?? last.content,
                  sources: payload.sources,
                };
              }
              return next;
            });
          }

          if (payload.type === "error") throw new Error(payload.error ?? "Chat failed");
        }

        if (done) break;
      }
    } catch (chatError) {
      setMessages((current) => current.slice(0, -1));
      setError(chatError instanceof Error ? chatError.message : "Chat failed");
    } finally {
      setStreaming(false);
    }
  }

  function seekTo(seconds: number) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = seconds;
    void videoRef.current.play();
  }

  const activeSession = sessions.find((session) => session.id === activeSessionId);

  if (authLoading) return <main className="app-shell"><div className="loading-state">Opening your workspace...</div></main>;

  if (!user || !authToken) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-panel">
          <div className="brand-lockup"><span className="brand-mark">VA</span><div><p className="eyebrow">Private video intelligence</p><h1>Video Assistant</h1></div></div>
          <div className="auth-copy"><p className="eyebrow">Welcome back</p><h2>{authMode === "login" ? "Your videos, ready for questions." : "Make your videos searchable."}</h2><p>Sign in to keep your video library and conversations attached to your account.</p></div>
          <form className="auth-form" onSubmit={submitAuth}>
            {authMode === "register" && <label>Name<input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Your name" required /></label>}
            <label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" required /></label>
            <label>Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>
            <button className="auth-submit" type="submit">{authMode === "login" ? "Sign in" : "Create account"}<span>↗</span></button>
          </form>
          {error && <p className="error-message">{error}</p>}
          <button className="auth-switch" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(null); }}>{authMode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark">VA</span>
          <div>
            <p className="eyebrow">Video intelligence</p>
            <h1>Video Assistant</h1>
          </div>
        </div>
        <div className="topbar-actions"><div className="topbar-status"><span className="status-dot" />{user.name}</div><button className="sign-out" onClick={signOut}>Sign out</button></div>
      </header>

      {!video ? (
        <section className="welcome-panel">
          <div className="welcome-copy">
            <p className="eyebrow">Your private video desk</p>
            <h2>Turn a long video into a conversation.</h2>
            <p>Upload a recording to search its transcript, jump to exact moments, and ask follow-up questions with context.</p>
          </div>
          <button className="upload-dropzone" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <span className="upload-icon">↑</span>
            <strong>{uploading ? "Processing video..." : "Choose a video"}</strong>
            <span>{uploading ? "Audio, transcript, and embeddings are being prepared" : "MP4, MOV, MKV, WEBM, or AVI"}</span>
            <input ref={fileInputRef} type="file" accept="video/*,.mkv" onChange={handleUpload} hidden />
          </button>
          {error && <p className="error-message">{error}</p>}
        </section>
      ) : (
        <section className="workspace-grid">
          <aside className="sidebar">
            <div className="sidebar-heading">
              <div><p className="eyebrow">Library</p><h2>Conversations</h2></div>
              <button className="icon-button" onClick={createSession} aria-label="Create new conversation">+</button>
            </div>
            <div className="video-summary">
              <span className="video-badge">VIDEO</span>
              <strong>{video.title ?? "Untitled video"}</strong>
              <span className={`processing-label ${video.status}`}>{video.status}</span>
            </div>
            <div className="session-list">
              {sessions.map((session, index) => (
                <button key={session.id} className={`session-item ${session.id === activeSessionId ? "active" : ""}`} onClick={() => void selectSession(video.id, session.id)}>
                  <span className="session-number">{String(index + 1).padStart(2, "0")}</span>
                  <span><strong>{session.title ?? "Conversation"}</strong><small>{new Date(session.updatedAt).toLocaleDateString()}</small></span>
                </button>
              ))}
              {!sessions.length && <p className="empty-copy">Create a conversation to start asking questions.</p>}
            </div>
            <button className="change-video" onClick={() => { setVideo(null); setSessions([]); setPreviewUrl(null); }}>Change video</button>
          </aside>

          <section className="video-column">
            <div className="section-caption"><span>Now viewing</span><span className="live-label">● Ready to explore</span></div>
            <div className="player-frame">
              {previewUrl ? <video ref={videoRef} src={previewUrl} controls /> : <div className="player-empty"><span>▶</span><p>Video preview unavailable</p></div>}
            </div>
            <div className="video-meta"><div><p className="eyebrow">Current file</p><h2>{video.title ?? "Untitled video"}</h2></div><span className="duration-pill">{video.status}</span></div>
            {error && <p className="error-message">{error}</p>}
          </section>

          <section className="chat-panel">
            <div className="chat-header"><div><p className="eyebrow">Assistant</p><h2>{activeSession?.title ?? "New conversation"}</h2></div><span className="model-label">Mistral · RAG</span></div>
            <div className="messages" aria-live="polite">
              {!messages.length && <div className="empty-chat"><span>✦</span><p>Ask about the argument, a detail, or a moment in the video.</p></div>}
              {messages.map((message, index) => (
                <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
                  <span className="message-role">{message.role === "user" ? "You" : "Assistant"}</span>
                  <p>{message.content || (streaming && index === messages.length - 1 ? "Thinking..." : "")}</p>
                  {message.sources?.length ? <div className="sources"><span>Sources</span>{message.sources.map((source) => <button key={source.chunkIndex} onClick={() => seekTo(source.startSeconds)}>{formatTime(source.startSeconds)}</button>)}</div> : null}
                </article>
              ))}
            </div>
            <form className="composer" onSubmit={submitQuestion}>
              <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about this video..." rows={2} disabled={streaming} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              <button type="submit" className="send-button" disabled={!question.trim() || streaming}>Send <span>↗</span></button>
            </form>
          </section>
        </section>
      )}
    </main>
  );
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}
