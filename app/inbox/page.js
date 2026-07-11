"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Check, X, Mail, Phone, MessageSquare, Inbox, Send, ArrowRight, UserPlus, Info, CheckCircle } from "lucide-react";

export default function InboxPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("received"); // "received", "sent"
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const loadRequests = async () => {
    if (!token) return;
    setError("");
    setLoading(true);

    try {
      // Load received requests
      const receivedRes = await fetch("/api/inbox/list", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const receivedData = await receivedRes.json();
      if (receivedData.success) {
        setReceivedRequests(receivedData.requests || []);
      }

      // Load sent requests
      const sentRes = await fetch("/api/inbox/sent", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const sentData = await sentRes.json();
      if (sentData.success) {
        setSentRequests(sentData.requests || []);
      }
    } catch {
      setError("Failed to fetch connection requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadRequests();
  }, [user, token]);

  const handleAccept = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch("/api/inbox/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (data.success) {
        // Reload list
        loadRequests();
      }
    } catch {
      setError("Could not accept request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDecline = async (requestId) => {
    setActionLoadingId(requestId);
    try {
      const res = await fetch("/api/inbox/decline", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ requestId })
      });
      const data = await res.json();
      if (data.success) {
        loadRequests();
      }
    } catch {
      setError("Could not decline request.");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black tracking-tight mb-2 text-white">Connection Inbox</h2>
          <p className="text-slate-300 text-xs font-medium">Review incoming pitches and check sent request history</p>
        </div>

        {error && (
          <div className="p-4 mb-6 text-sm font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 rounded-2xl shadow-md">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-8 max-w-sm mx-auto shadow-lg">
          <button
            onClick={() => setActiveTab("received")}
            className={`flex-1 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 ${
              activeTab === "received" ? "bg-slate-800 text-indigo-400 border border-slate-700 font-extrabold shadow-sm" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            <Inbox className="w-4 h-4" /> Received
            {receivedRequests.filter(r => r.status === "pending").length > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black shadow-sm">
                {receivedRequests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`flex-1 py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2 ${
              activeTab === "sent" ? "bg-slate-800 text-indigo-400 border border-slate-700 font-extrabold shadow-sm" : "text-slate-400 hover:text-slate-200 font-semibold"
            }`}
          >
            <Send className="w-4 h-4" /> Sent History
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {activeTab === "received" ? (
            receivedRequests.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-xl">
                <Inbox className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h4 className="text-base font-black text-white">Inbox Empty</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">You have no connection requests at the moment.</p>
              </div>
            ) : (
              receivedRequests.map(r => (
                <div key={r._id} className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    {/* User profile details */}
                    <div className="flex items-start gap-4">
                      {r.fromUser.photo ? (
                        <img src={r.fromUser.photo} alt={r.fromUser.fullName} className="w-12 h-12 rounded-2xl object-cover border border-slate-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-base flex-shrink-0">
                          {r.fromUser.fullName[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-white text-base">{r.fromUser.fullName}</h3>
                          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-md text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/30">
                            {r.fromUser.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-normal font-medium">{r.fromUser.subtitle}</p>
                      </div>
                    </div>

                    {/* Actions depending on Status */}
                    {r.status === "pending" ? (
                      <div className="flex gap-2.5 sm:self-center">
                        <button
                          onClick={() => handleDecline(r._id)}
                          disabled={actionLoadingId === r._id}
                          className="p-3 border border-slate-700 hover:border-rose-500/50 bg-slate-900/80 text-slate-400 hover:text-rose-400 rounded-xl transition disabled:opacity-50 shadow-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleAccept(r._id)}
                          disabled={actionLoadingId === r._id}
                          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                      </div>
                    ) : r.status === "accepted" ? (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 w-full sm:max-w-md mt-4 sm:mt-0 space-y-3 shadow-inner">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 mb-1">
                          <CheckCircle className="w-4 h-4" /> Connected
                        </div>
                        {r.sharedData && (
                          <div className="space-y-2 text-xs text-slate-300 font-medium">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-slate-400" />
                              <span>{r.sharedData.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-slate-400" />
                              <span>{r.sharedData.phone}</span>
                            </div>
                            <button
                              onClick={() => router.push("/chat")}
                              className="mt-3 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition shadow-md shadow-indigo-600/20"
                            >
                              <MessageSquare className="w-4 h-4" /> Start Direct Chat
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 font-bold bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg">
                        Declined
                      </div>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            sentRequests.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/80 border border-slate-800 rounded-3xl shadow-xl">
                <Send className="w-8 h-8 text-slate-500 mx-auto mb-3" />
                <h4 className="text-base font-black text-white">No Sent Requests</h4>
                <p className="text-xs text-slate-400 mt-1 font-medium">Pitches you send to others will appear here.</p>
              </div>
            ) : (
              sentRequests.map(r => (
                <div key={r._id} className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      {r.toUser.photo ? (
                        <img src={r.toUser.photo} alt={r.toUser.fullName} className="w-12 h-12 rounded-2xl object-cover border border-slate-700" />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-base flex-shrink-0">
                          {r.toUser.fullName[0]}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-white text-base">{r.toUser.fullName}</h3>
                          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-md text-[10px] font-extrabold uppercase tracking-wider border border-indigo-500/30">
                            {r.toUser.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1.5 leading-normal font-medium">{r.toUser.subtitle}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {r.status === "pending" ? (
                        <span className="text-xs font-extrabold uppercase tracking-wider bg-amber-950/80 border border-amber-500/40 text-amber-300 px-3.5 py-1.5 rounded-lg animate-pulse shadow-sm">
                          Pending Approval
                        </span>
                      ) : r.status === "accepted" ? (
                        <div className="flex flex-col items-end gap-2 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl w-full sm:max-w-md shadow-inner">
                          <span className="text-xs font-extrabold uppercase tracking-wider bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-lg shadow-sm">
                            Request Accepted
                          </span>
                          {r.shared && (
                            <div className="space-y-1.5 text-xs text-slate-300 w-full mt-2 font-medium">
                              <p className="text-[10px] text-slate-400 font-extrabold uppercase">Contact Details</p>
                              <p className="text-xs text-slate-200">{r.shared.email}</p>
                              {r.shared.phone && <p className="text-xs text-slate-200">{r.shared.phone}</p>}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-bold uppercase tracking-wider bg-slate-950/80 border border-slate-800 text-slate-400 px-3.5 py-1.5 rounded-lg">
                          Declined
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </main>
    </div>
  );
}
