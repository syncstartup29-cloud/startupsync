"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Target, MessageSquare, Shield, Zap, Globe, Users, CheckCircle, Sparkles, Lock, Cpu, Database, Award } from "lucide-react";

export default function FeaturesPage() {
  const router = useRouter();

  const featureDeepDives = [
    {
      id: "smart-matching",
      icon: Target,
      title: "AI-Powered Strategic Matchmaking",
      subtitle: "Precision algorithms designed to eliminate cold outreach and incompatible introductions.",
      color: "text-[#2563eb]",
      bg: "bg-[#2563eb]/10 border-[#2563eb]/20",
      image: "/stats-mockup.jpg",
      description: "StartupSync uses multi-variable semantic and quantifiable scoring models to connect founders with the right capital partners. Instead of relying on random networking events or generic directories, our matchmaking engine evaluates over 40 distinct criteria.",
      keyPoints: [
        "Thesis & Sector Alignment: Automatic mapping between startup industry verticals (Fintech, AI/ML, SaaS, CleanTech) and investor mandates.",
        "Stage & Check Size Compatibility: Precise matching across Pre-Seed, Seed, Series A, and Growth equity requirements.",
        "Strategic Value-Add Scoring: Connects founders with investors who offer relevant domain expertise, distribution networks, and mentorship.",
        "Real-Time Match Radar: Visual heatmaps showing exact alignment percentages before either party initiates a connection request."
      ]
    },
    {
      id: "real-time-chat",
      icon: MessageSquare,
      title: "Encrypted Dealflow Messaging & Term Sheet Collaboration",
      subtitle: "Move from mutual interest to signed term sheet within a single secure environment.",
      color: "text-[#0d9488]",
      bg: "bg-[#0d9488]/10 border-[#0d9488]/20",
      image: "/W_White.jpg",
      description: "Once a mutual match is established between a founder and an investor, StartupSync instantly opens an end-to-end encrypted private chat channel. Our messaging suite is engineered specifically for venture capital deal execution.",
      keyPoints: [
        "Instant Pitch Deck & Data Room Sharing: Drag-and-drop secure file transfers with detailed view tracking and permission revocations.",
        "Integrated Calendar & Scheduling: Propose meeting slots across timezones without leaving the chat interface.",
        "Smart Read Receipts & Activity Tracking: Know exactly when your executive summary or financial model has been reviewed.",
        "Threaded Deal Term Discussions: Keep diligence questions, valuation discussions, and legal notes cleanly organized."
      ]
    },
    {
      id: "verified-profiles",
      icon: Shield,
      title: "Zero-Fraud Verified Identity Ecosystem",
      subtitle: "Institutional-grade verification ensures every profile represents an authentic entity.",
      color: "text-[#059669]",
      bg: "bg-[#059669]/10 border-[#059669]/20",
      image: "/successclg.jpg",
      description: "Trust is the cornerstone of venture capital. StartupSync implements rigorous multi-layer identity verification and admin moderation before any profile is granted discovery access on the platform.",
      keyPoints: [
        "OTP & Corporate Domain Verification: Multi-factor authentication verifying active founder email addresses and fund domains.",
        "Accredited Investor Checks: Verification protocols ensuring all participating capital providers meet regulatory compliance standards.",
        "Continuous Quality Moderation: Automated spam detection and human admin oversight to maintain a high-signal community.",
        "Verified Shield Badges: Transparent trust markers displayed prominently on verified founder and investor cards."
      ]
    },
    {
      id: "instant-connections",
      icon: Zap,
      title: "One-Tap Express Interest & Swipe Dealflow",
      subtitle: "High-velocity discovery built for modern founder and investor workflows.",
      color: "text-[#0891b2]",
      bg: "bg-[#0891b2]/10 border-[#0891b2]/20",
      image: "/founder.jpg",
      description: "Time is a founder's most scarce asset. StartupSync streamlines the initial discovery phase into a lightning-fast, high-context review interface that removes bureaucratic friction.",
      keyPoints: [
        "Curated Discovery Feed: High-impact profile cards highlighting key traction metrics, ARR/MRR growth, and team background.",
        "Express Interest with Custom Notes: Send targeted, high-priority requests with tailored context explaining why the match is synergistic.",
        "Skipped Profile Recovery: Easily revisit previously skipped profiles in your dedicated network management dashboard.",
        "Mutual Opt-In Protection: Direct messaging only opens when both sides explicitly accept, guaranteeing zero unsolicited spam."
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
            <a href="/features" className="text-[#2563eb] font-bold">Features</a>
            <a href="/how-it-works" className="hover:text-[#2563eb] transition-colors">How It Works</a>
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
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#2563eb] bg-[#2563eb]/10 border border-[#2563eb]/20 px-3.5 py-1.5 rounded-full inline-block mb-6">
            Comprehensive Capabilities Guide
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
            Engineered for high-velocity venture matchmaking.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 font-medium leading-relaxed max-w-3xl mx-auto mb-10">
            Explore the full architecture of StartupSync — from our intelligent AI matchmaking algorithms to end-to-end encrypted dealflow collaboration. Every tool designed specifically to close rounds faster.
          </p>
        </div>
      </section>

      {/* Deep Dives List */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 space-y-28">
          {featureDeepDives.map((feature, idx) => {
            const Icon = feature.icon;
            const isEven = idx % 2 === 0;
            return (
              <div key={feature.id} className="grid lg:grid-cols-12 gap-12 items-center border-b border-zinc-200 pb-28 last:border-b-0 last:pb-0">
                {/* Text Content */}
                <div className={`lg:col-span-6 ${isEven ? "lg:order-1" : "lg:order-2"}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border ${feature.bg}`}>
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-black mb-3">
                    {feature.title}
                  </h2>
                  <p className={`text-sm sm:text-base font-bold ${feature.color} mb-6`}>
                    {feature.subtitle}
                  </p>
                  <p className="text-zinc-700 font-medium text-base sm:text-lg leading-relaxed mb-8">
                    {feature.description}
                  </p>
                  <div className="space-y-4">
                    <h4 className="text-xs font-extrabold text-zinc-900 uppercase tracking-wider">Key Technological Advantages:</h4>
                    {feature.keyPoints.map((point, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className={`w-5 h-5 shrink-0 mt-0.5 ${feature.color}`} />
                        <span className="text-sm text-zinc-800 font-semibold leading-relaxed">{point}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Image / Mockup Showcase */}
                <div className={`lg:col-span-6 ${isEven ? "lg:order-2" : "lg:order-1"}`}>
                  <div className="bg-zinc-50 border border-zinc-300 rounded-3xl p-6 sm:p-8 shadow-xl overflow-hidden relative group">
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1 rounded-full text-[11px] font-extrabold text-zinc-800 shadow-sm z-10">
                      Live Platform Feature
                    </div>
                    <img
                      src={feature.image}
                      alt={feature.title}
                      className="w-full h-auto max-h-[480px] object-contain mx-auto rounded-2xl border border-zinc-200/80 shadow-sm transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-zinc-900 text-white text-center border-t border-zinc-800">
        <div className="max-w-4xl mx-auto px-6">
          <Sparkles className="w-10 h-10 text-[#2563eb] mx-auto mb-6" />
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Ready to experience next-generation venture matchmaking?
          </h3>
          <p className="text-zinc-400 font-medium text-base mb-8 max-w-2xl mx-auto">
            Join thousands of verified founders and investors using StartupSync to discover high-synergy capital partnerships today.
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
