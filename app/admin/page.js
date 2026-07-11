"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import {
  Shield,
  Users,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  FileText,
  Trash2,
  Check,
  CheckCircle,
  X,
  Eye,
  AlertOctagon,
  RefreshCw,
  UserX,
  Settings
} from "lucide-react";

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [stats, setStats] = useState(null);
  const [founders, setFounders] = useState([]);
  const [investors, setInvestors] = useState([]);
  const [helpRequests, setHelpRequests] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  const [activePanel, setActivePanel] = useState("stats"); // "stats", "founders", "investors", "help", "feedback"
  const [loading, setLoading] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(null);

  // Check admin login
  useEffect(() => {
    if (!user) return;
    const storedAdminToken = sessionStorage.getItem("adminToken");
    if (storedAdminToken) {
      setAdminToken(storedAdminToken);
      setIsAdmin(true);
      loadAdminData(storedAdminToken);
    }
  }, [user]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });
      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem("adminToken", data.token);
        setAdminToken(data.token);
        setIsAdmin(true);
        loadAdminData(data.token);
      } else {
        setAuthError(data.message || "Invalid admin secret");
      }
    } catch {
      setAuthError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async (tokenVal) => {
    const headers = { "x-admin-token": tokenVal || adminToken };

    try {
      // Stats
      const statsRes = await fetch("/api/admin/stats", { headers });
      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.stats);

      // Founders
      const foundersRes = await fetch("/api/admin/founders", { headers });
      const foundersData = await foundersRes.json();
      if (foundersData.success) setFounders(foundersData.founders);

      // Investors
      const investorsRes = await fetch("/api/admin/investors", { headers });
      const investorsData = await investorsRes.json();
      if (investorsData.success) setInvestors(investorsData.investors);

      // Help
      const helpRes = await fetch("/api/admin/help-list", { headers });
      const helpData = await helpRes.json();
      if (helpData.success) setHelpRequests(helpData.requests);

      // Feedback
      const feedbackRes = await fetch("/api/admin/feedback-list", { headers });
      const feedbackData = await feedbackRes.json();
      if (feedbackData.success) setFeedbacks(feedbackData.feedbacks);

    } catch (e) {
      console.error("Failed to load admin panel data", e);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm("Are you absolutely sure you want to delete and block this user?")) return;
    try {
      const res = await fetch(`/api/admin/user/${userId}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (data.success) {
        setFounders(prev => prev.filter(u => u._id !== userId));
        setInvestors(prev => prev.filter(u => u._id !== userId));
        setShowUserModal(false);
        loadAdminData();
      }
    } catch {}
  };

  const markHelpSeen = async (id) => {
    try {
      const res = await fetch(`/api/admin/help/${id}/seen`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken }
      });
      if (res.ok) {
        setHelpRequests(prev => prev.map(r => r._id === id ? { ...r, seen: true } : r));
      }
    } catch {}
  };

  const markHelpResolved = async (id) => {
    try {
      const res = await fetch(`/api/admin/help/${id}/resolved`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken }
      });
      if (res.ok) {
        setHelpRequests(prev => prev.map(r => r._id === id ? { ...r, seen: true, resolved: true } : r));
      }
    } catch {}
  };

  const deleteHelp = async (id) => {
    try {
      const res = await fetch(`/api/admin/help/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken }
      });
      if (res.ok) {
        setHelpRequests(prev => prev.filter(r => r._id !== id));
      }
    } catch {}
  };

  const markFeedbackSeen = async (id) => {
    try {
      const res = await fetch(`/api/admin/feedback/${id}/seen`, {
        method: "PATCH",
        headers: { "x-admin-token": adminToken }
      });
      if (res.ok) {
        setFeedbacks(prev => prev.map(f => f._id === id ? { ...f, seen: true } : f));
      }
    } catch {}
  };

  const deleteFeedback = async (id) => {
    try {
      const res = await fetch(`/api/admin/feedback/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken }
      });
      if (res.ok) {
        setFeedbacks(prev => prev.filter(f => f._id !== id));
      }
    } catch {}
  };

  const cleanNotifications = async () => {
    try {
      const res = await fetch("/api/admin/clean-old-notifications", {
        headers: { "x-admin-token": adminToken }
      });
      const data = await res.json();
      if (data.success) {
        alert(`Cleanup completed. Users updated: ${data.usersUpdated}`);
      }
    } catch {}
  };

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 selection:bg-indigo-500/30">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-rose-500 via-indigo-500 to-violet-500"></div>

          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-4">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black text-slate-200">Admin Gatekeeper</h2>
            <p className="text-slate-500 text-xs mt-1.5">Enter the admin credentials secret to enter dashboard</p>
          </div>

          {authError && (
            <div className="p-3.5 mb-5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              {authError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition active:scale-95 disabled:opacity-50 text-sm"
            >
              {loading ? "Authorizing..." : "Access Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const panels = [
    { name: "Stats", id: "stats", icon: TrendingUp },
    { name: "Founders", id: "founders", icon: Users, count: founders.length },
    { name: "Investors", id: "investors", icon: Users, count: investors.length },
    { name: "Help Desk", id: "help", icon: HelpCircle, count: helpRequests.filter(r => !r.seen).length },
    { name: "Feedback", id: "feedback", icon: MessageSquare, count: feedbacks.filter(f => !f.seen).length },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Side navigation */}
          <aside className="w-full lg:w-64 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800/80 pr-0 lg:pr-6 scrollbar-none">
            {panels.map(p => {
              const Icon = p.icon;
              const active = activePanel === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePanel(p.id)}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition flex items-center gap-2.5 whitespace-nowrap lg:w-full ${
                    active ? "bg-slate-900 border border-slate-800 text-indigo-400" : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent"
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  <span>{p.name}</span>
                  {!!p.count && (
                    <span className="ml-auto bg-indigo-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {p.count}
                    </span>
                  )}
                </button>
              );
            })}

            <button
              onClick={cleanNotifications}
              className="px-4 py-3 rounded-xl text-xs font-bold text-rose-450 hover:text-rose-450 hover:bg-rose-500/10 border border-transparent transition flex items-center gap-2.5 whitespace-nowrap lg:w-full lg:mt-auto"
            >
              <Settings className="w-4.5 h-4.5" />
              <span>Clean Notifications</span>
            </button>
          </aside>

          {/* Main Dashboard Section */}
          <section className="flex-1 min-w-0">
            {activePanel === "stats" && stats && (
              <div className="space-y-6">
                <h3 className="text-lg font-black text-slate-200 mb-4">Platform Overview</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Total Users</p>
                    <p className="text-2xl font-black mt-2 text-white">{stats.total}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Founders</p>
                    <p className="text-2xl font-black mt-2 text-indigo-400">{stats.founders}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Investors</p>
                    <p className="text-2xl font-black mt-2 text-pink-400">{stats.investors}</p>
                  </div>
                  <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Connections</p>
                    <p className="text-2xl font-black mt-2 text-emerald-400">{stats.totalConnections}</p>
                  </div>
                </div>
              </div>
            )}

            {/* User Lists */}
            {(activePanel === "founders" || activePanel === "investors") && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-200 capitalize mb-4">Registered {activePanel}</h3>
                <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4">Connections</th>
                        <th className="p-4">Reports</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {(activePanel === "founders" ? founders : investors).map(u => (
                        <tr key={u._id} className="hover:bg-slate-900/20 transition">
                          <td className="p-4 font-bold text-slate-200">{u.fullName}</td>
                          <td className="p-4">{u.email}</td>
                          <td className="p-4">{new Date(u.joinedAt).toLocaleDateString()}</td>
                          <td className="p-4 text-center">{u.connectionsCount}</td>
                          <td className="p-4 text-center">
                            <span className={u.reportedCount > 0 ? "text-rose-400 font-bold" : "text-slate-500"}>
                              {u.reportedCount}
                            </span>
                          </td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowUserModal(true);
                              }}
                              className="px-2.5 py-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white rounded-lg transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteUser(u._id)}
                              className="px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Help Requests */}
            {activePanel === "help" && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-200 mb-4">User Support Help Desk</h3>
                <div className="space-y-3">
                  {helpRequests.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">No support requests</div>
                  ) : (
                    helpRequests.map(r => (
                      <div
                        key={r._id}
                        className={`p-5 rounded-2xl bg-slate-900/40 border transition ${
                          r.resolved ? "border-slate-800/40 opacity-70" : "border-slate-800"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 text-xs">{r.userName}</span>
                              <span className="text-[10px] text-slate-500">({r.userRole})</span>
                              {r.resolved ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded">
                                  Resolved
                                </span>
                              ) : !r.seen ? (
                                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold px-2 py-0.5 rounded animate-pulse">
                                  New
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">{r.problem}</p>
                            {r.screenshot && (
                              <button
                                onClick={() => setShowScreenshot(r.screenshot)}
                                className="mt-3.5 px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 rounded-lg text-[10px] text-indigo-400 font-bold transition flex items-center gap-1.5"
                              >
                                View Screenshot
                              </button>
                            )}
                          </div>

                          <div className="flex gap-2 self-end sm:self-center">
                            {!r.seen && (
                              <button
                                onClick={() => markHelpSeen(r._id)}
                                className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-white rounded-lg transition"
                                title="Mark Seen"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            {!r.resolved && (
                              <button
                                onClick={() => markHelpResolved(r._id)}
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[10px] transition flex items-center gap-1"
                              >
                                <Check className="w-3.5 h-3.5" /> Resolve
                              </button>
                            )}
                            <button
                              onClick={() => deleteHelp(r._id)}
                              className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Feedback list */}
            {activePanel === "feedback" && (
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-200 mb-4">Platform Feedback</h3>
                <div className="space-y-3">
                  {feedbacks.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 text-xs">No feedback submitted</div>
                  ) : (
                    feedbacks.map(f => (
                      <div
                        key={f._id}
                        className={`p-5 rounded-2xl bg-slate-900/40 border transition ${
                          f.seen ? "border-slate-800/40 opacity-70" : "border-slate-800"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-200 text-xs">{f.userName}</span>
                              <span className="text-[10px] text-slate-500">({f.userRole})</span>
                              <span className="text-xs text-amber-500 font-bold">★ {f.rating}/5</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-2 font-medium leading-relaxed">{f.message}</p>
                          </div>

                          <div className="flex gap-2 self-end sm:self-center">
                            {!f.seen && (
                              <button
                                onClick={() => markFeedbackSeen(f._id)}
                                className="p-2 border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-400 hover:text-white rounded-lg transition"
                                title="Mark Seen"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteFeedback(f._id)}
                              className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h3 className="font-black text-slate-200 text-sm">Review complete User Profile</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex gap-3 items-center">
                {selectedUser.profile?.photo ? (
                  <img src={selectedUser.profile.photo} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-sm">
                    {selectedUser.fullName[0]}
                  </div>
                )}
                <div>
                  <h4 className="font-black text-slate-100 text-sm">{selectedUser.fullName}</h4>
                  <p className="text-slate-500">{selectedUser.email}</p>
                  <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-bold mt-1 inline-block uppercase">
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 space-y-3">
                <p>
                  <b>Phone Number:</b> {selectedUser.profile?.phoneCountry || ""} {selectedUser.profile?.phone || "N/A"}
                </p>
                {selectedUser.profile?.linkedinUrl && (
                  <p>
                    <b>LinkedIn:</b>{" "}
                    <a
                      href={selectedUser.profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:underline"
                    >
                      {selectedUser.profile.linkedinUrl}
                    </a>
                  </p>
                )}
                {selectedUser.role === "Founder" ? (
                  <>
                    <p>
                      <b>Startup Name:</b> {selectedUser.profile?.startupName}
                    </p>
                    <p>
                      <b>Funding Stage:</b> {selectedUser.profile?.fundingStage}
                    </p>
                    <p className="leading-relaxed">
                      <b>Description:</b> <span className="text-slate-400">{selectedUser.profile?.description}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <b>Investor Type:</b> {selectedUser.profile?.investorType}
                    </p>
                    <p>
                      <b>Ticket Size:</b> {selectedUser.profile?.ticketSize}
                    </p>
                    <p>
                      <b>Financial Capacity:</b> {selectedUser.profile?.financialCapacity}
                    </p>
                    <p className="leading-relaxed">
                      <b>Investor Bio:</b> <span className="text-slate-400">{selectedUser.profile?.bio}</span>
                    </p>
                  </>
                )}
              </div>

              <div className="border-t border-slate-800 pt-4 flex gap-3">
                <button
                  onClick={() => deleteUser(selectedUser._id)}
                  className="flex-1 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-450 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition text-xs flex items-center justify-center gap-1.5"
                >
                  <UserX className="w-4 h-4" /> Suspend & Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {showScreenshot && (
        <div
          onClick={() => setShowScreenshot(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl w-full">
            <button
              onClick={() => setShowScreenshot(null)}
              className="absolute -top-10 right-0 p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={showScreenshot} alt="Screenshot Attachment" className="w-full h-auto rounded-3xl object-contain max-h-[85vh] shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
