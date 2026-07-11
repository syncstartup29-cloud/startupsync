"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { X, Heart, Sparkles, MapPin, Briefcase, Award, RotateCcw, AlertCircle, FileText, CheckCircle, RefreshCcw } from "lucide-react";

export default function ConnectionsPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");

  const [skippedUsers, setSkippedUsers] = useState([]);
  const [showSkippedModal, setShowSkippedModal] = useState(false);

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [animationClass, setAnimationClass] = useState(""); // "swipe-left", "swipe-right"
  const [toastMessage, setToastMessage] = useState(null); // { title, type, message }

  const loadFeed = async (page = 1, append = false) => {
    if (!token) return;
    setError("");
    if (page === 1) setLoading(true);

    try {
      const res = await fetch(`/api/connections/feed?page=${page}&limit=12`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (append) {
          setFeed(prev => [...prev, ...data.users]);
        } else {
          setFeed(data.users);
          setActiveCardIndex(0);
        }
        setHasMore(data.pagination.hasMore);
        setCurrentPage(page);
      } else {
        setError(data.message || "Failed to load feed.");
      }
    } catch {
      setError("Failed to fetch discovery feed.");
    } finally {
      setLoading(false);
    }
  };

  const loadSkipped = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/connections/skipped", {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSkippedUsers(data.users || []);
      }
    } catch {}
  };

  useEffect(() => {
    if (!user) return;
    loadFeed(1, false);
    loadSkipped();
  }, [user, token]);

  const showToast = (title, message, type = "success") => {
    setToastMessage({ title, message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAction = async (actionType) => {
    if (feed.length === 0 || activeCardIndex >= feed.length) return;
    const targetUser = feed[activeCardIndex];
    const targetId = targetUser._id;

    if (actionType === "skip") {
      setAnimationClass("swipe-left");
      setTimeout(async () => {
        setFeed(prev => prev.filter((_, idx) => idx !== activeCardIndex));
        setAnimationClass("");
        try {
          await fetch("/api/connections/skip", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ targetId })
          });
          loadSkipped();
        } catch {}
      }, 300);
    } else if (actionType === "interested") {
      setAnimationClass("swipe-right");
      setTimeout(async () => {
        setFeed(prev => prev.filter((_, idx) => idx !== activeCardIndex));
        setAnimationClass("");
        try {
          const res = await fetch("/api/connections/interested", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ toUserId: targetId })
          });
          const data = await res.json();
          if (data.success) {
            if (data.connected) {
              showToast("Connection Synced! 🤝", `You are now connected with ${targetUser.fullName}! Check inbox.`, "success");
            } else {
              showToast("Request Sent 📤", `Connection request sent to ${targetUser.fullName}.`, "info");
            }
          }
        } catch {}
      }, 300);
    }
  };

  const handleUnskip = async (targetId) => {
    try {
      const res = await fetch("/api/connections/skipped-remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ targetId })
      });
      const data = await res.json();
      if (data.success) {
        setSkippedUsers(prev => prev.filter(u => u._id !== targetId));
        // Reload feed to insert unskipped user
        loadFeed(1, false);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  const currentCard = feed[activeCardIndex];
  const isFounder = user?.role === "Founder";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500/30">
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in max-w-sm w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
          {toastMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-indigo-400 flex-shrink-0" />
          )}
          <div>
            <h4 className="text-xs font-black text-slate-200">{toastMessage.title}</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{toastMessage.message}</p>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 flex flex-col items-center">
        {/* Header Options */}
        <div className="w-full flex justify-between items-center mb-8">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">Discover Matches</h2>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSkippedModal(true);
                loadSkipped();
              }}
              className="px-4 py-2 border border-slate-700 hover:border-slate-500 bg-slate-900/80 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
            >
              <RotateCcw className="w-4 h-4" /> Skipped History ({skippedUsers.length})
            </button>
            <button
              onClick={() => loadFeed(1, false)}
              className="p-2 border border-slate-700 hover:border-slate-500 bg-slate-900/80 text-slate-200 hover:text-white rounded-xl transition shadow-md"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="w-full p-4 mb-6 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            {error}
          </div>
        )}

        {/* Card Stage */}
        <div className="w-full max-w-lg flex flex-col items-center">
          {feed.length > 0 && currentCard ? (
            <div className="w-full flex flex-col items-center">
              {/* Card Container */}
              <div
                className={`w-full bg-slate-900/95 border border-slate-700/90 rounded-3xl overflow-hidden shadow-2xl relative transition-transform duration-300 ${
                  animationClass === "swipe-left"
                    ? "translate-x-[-120%] rotate-[-10deg] opacity-0"
                    : animationClass === "swipe-right"
                    ? "translate-x-[120%] rotate-[10deg] opacity-0"
                    : "translate-x-0 rotate-0"
                }`}
              >
                {/* Photo & Basic Details */}
                <div className="relative h-80 bg-slate-950/60 flex items-center justify-center">
                  {currentCard.founderProfile?.photo || currentCard.investorProfile?.photo ? (
                    <img
                      src={currentCard.founderProfile?.photo || currentCard.investorProfile?.photo}
                      alt={currentCard.fullName}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-500 font-black text-xl">No Photo Provided</div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent"></div>

                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
                        {currentCard.role}
                      </span>
                      {currentCard.founderProfile?.industry && (
                        <span className="px-2.5 py-1 bg-slate-800/90 backdrop-blur text-slate-200 rounded-lg text-xs font-bold border border-slate-700/60">
                          {currentCard.founderProfile.industry}
                        </span>
                      )}
                      {currentCard.investorProfile?.investorType && (
                        <span className="px-2.5 py-1 bg-slate-800/90 backdrop-blur text-slate-200 rounded-lg text-xs font-bold border border-slate-700/60">
                          {currentCard.investorProfile.investorType}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-white">{currentCard.fullName}</h3>
                    {currentCard.founderProfile?.startupName && (
                      <p className="text-sm text-indigo-300 font-bold mt-1">
                        🚀 Founder at {currentCard.founderProfile.startupName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Extended Details */}
                <div className="p-6 space-y-4">
                  {currentCard.role === "Founder" ? (
                    <div className="space-y-4">
                      {currentCard.founderProfile?.fundingStage && (
                        <div className="flex gap-2 items-center text-xs font-bold text-slate-200 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shadow-inner">
                          <Award className="w-4 h-4 text-indigo-400" /> Funding Stage:{" "}
                          <span className="text-white ml-auto font-extrabold">{currentCard.founderProfile.fundingStage}</span>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-2">
                          Startup Mandate
                        </h4>
                        <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl shadow-inner font-normal">
                          {currentCard.founderProfile.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {currentCard.investorProfile?.ticketSize && (
                          <div className="flex gap-2 items-center text-xs font-bold text-slate-200 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shadow-inner">
                            <DollarSign className="w-4 h-4 text-indigo-400" /> Size:{" "}
                            <span className="text-white ml-auto font-extrabold">{currentCard.investorProfile.ticketSize}</span>
                          </div>
                        )}
                        {currentCard.investorProfile?.preferredStage && (
                          <div className="flex gap-2 items-center text-xs font-bold text-slate-200 bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl shadow-inner">
                            <Briefcase className="w-4 h-4 text-indigo-400" /> Stage:{" "}
                            <span className="text-white ml-auto font-extrabold">{currentCard.investorProfile.preferredStage}</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-300 uppercase tracking-wider mb-2">
                          Investment Criteria
                        </h4>
                        <p className="text-sm leading-relaxed text-slate-200 bg-slate-950/80 border border-slate-800/80 p-4 rounded-2xl shadow-inner font-normal">
                          {currentCard.investorProfile.bio}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-6 mt-8 w-full max-w-[280px]">
                <button
                  onClick={() => handleAction("skip")}
                  className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-450 hover:text-rose-500 hover:border-rose-500/30 hover:bg-rose-500/5 active:scale-90 transition shadow-lg shadow-black/30"
                  title="Skip"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={() => handleAction("interested")}
                  className="flex-1 h-14 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white flex items-center justify-center gap-2 font-bold shadow-xl shadow-indigo-600/30 active:scale-95 transition"
                  title="Connect"
                >
                  <Heart className="w-5 h-5 fill-current" />
                  Connect
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 px-8 bg-slate-900/80 border border-slate-800 rounded-3xl w-full flex flex-col items-center shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">No More Matches Right Now</h3>
              <p className="text-sm text-slate-400 max-w-xs mx-auto leading-relaxed mt-2.5 font-medium">
                We've swiped all the profiles fitting your mandate. Don't worry — new players register daily!
              </p>
              <button
                onClick={() => loadFeed(1, false)}
                className="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-indigo-600/25"
              >
                Check Again
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Skipped History Modal */}
      {showSkippedModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[80vh] animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-black text-white text-lg">Skipped Profile History</h3>
              <button
                onClick={() => setShowSkippedModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {skippedUsers.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm font-medium">No skipped users found</div>
              ) : (
                skippedUsers.map(u => {
                  const photo = u.role === "Founder" ? (u.founderProfile?.photo || "") : (u.investorProfile?.photo || "");
                  const sub = u.role === "Founder" ? (u.founderProfile?.startupName || "") : (u.investorProfile?.investorType || "");
                  return (
                    <div key={u._id} className="flex items-center justify-between p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner">
                      <div className="flex items-center gap-3">
                        {photo ? (
                          <img src={photo} alt="" className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                            {u.fullName[0]}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-black text-white">{u.fullName}</h4>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">{u.role} &bull; {sub}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnskip(u._id)}
                        className="px-3.5 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 font-bold rounded-lg text-xs transition shadow-sm"
                      >
                        Unskip
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
