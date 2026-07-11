"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, UserCheck, Search, MessageSquare, Shield, CheckCircle, Sparkles, Layers, RefreshCw, Lock, Zap } from "lucide-react";

export default function HowItWorksPage() {
  const router = useRouter();

  const workflowSteps = [
    {
      num: "01",
      title: "Verified Profile Creation & Thesis Mapping",
      subtitle: "Build a high-signal founder pitch profile or institutional investment thesis.",
      icon: UserCheck,
      color: "text-[#2563eb]",
      bg: "bg-[#2563eb]/10 border-[#2563eb]/20",
      image: "/founder.jpg",
      description: "Getting started on StartupSync begins with our structured profile builder. Unlike generic social networks where anyone can claim to be an angel investor or serial founder, our platform mandates strict identity and credential verification.",
      details: [
        "For Founders: Input your live product demo links, financial projections, monthly recurring revenue (MRR), burn rate, target raise amount, and equity terms. Upload your confidential pitch deck directly to your encrypted data room.",
        "For Investors: Define your exact fund size, typical check size ($50k to $10M+), geographical preferences, preferred sector verticals, and portfolio value-add thesis.",
        "Mandatory Admin Moderation: Every newly registered profile undergoes rigorous domain authentication, OTP checks, and manual quality review by our compliance team before discovery enablement."
      ]
    },
    {
      num: "02",
      title: "AI Discovery & Targeted Swipe Matchmaking",
      subtitle: "Filter through curated, high-relevance opportunities without background noise.",
      icon: Search,
      color: "text-[#0d9488]",
      bg: "bg-[#0d9488]/10 border-[#0d9488]/20",
      image: "/stats-mockup.jpg",
      description: "Once verified, our matching engine continuously analyzes your profile against active participants across the ecosystem. You are presented with clean, highly structured opportunity cards engineered for rapid evaluation.",
      details: [
        "Express Interest vs. Skip: Review founder key metrics or investor portfolio records with a single swipe. Clicking 'Express Interest' allows you to attach a customized direct introduction note explaining exact alignment.",
        "Zero Unsolicited Spam Guarantee: When you express interest, your profile is routed to the recipient's pending review queue. Direct contact details and encrypted messaging remain strictly locked until both parties explicitly opt-in.",
        "Skipped Profile Management: Revisit profiles you skipped at any time inside your Network Management dashboard as startups hit new milestones or your investment mandate evolves."
      ]
    },
    {
      num: "03",
      title: "Mutual Connection & Encrypted Deal Room Collaboration",
      subtitle: "Close rounds faster with purpose-built venture collaboration tools.",
      icon: MessageSquare,
      color: "text-[#059669]",
      bg: "bg-[#059669]/10 border-[#059669]/20",
      image: "/W_White.jpg",
      description: "The instant a mutual connection is confirmed, StartupSync unlocks a private, end-to-end encrypted deal collaboration workspace. You gain direct access to the decision-makers without gatekeepers.",
      details: [
        "Real-Time Encrypted Chat: Exchange time-sensitive diligence questions, schedule due diligence calls, and negotiate valuation caps directly.",
        "Confidential Document Control: Share sensitive term sheets, cap table breakdowns, and audited financials with granular view tracking and instantaneous access revocation permissions.",
        "Network Growth & Syndication: Connect with co-investors to form syndicates or invite advisors to join specific deal rooms to accelerate closing timelines."
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black/5">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0" onClick={() => router.push("/")}>
            <img src="/logo.png" alt="StartupSync" className="h-6 w-auto object-contain" />
            <span className="text-xl font-bold tracking-tight text-black">StartupSync.</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-zinc-700">
            <a href="/features" className="hover:text-[#2563eb] transition-colors">Features</a>
            <a href="/how-it-works" className="text-[#2563eb] font-bold">How It Works</a>
            <a href="/for-you" className="hover:text-[#2563eb] transition-colors">For You</a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="py-2 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back Home
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 sm:py-28 border-b border-zinc-200 bg-zinc-50/50">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 text-center max-w-4xl">
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#0d9488] bg-[#0d9488]/10 border border-[#0d9488]/20 px-3.5 py-1.5 rounded-full inline-block mb-6">
            Detailed Workflow & Architecture
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
            How StartupSync transforms venture capital discovery.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 font-medium leading-relaxed max-w-3xl mx-auto mb-10">
            A comprehensive breakdown of our 3-stage dealflow pipeline. Built from the ground up to eliminate cold outreach friction and protect sensitive financial data.
          </p>
        </div>
      </section>

      {/* Steps Breakdown */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 space-y-28">
          {workflowSteps.map((step, idx) => {
            const Icon = step.icon;
            const isEven = idx % 2 === 0;
            return (
              <div key={step.num} className="grid lg:grid-cols-12 gap-12 items-center border-b border-zinc-200 pb-28 last:border-b-0 last:pb-0">
                {/* Text Content */}
                <div className={`lg:col-span-6 ${isEven ? "lg:order-1" : "lg:order-2"}`}>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="text-4xl sm:text-5xl font-black text-zinc-300 tabular-nums">
                      {step.num}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${step.bg}`}>
                      <Icon className={`w-6 h-6 ${step.color}`} />
                    </div>
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-black mb-3">
                    {step.title}
                  </h2>
                  <p className={`text-sm sm:text-base font-bold ${step.color} mb-6`}>
                    {step.subtitle}
                  </p>
                  <p className="text-zinc-700 font-medium text-base sm:text-lg leading-relaxed mb-8">
                    {step.description}
                  </p>
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Comprehensive Step Execution Details:</h4>
                    {step.details.map((detail, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${step.color}`} />
                        <span className="text-sm text-zinc-800 font-semibold leading-relaxed">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Image / Mockup Showcase */}
                <div className={`lg:col-span-6 ${isEven ? "lg:order-2" : "lg:order-1"}`}>
                  <div className="bg-zinc-50 border border-zinc-300 rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1 rounded-full text-[11px] font-extrabold text-zinc-800 shadow-sm z-10">
                      Step {step.num} Pipeline Architecture
                    </div>
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-auto max-h-[480px] object-contain mx-auto rounded-2xl border border-zinc-200/80 shadow-sm transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Security & Reliability Callout */}
      <section className="py-16 bg-zinc-50 border-t border-b border-zinc-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid md:grid-cols-3 gap-8 text-center">
          <div className="p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm">
            <Lock className="w-8 h-8 text-[#2563eb] mx-auto mb-4" />
            <h4 className="text-lg font-bold text-black mb-2">End-to-End Encryption</h4>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">All chat messages and confidential pitch deck files are encrypted in transit and at rest using AES-256 protocols.</p>
          </div>
          <div className="p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm">
            <Shield className="w-8 h-8 text-[#0d9488] mx-auto mb-4" />
            <h4 className="text-lg font-bold text-black mb-2">Verified Accredited Network</h4>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">Mandatory identity checks and domain verification ensure zero synthetic accounts or unverified middlemen.</p>
          </div>
          <div className="p-8 bg-white border border-zinc-200 rounded-2xl shadow-sm">
            <Zap className="w-8 h-8 text-[#059669] mx-auto mb-4" />
            <h4 className="text-lg font-bold text-black mb-2">Real-Time Sync Engine</h4>
            <p className="text-xs text-zinc-600 font-medium leading-relaxed">Instantaneous socket updates for new connection requests, chat messages, and read notifications across all devices.</p>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-zinc-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <Sparkles className="w-10 h-10 text-[#0d9488] mx-auto mb-6" />
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Start your discovery journey today.
          </h3>
          <p className="text-zinc-400 font-medium text-base mb-8 max-w-2xl mx-auto">
            Experience our high-velocity dealflow pipeline and connect with verified decision-makers within minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-full sm:w-auto py-4 px-8 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Get Started Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
