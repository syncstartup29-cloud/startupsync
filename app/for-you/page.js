"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Rocket, TrendingUp, Users, Shield, Award, Sparkles, CheckCircle } from "lucide-react";

export default function ForYouPage() {
  const router = useRouter();

  const founderBenefits = [
    {
      title: "Direct Access to Decision-Making Partners",
      desc: "Bypass associates and gatekeepers. StartupSync connects you directly to verified general partners, venture capitalists, and active angel investors who write checks."
    },
    {
      title: "Intelligent Pitch Deck & Metric Presentation",
      desc: "Present your key KPIs (ARR/MRR, MoM growth, customer retention, burn rate) in standardized, high-impact data cards engineered to capture investor attention instantly."
    },
    {
      title: "Confidential & Controlled Data Room Access",
      desc: "Maintain 100% control over your sensitive intellectual property and financial projections. Grant or revoke document access on a per-investor basis with detailed view logs."
    },
    {
      title: "Zero Spam & Protected Focus",
      desc: "Your inbox stays completely clear of noise and unsolicited vendor pitches. You only receive messages from verified investors when mutual interest is explicitly established."
    }
  ];

  const investorBenefits = [
    {
      title: "High-Signal, Pre-Vetted Dealflow Engine",
      desc: "Every startup on StartupSync undergoes multi-point domain verification, OTP checks, and admin moderation before entering the discovery queue."
    },
    {
      title: "Granular Thesis & Sector Filtering",
      desc: "Filter incoming dealflow by exact sector verticals (AI, SaaS, BioTech, Fintech), geographical HQ, funding stage (Pre-Seed through Series A+), and monthly revenue metrics."
    },
    {
      title: "Swipe & Revisit Pipeline Management",
      desc: "Efficiently sort through hundreds of curated opportunities with our swipe interface. Revisit skipped startups anytime as they hit new valuation milestones or growth targets."
    },
    {
      title: "Encrypted Deal Collaboration & Syndication",
      desc: "Conduct diligence, request cap table details, schedule founder meetings, and invite co-investors into private, encrypted chat rooms all within a unified interface."
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
            <a href="/how-it-works" className="hover:text-[#2563eb] transition-colors">How It Works</a>
            <a href="/for-you" className="text-[#2563eb] font-bold">For You</a>
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
          <span className="text-xs font-extrabold uppercase tracking-widest text-[#059669] bg-[#059669]/10 border border-[#059669]/20 px-3.5 py-1.5 rounded-full inline-block mb-6">
            Ecosystem Role Deep-Dive Guide
          </span>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-black mb-6 leading-[1.1]">
            Tailored tools for every side of the deal table.
          </h1>
          <p className="text-lg sm:text-xl text-zinc-600 font-medium leading-relaxed max-w-3xl mx-auto mb-10">
            Whether you are a visionary founder raising your seed round or an institutional investor deploying capital into high-growth ventures, StartupSync provides dedicated, purpose-built dashboards designed for your exact operational workflow.
          </p>
        </div>
      </section>

      {/* Founders Deep-Dive */}
      <section className="py-20 border-b border-zinc-200">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6">
            <div className="w-12 h-12 rounded-2xl bg-[#2563eb]/10 border border-[#2563eb]/20 flex items-center justify-center mb-6 text-[#2563eb]">
              <Rocket className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#2563eb]">For Ambitious Founders</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-black mt-2 mb-6">
              Spend less time chasing intros, more time building.
            </h2>
            <p className="text-zinc-700 font-medium text-base sm:text-lg leading-relaxed mb-8">
              Fundraising shouldn't mean sending hundreds of cold emails into the void or paying thousands for unvetted investor databases. StartupSync gives founders a verified, institutional-grade discovery channel where investors actively search for your exact sector thesis and growth metrics.
            </p>
            <div className="space-y-6 mb-8">
              {founderBenefits.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✓</div>
                  <div>
                    <h4 className="text-base font-bold text-black mb-1">{item.title}</h4>
                    <p className="text-sm text-zinc-600 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/")}
              className="py-3.5 px-8 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
            >
              <span>Join as a Verified Founder</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="lg:col-span-6">
            <div className="bg-zinc-50 border border-zinc-300 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden group">
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1 rounded-full text-[11px] font-extrabold text-zinc-800 shadow-sm z-10">
                Founder Pitch & Metric Dashboard
              </div>
              <img src="/founder.jpg" alt="Founder dashboard showcase" className="w-full h-auto max-h-[480px] object-cover mx-auto rounded-2xl border border-zinc-200/80 shadow-sm transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
          </div>
        </div>
      </section>

      {/* Investors Deep-Dive */}
      <section className="py-20 border-b border-zinc-200 bg-zinc-50/40">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 lg:order-2">
            <div className="w-12 h-12 rounded-2xl bg-[#059669]/10 border border-[#059669]/20 flex items-center justify-center mb-6 text-[#059669]">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#059669]">For Capital Partners & VCs</span>
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-black mt-2 mb-6">
              Curated, high-signal dealflow tailored to your fund mandate.
            </h2>
            <p className="text-zinc-700 font-medium text-base sm:text-lg leading-relaxed mb-8">
              Sifting through thousands of unvetted pitch decks wastes valuable diligence time. StartupSync provides institutional partners, super angels, and venture funds with a precision filtering engine that matches only startups meeting your strict quantitative and sector parameters.
            </p>
            <div className="space-y-6 mb-8">
              {investorBenefits.map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#059669]/10 text-[#059669] flex items-center justify-center shrink-0 mt-0.5 font-bold text-xs">✓</div>
                  <div>
                    <h4 className="text-base font-bold text-black mb-1">{item.title}</h4>
                    <p className="text-sm text-zinc-600 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => router.push("/")}
              className="py-3.5 px-8 bg-[#059669] hover:bg-[#047857] text-white text-sm font-bold rounded-xl shadow-md transition active:scale-95 flex items-center gap-2"
            >
              <span>Join as an Accredited Investor</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="lg:col-span-6 lg:order-1">
            <div className="bg-white border border-zinc-300 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden group">
              <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-zinc-200 px-3 py-1 rounded-full text-[11px] font-extrabold text-zinc-800 shadow-sm z-10">
                Investor Thesis & Pipeline View
              </div>
              <img src="/investors.jpg" alt="Investor pipeline showcase" className="w-full h-auto max-h-[480px] object-cover mx-auto rounded-2xl border border-zinc-200/80 shadow-sm transition-transform duration-500 group-hover:scale-[1.02]" />
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table Section */}
      <section className="py-20">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-extrabold uppercase tracking-wider text-[#0d9488] bg-[#0d9488]/10 px-3.5 py-1.5 rounded-full inline-block mb-4">
              Platform Comparison
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-black mb-4">
              Why top founders and VCs choose StartupSync.
            </h2>
            <p className="text-zinc-600 font-medium text-base">
              How our dedicated venture discovery ecosystem compares against legacy fundraising channels.
            </p>
          </div>

          <div className="overflow-x-auto border border-zinc-200 rounded-3xl shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-100/80 border-b border-zinc-200 text-xs uppercase font-extrabold tracking-wider text-zinc-700">
                  <th className="p-5 sm:p-6 w-1/3">Feature Capability</th>
                  <th className="p-5 sm:p-6 w-1/3 bg-[#2563eb]/5 text-[#2563eb] border-l border-r border-zinc-200">StartupSync Platform</th>
                  <th className="p-5 sm:p-6 w-1/3 text-zinc-500">Traditional Cold Outreach / Directories</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-sm font-medium text-zinc-800">
                <tr>
                  <td className="p-5 sm:p-6 font-bold text-black">Verification & Fraud Protection</td>
                  <td className="p-5 sm:p-6 bg-[#2563eb]/5 border-l border-r border-zinc-200 font-bold text-[#059669] flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 shrink-0 text-[#059669]" /> Mandatory OTP, Domain Checks & Admin Vetting
                  </td>
                  <td className="p-5 sm:p-6 text-zinc-500">Unverified public profiles prone to spam & impersonation</td>
                </tr>
                <tr>
                  <td className="p-5 sm:p-6 font-bold text-black">Matchmaking Precision</td>
                  <td className="p-5 sm:p-6 bg-[#2563eb]/5 border-l border-r border-zinc-200 font-bold text-[#2563eb]">
                    AI multi-variable scoring across 40+ thesis criteria
                  </td>
                  <td className="p-5 sm:p-6 text-zinc-500">Manual keyword search across static Excel/CSV sheets</td>
                </tr>
                <tr>
                  <td className="p-5 sm:p-6 font-bold text-black">Confidential Document Sharing</td>
                  <td className="p-5 sm:p-6 bg-[#2563eb]/5 border-l border-r border-zinc-200 font-bold text-[#0d9488]">
                    Integrated encrypted data rooms with instant access revocation
                  </td>
                  <td className="p-5 sm:p-6 text-zinc-500">Unprotected email attachments or disjointed third-party drive links</td>
                </tr>
                <tr>
                  <td className="p-5 sm:p-6 font-bold text-black">Introduction Speed & Deal Flow</td>
                  <td className="p-5 sm:p-6 bg-[#2563eb]/5 border-l border-r border-zinc-200 font-bold text-[#2563eb]">
                    Instant mutual swipe match & encrypted real-time chat
                  </td>
                  <td className="p-5 sm:p-6 text-zinc-500">Weeks of waiting for warm introductions from mutual acquaintances</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-20 bg-zinc-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-6">
          <Sparkles className="w-10 h-10 text-[#059669] mx-auto mb-6" />
          <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
            Connect with the right partners today.
          </h3>
          <p className="text-zinc-400 font-medium text-base mb-8 max-w-2xl mx-auto">
            Choose your role and join our verified ecosystem of founders and investors in under two minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="w-full sm:w-auto py-4 px-8 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Explore StartupSync Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
