"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { CheckSquare, Square, Shield, Scale, ScrollText } from "lucide-react";

export default function AcceptTermsPage() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }
    if (user.termsAccepted) {
      router.push(user.role === "Founder" ? "/founder-dashboard" : "/investor-dashboard");
    }
  }, [user, router]);

  const handleAccept = async () => {
    if (!agreed || !token) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/session/accept-terms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ termsAccepted: true });
        router.push(user.role === "Founder" ? "/founder-dashboard" : "/investor-dashboard");
      } else {
        setError(data.message || "Failed to accept terms. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || user.termsAccepted) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 selection:bg-indigo-500/30">
      <div className="max-w-3xl w-full bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-4">
            <ScrollText className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight mb-2">Terms and Conditions</h1>
          <p className="text-slate-400 text-xs">Please read and accept the terms of service to proceed</p>
        </div>

        {error && (
          <div className="p-4 mb-4 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
            {error}
          </div>
        )}

        {/* Scrollable Terms Content */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-6 text-sm text-slate-300 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
          <section className="space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              1. Platform Purpose
            </h3>
            <p className="leading-relaxed text-xs">
              StartupSync is a networking platform designed to connect startup founders seeking capital with angel/institutional investors. We do not act as broker-dealers, investment advisors, or financial intermediaries.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-400" />
              2. Vetting and Information accuracy
            </h3>
            <p className="leading-relaxed text-xs">
              Founders are solely responsible for all information listed on their profiles, including pitch documents, financials, and company descriptions. StartupSync does not guarantee the success or truthfulness of any company listed.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-indigo-400" />
              3. User Responsibilities
            </h3>
            <p className="leading-relaxed text-xs">
              Users must be at least 18 years old. You are prohibited from sharing duplicate profiles, temp emails, false investment tickets, or misleading credentials. Abusive behavior, spamming, or harassment will lead to instant suspension.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              4. Data Privacy
            </h3>
            <p className="leading-relaxed text-xs">
              Your profile photo is mandatory and public. Sensitive information (phone, email) is locked and shared only after a mutual connection request is accepted. We do not sell user data to third parties.
            </p>
          </section>
        </div>

        {/* Footer with Checkbox */}
        <div className="pt-6 border-t border-slate-800/80 mt-6 space-y-4">
          <button
            type="button"
            onClick={() => setAgreed(!agreed)}
            className="flex items-center gap-3 cursor-pointer text-slate-300 hover:text-white select-none text-left w-full focus:outline-none"
          >
            {agreed ? (
              <CheckSquare className="w-5 h-5 text-indigo-500 flex-shrink-0" />
            ) : (
              <Square className="w-5 h-5 text-slate-700 flex-shrink-0" />
            )}
            <span className="text-xs font-semibold leading-relaxed">
              I have read and agree to the Terms & Conditions of StartupSync
            </span>
          </button>

          <button
            type="button"
            onClick={handleAccept}
            disabled={!agreed || loading}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition active:scale-95 text-sm"
          >
            {loading ? "Saving Preferences..." : "Accept & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple placeholder icon mapping
function UserIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="2"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
