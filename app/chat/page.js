"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSocket } from "@/contexts/SocketContext";
import Navbar from "@/components/Navbar";
import {
  Send,
  Paperclip,
  Trash2,
  Edit2,
  MoreVertical,
  Check,
  CheckCheck,
  Circle,
  FileText,
  Archive,
  Image as ImageIcon,
  MessageSquare,
  AlertCircle,
  X,
  FileDown
} from "lucide-react";

export default function ChatPage() {
  const { user, token } = useAuth();
  const { socket, onlineUsers } = useSocket();

  const [connections, setConnections] = useState([]);
  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);

  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");

  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");

  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load connected users
  useEffect(() => {
    if (!token) return;
    setLoadingConvos(true);

    fetch("/api/connections/connected", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConnections(data.users || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingConvos(false);
      });
  }, [token]);

  // Load messages when peer is selected
  useEffect(() => {
    if (!activePeer || !token) return;

    setLoadingMessages(true);
    fetch(`/api/chat/history?peerId=${activePeer._id}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setMessages(data.messages || []);
          scrollToBottom();

          // Mark messages as seen
          if (socket) {
            socket.emit("chat:seen", { otherId: activePeer._id });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingMessages(false);
      });

    // Join room
    if (socket) {
      socket.emit("chat:join", { otherId: activePeer._id });
    }
  }, [activePeer, token, socket]);

  // Socket listeners for real-time chat events
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      // Check if message belongs to active peer
      if (activePeer && (msg.fromUserId === activePeer._id || msg.toUserId === activePeer._id)) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();

        // Mark as seen if we are the recipient
        if (msg.fromUserId === activePeer._id) {
          socket.emit("chat:seen", { otherId: activePeer._id });
        }
      }
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true, text: "", file: "" } : m));
    };

    const handleMessageEdited = ({ messageId, text }) => {
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, text, edited: true } : m));
    };

    const handleTyping = ({ fromUserId, typing: isTyping }) => {
      if (activePeer && fromUserId === activePeer._id) {
        setPeerTyping(isTyping);
      }
    };

    const handleSeenUpdate = ({ byUserId }) => {
      if (activePeer && byUserId === activePeer._id) {
        setMessages(prev => prev.map(m => m.fromUserId === user._id ? { ...m, seen: true, seenAt: new Date() } : m));
      }
    };

    socket.on("chat:newMessage", handleNewMessage);
    socket.on("chat:messageDeleted", handleMessageDeleted);
    socket.on("chat:messageEdited", handleMessageEdited);
    socket.on("chat:typing", handleTyping);
    socket.on("chat:seenUpdate", handleSeenUpdate);

    return () => {
      socket.off("chat:newMessage", handleNewMessage);
      socket.off("chat:messageDeleted", handleMessageDeleted);
      socket.off("chat:messageEdited", handleMessageEdited);
      socket.off("chat:typing", handleTyping);
      socket.off("chat:seenUpdate", handleSeenUpdate);
    };
  }, [socket, activePeer, user]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activePeer) return;

    if (!typing) {
      setTyping(true);
      socket.emit("chat:typing", { otherId: activePeer._id, typing: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping(false);
      socket.emit("chat:typing", { otherId: activePeer._id, typing: false });
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activePeer || !token) return;

    const textToSend = inputText.trim();
    setInputText("");

    if (socket) {
      socket.emit("chat:typing", { otherId: activePeer._id, typing: false });
      setTyping(false);
    }

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ toUserId: activePeer._id, text: textToSend })
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Message send failed");
      }
    } catch {
      setError("Network error");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activePeer || !token) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("toUserId", activePeer._id);
    formData.append("originalName", file.name);

    try {
      const res = await fetch("/api/chat/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Upload failed");
      }
    } catch {
      setError("Upload connection issue");
    }
  };

  const deleteMessage = async (messageId) => {
    if (!token || !activePeer) return;
    try {
      await fetch("/api/chat/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ peerId: activePeer._id, messageId })
      });
    } catch {}
  };

  const startEditMessage = (msg) => {
    setEditingMessageId(msg._id);
    setEditText(msg.text);
  };

  const saveEditMessage = async (messageId) => {
    if (!editText.trim() || !token || !activePeer) return;
    try {
      const res = await fetch("/api/chat/edit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ peerId: activePeer._id, messageId, text: editText.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setEditingMessageId(null);
        setEditText("");
      }
    } catch {}
  };

  const deleteConversation = async () => {
    if (!token || !activePeer) return;
    try {
      const res = await fetch("/api/chat/delete-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ peerId: activePeer._id })
      });
      const data = await res.json();
      if (data.success) {
        setMessages([]);
        setShowOptionsDropdown(false);
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col h-screen overflow-hidden selection:bg-indigo-500/30">
      <Navbar />

      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar - Connections */}
        <aside className={`w-80 border-r border-slate-800 bg-slate-950 flex flex-col flex-shrink-0 ${activePeer ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b border-slate-800 bg-slate-900/40">
            <h3 className="font-black text-white text-sm tracking-wide">Direct Messages</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 scrollbar-thin">
            {loadingConvos ? (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">Loading conversations...</div>
            ) : connections.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
                <MessageSquare className="w-6 h-6 text-slate-500" />
                <span>No active connections yet.</span>
              </div>
            ) : (
              connections.map(c => {
                const isOnline = onlineUsers.has(c._id.toString());
                const photo = c.role === "Founder" ? (c.founderProfile?.photo || "") : (c.investorProfile?.photo || "");
                const subtitle = c.role === "Founder" ? (c.founderProfile?.startupName || "") : (c.investorProfile?.investorType || "");
                return (
                  <button
                    key={c._id}
                    onClick={() => setActivePeer(c)}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition text-left ${
                      activePeer?._id === c._id ? "bg-slate-900 border border-slate-700 text-white shadow-md font-extrabold" : "hover:bg-slate-900/80 text-slate-300 hover:text-white border border-transparent"
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {photo ? (
                        <img src={photo} alt="" className="w-10 h-10 rounded-xl object-cover border border-slate-700" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                          {c.fullName[0]}
                        </div>
                      )}
                      {isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 shadow shadow-emerald-500/25"></span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black truncate">{c.fullName}</h4>
                      <p className="text-xs text-slate-400 truncate mt-0.5 font-medium">{c.role} &bull; {subtitle}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Window */}
        <main className={`flex-1 flex flex-col min-h-0 bg-slate-950/60 ${!activePeer ? "hidden md:flex items-center justify-center" : "flex"}`}>
          {activePeer ? (
            <>
              {/* Header */}
              <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between bg-slate-900/60 shadow-sm">
                <div className="flex items-center gap-3">
                  <button onClick={() => setActivePeer(null)} className="md:hidden p-1 rounded hover:bg-slate-800 mr-2 text-slate-300">
                    &larr; Back
                  </button>
                  <div className="relative">
                    {activePeer.founderProfile?.photo || activePeer.investorProfile?.photo ? (
                      <img
                        src={activePeer.founderProfile?.photo || activePeer.investorProfile?.photo}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover border border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                        {activePeer.fullName[0]}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">{activePeer.fullName}</h3>
                    <p className={`text-[10px] mt-0.5 uppercase tracking-wider font-extrabold ${
                      onlineUsers.has(activePeer._id.toString()) ? "text-emerald-400" : "text-slate-400"
                    }`}>
                      {onlineUsers.has(activePeer._id.toString()) ? "Online" : "Offline"}
                    </p>
                  </div>
                </div>

                {/* Option Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
                    className="p-2 rounded-xl hover:bg-slate-900 border border-slate-800/40 text-slate-450 hover:text-white"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {showOptionsDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-2 z-50 animate-fade-in">
                      <button
                        onClick={deleteConversation}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-2 transition"
                      >
                        <Trash2 className="w-4 h-4" /> Clear History
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 mx-6 mt-4 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                  <button onClick={() => setError("")} className="ml-auto p-0.5 hover:bg-slate-800 rounded text-slate-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
                {loadingMessages ? (
                  <div className="text-center py-10 text-slate-500 text-xs">Loading history...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs">Send a message to start connection conversation.</div>
                ) : (
                  messages.map(m => {
                    const isMe = m.fromUserId === user._id;
                    return (
                      <div key={m._id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-2xl p-3.5 relative overflow-hidden group shadow-lg font-medium text-sm ${
                          isMe ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-br-none" : "bg-slate-900/90 text-slate-100 rounded-bl-none border border-slate-700/80"
                        }`}>
                          {m.deleted ? (
                            <span className="text-xs italic opacity-75">This message was deleted</span>
                          ) : (
                            <>
                              {editingMessageId === m._id ? (
                                <div className="flex gap-2 items-center">
                                  <input
                                    type="text"
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-medium focus:outline-none"
                                  />
                                  <button onClick={() => saveEditMessage(m._id)} className="p-1.5 bg-indigo-500 hover:bg-indigo-400 rounded-lg">
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  </button>
                                  <button onClick={() => setEditingMessageId(null)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg">
                                    <X className="w-3.5 h-3.5 text-slate-300" />
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  {m.text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>}
                                  {m.file && (
                                    <div className="mt-1">
                                      {m.file.match(/\.(jpeg|jpg|png|gif|webp)/i) ? (
                                        <img src={m.file} alt="Attachment" className="max-w-full rounded-lg max-h-48 object-contain" />
                                      ) : (
                                        <a href={m.file} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2.5 bg-slate-950/80 rounded-xl hover:bg-slate-950 transition border border-slate-700/60 text-xs font-semibold">
                                          <FileText className="w-5 h-5 text-indigo-400" />
                                          <span className="truncate flex-1">{m.fileName || "File"}</span>
                                          <FileDown className="w-4 h-4 text-slate-400" />
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  <div className="flex items-center justify-end gap-1.5 mt-2 opacity-75 text-[10px] font-semibold">
                                    <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {m.edited && <span>(edited)</span>}
                                    {isMe && (m.seen ? <CheckCheck className="w-3 h-3 text-emerald-300" /> : <Check className="w-3 h-3" />)}
                                  </div>
                                </div>
                              )}

                              {/* Hover Actions */}
                              {isMe && !m.deleted && editingMessageId !== m._id && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 bg-slate-950/80 backdrop-blur rounded-lg p-0.5 transition duration-150">
                                  {!m.file && (
                                    <button onClick={() => startEditMessage(m)} className="p-1 text-slate-450 hover:text-white rounded hover:bg-slate-800">
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button onClick={() => deleteMessage(m._id)} className="p-1 text-rose-450 hover:text-rose-300 rounded hover:bg-slate-800">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {peerTyping && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900 border border-slate-850 text-slate-500 text-[10px] px-3.5 py-2 rounded-xl animate-pulse">
                      Typing...
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>

              {/* Chat Input Footer */}
              <form onSubmit={handleSendMessage} className="h-20 border-t border-slate-800 px-6 flex items-center gap-4 bg-slate-900/60 shadow-inner">
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex-shrink-0 shadow-sm"
                >
                  <Paperclip className="w-4.5 h-4.5" />
                </button>

                <input
                  type="text"
                  placeholder="Write a message..."
                  value={inputText}
                  onChange={handleInputChange}
                  className="flex-1 bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 px-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-inner"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 disabled:opacity-50 transition active:scale-95 flex-shrink-0"
                >
                  <Send className="w-4.5 h-4.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 shadow-md">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">Select a Conversation</h3>
              <p className="text-sm text-slate-400 max-w-xs leading-relaxed font-medium">
                Choose a connection from the sidebar to open direct real-time chat.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
