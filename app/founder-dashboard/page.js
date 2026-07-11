"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { Phone, Link, FileText, User, Upload, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";

export default function FounderDashboard() {
  const { user, token, updateUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("+91");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [startupName, setStartupName] = useState("");
  const [industry, setIndustry] = useState("");
  const [fundingStage, setFundingStage] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState("");

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Exif / size limit settings
  const MAX_UPLOAD_PX = 1024;

  useEffect(() => {
    if (!user) return;
    if (user.role !== "Founder") {
      router.push("/investor-dashboard");
      return;
    }

    setFullName(user.fullName || "");

    // Load full profile details
    fetch("/api/profile/get-profile", {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.profile) {
          const p = data.profile;
          setPhone(p.phone || "");
          setPhoneCountry(p.phoneCountry || "+91");
          setLinkedinUrl(p.linkedinUrl || "");
          setStartupName(p.startupName || "");
          setIndustry(p.industry || "");
          setFundingStage(p.fundingStage || "");
          setDescription(p.description || "");
          setPhoto(p.photo || "");
        }
      })
      .catch(() => {})
      .finally(() => {
        setInitialLoading(false);
      });
  }, [user, token, router]);

  // Image preprocessor
  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File is too large. Max size is 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        const scale = Math.min(1, MAX_UPLOAD_PX / Math.max(w, h));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhoto(dataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!phone || !startupName || !description || !photo) {
      setError("Please fill all required fields and upload a photo.");
      return;
    }

    if (phone.replace(/\D/g, "").length !== 10) {
      setError("Phone number must be exactly 10 digits");
      return;
    }

    if (description.length < 100) {
      setError("Startup description must be at least 100 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/profile/founder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName,
          newEmail: user.email,
          founderProfile: {
            phone: phone.replace(/\D/g, ""),
            phoneCountry,
            linkedinUrl,
            startupName,
            description,
            industry,
            fundingStage,
            photo,
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        updateUser({
          fullName: data.user.fullName,
          profileComplete: true,
          founderProfile: data.user.founderProfile,
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(data.message || "Failed to update profile");
      }
    } catch {
      setError("Server connection issue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500"></div>
      </div>
    );
  }

  const descRemaining = 100 - description.length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-indigo-500/30">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-black tracking-tight mb-2 text-white">Founder Profile</h1>
            <p className="text-slate-300 text-xs font-medium">Complete your startup details to start swiping and matching</p>
          </div>

          {error && (
            <div className="p-4 mb-6 text-sm font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 rounded-2xl shadow-md">
              {error}
            </div>
          )}

          {success && (
            <div className="p-4 mb-6 text-sm font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl shadow-md flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              <span>Profile updated successfully! You can now start swiping on the discover tab.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Photo Upload */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-950/80 border-2 border-dashed border-slate-700 hover:border-slate-500 transition rounded-3xl">
              <label className="cursor-pointer relative flex flex-col items-center">
                {photo ? (
                  <img
                    src={photo}
                    alt="Startup Logo / Founder Photo"
                    className="w-24 h-24 rounded-full object-cover border-2 border-indigo-500/50 shadow-lg shadow-indigo-500/10"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:border-slate-500 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <span className="text-xs font-bold text-indigo-400 hover:underline mt-3">
                  Upload Profile Photo <span className="text-rose-500">*</span>
                </span>
                <span className="text-[10px] font-medium text-slate-400 mt-1">PNG, JPG or WebP. Max 10MB</span>
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-inner"
                  />
                </div>
              </div>

              {/* Startup Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                  Startup Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={startupName}
                  onChange={(e) => setStartupName(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 px-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-inner"
                />
              </div>

              {/* Contact Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                  Phone Number <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={phoneCountry}
                    onChange={(e) => setPhoneCountry(e.target.value)}
                    className="bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 px-3 text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition text-sm cursor-pointer shadow-inner"
                  >
                    <option value="+91">+91 (IN)</option>
                    <option value="+1">+1 (US)</option>
                    <option value="+44">+44 (UK)</option>
                  </select>
                  <div className="relative flex-1">
                    <Phone className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="10-digit number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-inner"
                    />
                  </div>
                </div>
              </div>

              {/* LinkedIn URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">LinkedIn URL</label>
                <div className="relative">
                  <Link className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm shadow-inner"
                  />
                </div>
              </div>

              {/* Industry */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Industry</label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 px-4 text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition text-sm cursor-pointer shadow-inner"
                >
                  <option value="">Select Industry</option>
                  <option value="SaaS">SaaS / Enterprise Software</option>
                  <option value="Fintech">Fintech</option>
                  <option value="Healthtech">Healthtech</option>
                  <option value="AI/ML">Artificial Intelligence / ML</option>
                  <option value="E-commerce">E-commerce / Retail</option>
                  <option value="Edtech">Edtech</option>
                  <option value="Deeptech">Deeptech / Robotics</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Funding Stage */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">Funding Stage</label>
                <select
                  value={fundingStage}
                  onChange={(e) => setFundingStage(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 px-4 text-slate-200 font-semibold focus:outline-none focus:border-indigo-500 transition text-sm cursor-pointer shadow-inner"
                >
                  <option value="">Select Stage</option>
                  <option value="Idea / Bootstrapped">Idea / Bootstrapped</option>
                  <option value="Pre-Seed">Pre-Seed</option>
                  <option value="Seed">Seed</option>
                  <option value="Pre-Series A">Pre-Series A</option>
                  <option value="Series A+">Series A or beyond</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-extrabold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span>
                  Startup Description <span className="text-rose-500">*</span>
                </span>
                <span
                  className={`text-xs font-bold ${
                    descRemaining <= 0 ? "text-emerald-400 font-extrabold" : "text-slate-400"
                  }`}
                >
                  {descRemaining > 0 ? `${descRemaining} more characters needed` : "Looks good!"}
                </span>
              </label>
              <div className="relative">
                <FileText className="w-4.5 h-4.5 text-slate-400 absolute left-3.5 top-3.5" />
                <textarea
                  rows={4}
                  required
                  placeholder="Describe your startup, product, problem you are solving, target market, and traction (Min. 100 characters)..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950/90 border border-slate-700/90 rounded-xl py-3 pl-11 pr-4 text-slate-100 placeholder-slate-500 font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition text-sm resize-none leading-relaxed shadow-inner"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/25 disabled:opacity-50 transition active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? "Saving Profile..." : "Save and Discover Matches"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
