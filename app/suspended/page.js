"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AlertOctagon, Mail, LogOut } from "lucide-react";

export default function SuspendedPage() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="max-w-md w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-rose-500"></div>

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6 animate-pulse">
          <AlertOctagon className="w-8 h-8" />
        </div>

        <h1 className="text-xl font-black text-slate-100 tracking-tight mb-3">Account Suspended</h1>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          Your StartupSync account has been suspended due to violations of our Terms of Service (e.g. misleading profile details, duplicate submissions, or spam).
        </p>

        <div className="p-4 bg-slate-950/45 border border-slate-850 rounded-2xl mb-6 flex flex-col gap-2.5 items-center justify-center text-xs">
          <div className="flex items-center gap-2 text-slate-300 font-bold">
            <Mail className="w-4 h-4 text-indigo-400" />
            Support Appeal Inquiry
          </div>
          <a href="mailto:syncstartup29@gmail.com" className="text-indigo-400 font-extrabold hover:underline">
            syncstartup29@gmail.com
          </a>
        </div>

        <button
          onClick={logout}
          className="w-full py-3.5 bg-slate-800 hover:bg-slate-750 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs transition"
        >
          <LogOut className="w-4 h-4" /> Go Back to Login
        </button>
      </div>
    </div>
  );
}
