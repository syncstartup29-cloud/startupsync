"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function WelcomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [countdown, setCountdown] = useState(10);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const redirectTimeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        if (!user.termsAccepted) {
          router.push("/accept-terms");
        } else {
          router.push("/connections");
        }
      }, 600);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(redirectTimeout);
    };
  }, [user, router]);

  if (!user) return null;

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 transition-opacity duration-500 ${
        fadeOut ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center max-w-xl mx-auto space-y-8 animate-fade-in">
        <div className="space-y-2">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] text-indigo-400 uppercase">
            Welcome To
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            StartupSync
          </h1>
          <p className="text-xs text-slate-400 tracking-[0.08em] font-medium uppercase">
            Where Startups Meet Opportunity
          </p>
        </div>

        {/* Auspicious Sloka Section */}
        <div className="py-8 px-6 bg-slate-900/40 border border-slate-800/80 rounded-3xl space-y-4 shadow-xl shadow-orange-500/[0.02]">
          <div className="text-amber-500 font-semibold tracking-[0.4em] text-sm">
            🕉 &nbsp; ॐ &nbsp; 🕉
          </div>
          <div className="text-orange-400 font-serif text-lg sm:text-xl leading-loose">
            वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।
            <br />
            निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥
          </div>
          <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-orange-500/30 to-transparent mx-auto" />
          <div className="text-orange-400/80 text-xs sm:text-sm font-medium italic leading-relaxed">
            O Lord of curved trunk &amp; mighty form, radiant as a million suns —
            <br />
            remove all obstacles &amp; bless every endeavour, always.
          </div>
        </div>

        {/* Countdown / Timer Section */}
        <div className="flex flex-col items-center gap-3">
          <div className="text-[11px] text-amber-500/80 font-bold uppercase tracking-wider">
            🙏 गणपति बप्पा मोरया
          </div>
          <div className="w-40 sm:w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${(countdown / 10) * 100}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 font-bold tracking-widest uppercase">
            Redirecting in {countdown}s
          </div>
        </div>
      </div>
    </div>
  );
}
