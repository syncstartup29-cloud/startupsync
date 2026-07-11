"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Mail, Lock, User as UserIcon, ArrowRight, Eye, EyeOff,
  CheckCircle, AlertCircle, Rocket, Search,
  MessageSquare, Shield, Zap, Globe, Users, TrendingUp,
  ArrowUpRight, ChevronDown, Star, Target, Layers, X, ChevronRight
} from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Intersection Observer Hook
   ═══════════════════════════════════════════════════════ */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, isVisible];
}

/* ═══════════════════════════════════════════════════════
   Animated Counter
   ═══════════════════════════════════════════════════════ */
function AnimatedCounter({ target, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [ref, isVisible] = useInView(0.3);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════
   Auth Modal
   ═══════════════════════════════════════════════════════ */
function AuthModal({ view, setView }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("Founder");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setAuthError("");
    setOtpError("");
    if (!email) return setAuthError("Email is required");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setOtpSent(true);
      else setAuthError(data.message || "Failed to send OTP");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!fullName || !email || !password || !role || !otp) {
      return setAuthError("All fields and OTP are required");
    }
    setLoading(true);
    try {
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        setOtpError(verifyData.message || "Invalid OTP");
        setLoading(false);
        return;
      }
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role, otp }),
      });
      const signupData = await signupRes.json();
      if (signupData.success) login(signupData.token, signupData.user);
      else setAuthError(signupData.message || "Signup failed");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    if (!email || !password) return setAuthError("Email and password required");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) login(data.token, data.user);
      else setAuthError(data.message || "Login failed");
    } catch {
      setAuthError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (view !== "login" && view !== "signup") return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => setView("landing")} />
      <div className="relative w-full max-w-md animate-scale-in" style={{ opacity: 0, animationFillMode: "forwards" }}>
        <div className="bg-white border border-zinc-200 p-8 relative shadow-2xl">
          {/* Top line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-black/10" />

          <button onClick={() => setView("landing")} className="absolute top-5 right-5 text-zinc-400 hover:text-black transition p-1">
            <X className="w-5 h-5" />
          </button>

          <div className="mb-8">
            <p className="text-xs uppercase tracking-wider text-zinc-700 font-bold mb-2">
              {view === "login" ? "Sign In" : "Create Account"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-black">
              {view === "login" ? "Welcome back" : "Get started"}
            </h2>
          </div>

          {authError && (
            <div className="flex gap-2.5 items-center p-3.5 mb-6 text-sm font-semibold text-red-800 bg-red-100/90 border border-red-300 rounded-lg shadow-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {view === "login" ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type="email" required placeholder="you@gmail.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-field input-field-icon" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input type={showPassword ? "text" : "password"} required placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="input-field input-field-icon" style={{ paddingRight: "44px" }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                {loading ? "Signing in..." : "Sign In"}
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="text-center mt-2">
                <span className="text-xs font-medium text-zinc-700">Don't have an account? </span>
                <button type="button" onClick={() => { setAuthError(""); setView("signup"); }} className="text-xs text-black font-bold hover:underline">
                  Sign Up
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={otpSent ? handleSignup : handleSendOtp} className="flex flex-col gap-5">
              {!otpSent ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}
                      className="input-field cursor-pointer">
                      <option value="Founder">Founder — seeking funding</option>
                      <option value="Investor">Investor — seeking opportunities</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type="email" required placeholder="you@gmail.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        className="input-field input-field-icon" />
                    </div>
                    <span className="text-xs font-medium text-zinc-700">Only @gmail.com emails supported.</span>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                    {loading ? "Sending..." : "Send Verification Code"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div className="flex gap-2.5 items-center p-3.5 text-xs font-semibold text-emerald-900 border border-emerald-300 bg-emerald-100/90 rounded-lg shadow-sm">
                    <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    <span>OTP sent to <b className="text-black">{email}</b></span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Full Name</label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type="text" required placeholder="John Doe"
                        value={fullName} onChange={(e) => setFullName(e.target.value)}
                        className="input-field input-field-icon" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Password</label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input type={showPassword ? "text" : "password"} required placeholder="Min. 8 chars"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className="input-field input-field-icon" style={{ paddingRight: "44px" }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs uppercase tracking-wider text-zinc-800 font-bold">Verification Code</label>
                    <input type="text" required maxLength={6} placeholder="000000"
                      value={otp} onChange={(e) => setOtp(e.target.value)}
                      className="input-field text-center tracking-[0.5em] font-mono text-lg" />
                    {otpError && <span className="text-xs font-bold text-red-600 mt-1">{otpError}</span>}
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary mt-2 flex items-center justify-center gap-2 text-sm disabled:opacity-50">
                    {loading ? "Creating account..." : "Complete Sign Up"}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setOtpSent(false)} className="text-xs font-bold text-zinc-700 hover:text-black text-center">
                    ← Change email
                  </button>
                </>
              )}
              <div className="text-center mt-1">
                <span className="text-xs font-medium text-zinc-700">Already have an account? </span>
                <button type="button" onClick={() => { setAuthError(""); setView("login"); }} className="text-xs text-black font-bold hover:underline">
                  Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Swirling Strings Loading Screen
   ═══════════════════════════════════════════════════════ */
function LoadingScreen({ onComplete }) {
  const backCanvasRef = useRef(null);
  const frontCanvasRef = useRef(null);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const duration = 950; // Fast intro; the swirl motion itself stays calm.
    let exitTimer;

    const finishTimer = setTimeout(() => {
      setIsExiting(true);
      exitTimer = setTimeout(() => {
        if (onComplete) onComplete();
      }, 250); // Quick fade so loading does not feel delayed.
    }, duration);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(exitTimer);
    };
  }, [onComplete]);

  useEffect(() => {
    const backCanvas = backCanvasRef.current;
    const frontCanvas = frontCanvasRef.current;
    if (!backCanvas || !frontCanvas) return;

    const backCtx = backCanvas.getContext("2d");
    const frontCtx = frontCanvas.getContext("2d");

    let animationFrameId;
    let width = (backCanvas.width = frontCanvas.width = window.innerWidth);
    let height = (backCanvas.height = frontCanvas.height = window.innerHeight);

    const handleResize = () => {
      if (!backCanvas || !frontCanvas) return;
      width = backCanvas.width = frontCanvas.width = window.innerWidth;
      height = backCanvas.height = frontCanvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Centered swirl, kept airy by slowing the motion instead of changing the path.
    const strings = [
      { color: "#2563eb", targetX: 280, targetY: 76, targetZ: 155, phaseOffset: 0.00, speed: 0.070, trailLength: 52, thickness: 4.0 },
      { color: "#0d9488", targetX: 300, targetY: 84, targetZ: 165, phaseOffset: 0.35, speed: 0.073, trailLength: 54, thickness: 3.8 },
      { color: "#059669", targetX: 260, targetY: 68, targetZ: 145, phaseOffset: 0.70, speed: 0.068, trailLength: 50, thickness: 3.6 },
      { color: "#6366f1", targetX: 320, targetY: 92, targetZ: 175, phaseOffset: 1.05, speed: 0.071, trailLength: 54, thickness: 3.5 },
      { color: "#0891b2", targetX: 340, targetY: 98, targetZ: 185, phaseOffset: 1.40, speed: 0.074, trailLength: 56, thickness: 3.6 }
    ];

    let t = 0;
    const baseTilt = 0.28;

    const render = () => {
      t += 0.016; // Slower than the previous 0.024 for a calmer swirl.

      backCtx.clearRect(0, 0, width, height);
      frontCtx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const spreadFactor = Math.min(1.15, Math.pow(Math.min(1, (t + 1.6) / 4.8), 1.6));

      strings.forEach((str) => {
        const points = [];
        const effRadiusX = 140 + (str.targetX - 140) * spreadFactor;
        const effRadiusY = 22 + (str.targetY - 22) * spreadFactor;
        const effRadiusZ = 110 + (str.targetZ - 110) * spreadFactor;
        const effPhase = str.phaseOffset * spreadFactor;

        for (let i = 0; i < str.trailLength; i++) {
          const timeOffset = t - i * 0.028;
          const orbitAngle = (timeOffset / 0.038) * str.speed - effPhase;

          const x3d = Math.cos(orbitAngle) * effRadiusX;
          const y3d = Math.sin(orbitAngle) * effRadiusY;
          const z3d = Math.sin(orbitAngle) * effRadiusZ;

          const cosTilt = Math.cos(baseTilt);
          const sinTilt = Math.sin(baseTilt);
          const rx = x3d * cosTilt - y3d * sinTilt;
          const ry = x3d * sinTilt + y3d * cosTilt;

          const perspective = 400 / (400 - z3d * 0.6);
          const screenX = centerX + rx * perspective;
          const screenY = centerY + ry * perspective;

          points.push({
            x: screenX,
            y: screenY,
            z: z3d,
            alpha: Math.max(0, 1 - i / str.trailLength),
            perspective
          });
        }

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const avgZ = (p1.z + p2.z) / 2;
          const ctx = avgZ < 0 ? backCtx : frontCtx;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);

          ctx.lineWidth = Math.max(0.8, str.thickness * p1.perspective * Math.pow(p1.alpha, 0.75));
          ctx.lineCap = "round";

          ctx.strokeStyle = str.color;
          ctx.globalAlpha = p1.alpha * (avgZ < 0 ? 0.7 : 0.98);

          if (avgZ >= 0 && i < 16) {
            ctx.shadowColor = str.color;
            ctx.shadowBlur = (spreadFactor < 0.3 ? 22 : 14) * p1.alpha;
          } else {
            ctx.shadowBlur = 0;
          }

          ctx.stroke();
        }

        backCtx.globalAlpha = 1;
        frontCtx.globalAlpha = 1;
        backCtx.shadowBlur = 0;
        frontCtx.shadowBlur = 0;

        if (points.length > 0) {
          const head = points[0];
          const ctx = head.z < 0 ? backCtx : frontCtx;
          ctx.beginPath();
          ctx.arc(head.x, head.y, (str.thickness * 1.45) * head.perspective, 0, Math.PI * 2);
          ctx.fillStyle = str.color;
          ctx.globalAlpha = head.z < 0 ? 0.85 : 1;
          if (head.z >= 0) {
            ctx.shadowColor = str.color;
            ctx.shadowBlur = 20;
          }
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white select-none overflow-hidden transition-all duration-450 ease-in-out ${isExiting ? "opacity-0 pointer-events-none scale-105" : "opacity-100 scale-100"
        }`}
    >
      <canvas
        ref={backCanvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Only StartupSync text, nothing else */}
      <div className="relative z-20 flex items-center justify-center text-center px-6 pointer-events-none">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-black flex items-center gap-1 select-none">
          StartupSync<span className="text-[#0d9488]">.</span>
        </h1>
      </div>

      <canvas
        ref={frontCanvasRef}
        className="absolute inset-0 pointer-events-none z-30"
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════ */
export default function Home() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("landing");
  const [role, setRole] = useState("Founder");
  const [scrollY, setScrollY] = useState(0);

  const [showCookiePopup, setShowCookiePopup] = useState(false);
  const [showWaitlistPopup, setShowWaitlistPopup] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("reset") === "true") {
        localStorage.removeItem("startupsync_cookie_consent");
        localStorage.removeItem("startupsync_waitlist_seen");
        try {
          window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {}
      }
      if (!localStorage.getItem("startupsync_cookie_consent")) {
        setShowCookiePopup(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!loading && typeof window !== "undefined") {
      if (!localStorage.getItem("startupsync_waitlist_seen")) {
        const timer = setTimeout(() => {
          setShowWaitlistPopup(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [loading]);

  const handleCookieConsent = (accepted) => {
    localStorage.setItem("startupsync_cookie_consent", accepted ? "accepted" : "declined");
    setShowCookiePopup(false);
  };

  const closeWaitlist = () => {
    localStorage.setItem("startupsync_waitlist_seen", "true");
    setShowWaitlistPopup(false);
  };

  const handleJoinWaitlist = (e) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistSubmitted(true);
    localStorage.setItem("startupsync_waitlist_seen", "true");
    setTimeout(() => {
      setShowWaitlistPopup(false);
    }, 2200);
  };

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection observer for section reveals
  useEffect(() => {
    const sections = document.querySelectorAll(".section-reveal");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.1 }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  // Typewriter state & effect
  const words = ["opportunity.", "investors.", "capital.", "growth."];
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timer;
    const currentFullWord = words[currentWordIndex];

    const handleType = () => {
      if (!isDeleting) {
        setTypedText(currentFullWord.substring(0, typedText.length + 1));
        if (typedText === currentFullWord) {
          timer = setTimeout(() => setIsDeleting(true), 2000);
          return;
        }
      } else {
        setTypedText(currentFullWord.substring(0, typedText.length - 1));
        if (typedText === "") {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
          return;
        }
      }
    };

    const speed = isDeleting ? 40 : 85;
    timer = setTimeout(handleType, speed);
    return () => clearTimeout(timer);
  }, [typedText, isDeleting, currentWordIndex]);

  const features = [
    { icon: Target, title: "Smart Matching", desc: "Algorithms match founders with investors based on industry, stage, and strategic alignment.", colorClass: "text-[#2563eb]" },
    { icon: MessageSquare, title: "Real-Time Chat", desc: "Encrypted messaging with read receipts. Share decks, schedule calls, negotiate terms.", colorClass: "text-[#0d9488]" },
    { icon: Shield, title: "Verified Profiles", desc: "OTP verification and admin moderation ensure a trustworthy ecosystem.", colorClass: "text-[#059669]" },
    { icon: Zap, title: "Instant Connections", desc: "Express interest with one tap. Mutual matches open direct chat immediately.", colorClass: "text-[#0891b2]" },
    { icon: Globe, title: "Explore Startups", desc: "Browse curated profiles, filter by industry and stage, discover portfolio additions.", colorClass: "text-[#2563eb]" },
    { icon: Users, title: "Network Management", desc: "Track connections, manage inbox, revisit skipped profiles, grow strategically.", colorClass: "text-[#0d9488]" },
  ];

  const steps = [
    { num: "01", title: "Create Profile", desc: "Sign up, verify your email, and build your startup profile or investment thesis.", icon: UserIcon },
    { num: "02", title: "Discover & Match", desc: "Browse curated profiles. Show interest to send a request, or skip to the next.", icon: Search },
    { num: "03", title: "Connect & Close", desc: "Mutual matches unlock encrypted chat. Share pitches, discuss terms, close deals.", icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black/5">
      {/* ═══ Swirling Strings Loading Screen ═══ */}
      {loading && <LoadingScreen onComplete={() => setLoading(false)} />}

      {/* ═══ Auth Modal ═══ */}
      <AuthModal view={view} setView={setView} />

      {/* ═══════════════════════════════════════════════
           HEADER
         ═══════════════════════════════════════════════ */}
      <header
        className={`fixed z-50 transition-all duration-500 ${scrollY > 200
          ? "header-collapsed bg-white/80"
          : "top-0 left-0 right-0 w-full"
          }`}
        style={
          scrollY <= 200
            ? {
              background: "rgba(255, 255, 255, 0.75)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
            }
            : {}
        }
      >
        <div className="header-inner max-w-[1400px] mx-auto px-6 lg:px-12 h-16">
          <div
            className="flex items-center gap-2.5 cursor-pointer shrink-0 logo-container"
            onClick={() => {
              setView("landing");
              if (typeof window !== "undefined") {
                if (window.location.pathname !== "/") window.location.href = "/";
                else window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
          >
            <img src="/logo.png" alt="StartupSync" className="h-6 w-auto object-contain shrink-0 header-expanded-content" />
            <span className="text-xl font-bold tracking-tight text-black">
              StartupSync.
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-zinc-700 font-semibold header-expanded-content">
            <a href="/features" className="hover:text-[#2563eb] transition-colors duration-200">Features</a>
            <a href="/how-it-works" className="hover:text-[#2563eb] transition-colors duration-200">How It Works</a>
            <a href="/for-you" className="hover:text-[#2563eb] transition-colors duration-200">For You</a>
          </nav>

          <div className="flex items-center gap-4 header-expanded-content">
            <button
              onClick={() => setView("login")}
              className="text-sm font-semibold text-zinc-700 hover:text-black transition-colors duration-200"
            >
              Sign In
            </button>
            <button
              onClick={() => setView("signup")}
              className="btn-primary text-sm py-2.5 px-5 shrink-0 shadow-sm"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════
           HERO
         ═══════════════════════════════════════════════ */}
      <section className="relative h-screen min-h-[650px] flex items-center overflow-hidden">
        {/* Full-width Video Background */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="/heroanimation.mp4" type="video/mp4" />
          </video>
          {/* White gradient fade from left to right */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 35%, rgba(255,255,255,0.5) 60%, rgba(255,255,255,0) 85%)"
            }}
          />
        </div>

        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10 w-full pt-20">
          <div className="max-w-3xl">
            {/* Label */}
            <p
              className="text-xs uppercase tracking-[0.2em] bg-teal-50 text-teal-800 border border-teal-200/80 font-bold px-3.5 py-1.5 rounded-full inline-block mb-6 shadow-sm animate-fade-in"
              style={{ opacity: 0, animationFillMode: "forwards" }}
            >
              The Startup Investment Platform
            </p>

            {/* Headline */}
            <h1
              className="text-[clamp(2.5rem,6vw,5rem)] font-bold tracking-[-0.03em] leading-[1.15] text-black mb-8 animate-slide-up delay-100"
              style={{ opacity: 0, animationFillMode: "forwards" }}
            >
              Where founders
              <br />
              meet <span className="typewriter-caret pr-1">{typedText}</span>
            </h1>

            {/* Subtitle */}
            <p
              className="text-base sm:text-lg bg-transparent text-zinc-800 font-medium leading-relaxed mb-12 max-w-xl animate-slide-up delay-200"
              style={{ opacity: 100, animationFillMode: "forwards" }}
            >
              The premier platform connecting visionary startup founders with strategic investors. Real-time matching, secure messaging, verified connections.
            </p>

            {/* CTA Buttons */}
            <div
              className="flex flex-wrap gap-4 animate-slide-up delay-300"
              style={{ opacity: 0, animationFillMode: "forwards" }}
            >
              <button
                onClick={() => { setRole("Founder"); setView("signup"); }}
                className="btn-primary flex items-center gap-3 text-[15px] shadow-lg"
              >
                Launch as Founder
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setRole("Investor"); setView("signup"); }}
                className="btn-outline bg-white flex items-center gap-3 text-[15px] shadow-lg border border-zinc-300"
              >
                Explore as Investor
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scroll indicator */}
          <div
            className="mt-16 lg:mt-24 flex items-center gap-4 animate-fade-in delay-500"
            style={{ opacity: 0, animationFillMode: "forwards" }}
          >
            <div className="w-px h-12 bg-zinc-400" />
            <span className="text-xs uppercase tracking-[0.2em] text-zinc-700 font-bold">
              Scroll to explore
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           STATS
         ═══════════════════════════════════════════════ */}
      <section className="relative z-10 border-y border-zinc-200 bg-zinc-50/20 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left — Stats Grid */}
            <div className="lg:col-span-7 grid grid-cols-2 gap-6 sm:gap-8">
              {[
                { value: 2500, suffix: "+", label: "Active Founders", color: "text-[#2563eb]" },
                { value: 800, suffix: "+", label: "Verified Investors", color: "text-[#0d9488]" },
                { value: 15, suffix: "M+", label: "Funding Facilitated", color: "text-[#059669]" },
                { value: 94, suffix: "%", label: "Match Rate", color: "text-[#0891b2]" },
              ].map((stat, i) => (
                <div key={i} className="p-6 bg-white border border-zinc-300 shadow-md rounded-2xl">
                  <p className={`text-3xl sm:text-4xl font-bold tracking-tight mb-1 ${stat.color}`}>
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-xs uppercase tracking-wider text-zinc-800 font-extrabold">{stat.label}</p>
                </div>
              ))}
            </div>
            {/* Right — Image */}
            <div className="lg:col-span-5 border border-zinc-200 bg-zinc-50 aspect-[4/3] flex items-center justify-center relative overflow-hidden group">
              <img src="/stats-mockup.jpg" alt="Stats illustration" className="cta-scroll-image w-full h-full object-cover opacity-90 group-hover:opacity-100" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           FEATURES
         ═══════════════════════════════════════════════ */}
      <section id="features" className="relative z-10 py-24 sm:py-32 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          {/* Section header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16">
            <div>
              <p className="text-xs uppercase tracking-wider bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 font-bold px-3 py-1 rounded-full inline-block mb-4">Platform Features</p>
              <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em]">
                Built for the modern<br className="hidden sm:block" /> startup ecosystem.
              </h2>
            </div>
            <p className="text-zinc-700 font-medium text-base max-w-md leading-relaxed lg:text-right">
              Every feature designed to make founder–investor connections seamless, secure, and efficient.
            </p>
          </div>

          <div className="divider mb-12" />

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Left — 6-Card Grid */}
            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-6">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="bg-white border border-zinc-200 p-8 rounded-2xl group hover:bg-zinc-50/80 hover:border-zinc-400 transition-all duration-300 shadow-sm hover:shadow-md">
                    <Icon className={`w-5 h-5 mb-6 ${f.colorClass}`} />
                    <h3 className="text-lg font-bold text-black mb-3 tracking-tight">{f.title}</h3>
                    <p className="text-[15px] text-zinc-700 font-medium leading-relaxed">{f.desc}</p>
                  </div>
                );
              })}
            </div>
            {/* Right — Big Features Image */}
            <div className="lg:col-span-5 border border-zinc-200 bg-zinc-50 p-6 flex flex-col justify-between overflow-hidden group min-h-[450px] relative">
              <div className="relative z-10 mb-6">
                <span className="text-[10px] uppercase tracking-wider text-[#0d9488] font-bold">Platform Preview</span>
                <h4 className="text-lg font-bold tracking-tight text-black mt-1">Interactive Match Deck</h4>
              </div>
              <div className="flex-1 flex items-center justify-center overflow-hidden">
                <img src="/downloadftr.jpg" alt="Features preview" className="cta-scroll-image w-full h-auto object-contain border border-zinc-200 shadow-md" />
              </div>
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <a
              href="/features"
              className="py-3.5 px-8 bg-zinc-900 hover:bg-black text-white text-sm font-bold rounded-xl shadow-lg transition flex items-center gap-2 group"
            >
              <span>Explore Complete Features & Capabilities Guide</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           HOW IT WORKS
         ═══════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 py-24 sm:py-32 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-wider bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 font-bold px-3 py-1 rounded-full inline-block mb-4">How It Works</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em]">
              Three steps to your next deal.
            </h2>
          </div>

          <div className="divider mb-0" />

          <div className="grid lg:grid-cols-12 gap-12 items-start">
            {/* Steps list */}
            <div className="lg:col-span-7">
              {steps.map((step, i) => {
                const Icon = step.icon;
                // Cycle through steps with logo color tints
                const textColors = ["text-[#2563eb]", "text-[#0d9488]", "text-[#059669]"];
                const bgWatermarks = [
                  "text-blue-100/50 group-hover:text-blue-200/50",
                  "text-teal-100/50 group-hover:text-teal-200/50",
                  "text-emerald-100/50 group-hover:text-emerald-200/50"
                ];
                return (
                  <div key={i} className="border-b border-zinc-200 py-10 sm:py-14 group">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-12">
                      <span className={`text-6xl sm:text-7xl font-bold transition-colors duration-500 tabular-nums shrink-0 w-24 ${bgWatermarks[i]}`}>
                        {step.num}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Icon className={`w-4 h-4 ${textColors[i]}`} />
                          <h3 className="text-xl font-bold tracking-tight text-black">{step.title}</h3>
                        </div>
                        <p className="text-zinc-700 font-medium text-[15px] leading-relaxed max-w-lg">{step.desc}</p>
                      </div>
                      <ArrowRight className={`w-5 h-5 text-zinc-300 group-hover:translate-x-1 transition-all duration-300 hidden sm:block group-hover:${textColors[i]}`} />
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Steps Workflow Image */}
            <div className="lg:col-span-5 lg:sticky lg:top-24 border border-zinc-200 bg-zinc-50 aspect-square flex items-center justify-center p-8 overflow-hidden group mt-10 lg:mt-14 shadow-sm">
              <img src="/workflow-mockup.png" alt="Workflow steps illustration" className="cta-scroll-image w-full h-full object-contain" />
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <a
              href="/how-it-works"
              className="py-3.5 px-8 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-sm font-bold rounded-xl shadow-lg transition flex items-center gap-2 group"
            >
              <span>View Deep-Dive Workflow & Architecture Blueprint</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           FOR FOUNDERS & INVESTORS
         ═══════════════════════════════════════════════ */}
      <section id="for-you" className="relative z-10 py-24 sm:py-32 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-px bg-zinc-200 border border-zinc-200">
            {/* Founders */}
            <div className="bg-white p-10 sm:p-14 group hover:bg-blue-50/5 transition-colors duration-300 flex flex-col justify-between border border-zinc-300">
              <div>
                <p className="text-xs uppercase tracking-wider bg-[#2563eb]/10 text-[#2563eb] border border-[#2563eb]/20 font-bold px-3 py-1 rounded-full inline-block mb-6">For Founders</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
                  Get discovered by<br />the right investors.
                </h3>
                <div className="my-8 border border-zinc-200 bg-zinc-50 aspect-[16/9] overflow-hidden group shadow-sm">
                  <img src="/founder.jpg" alt="Founder dashboard illustration" className="cta-scroll-image w-full h-full object-cover" />
                </div>
                <p className="text-zinc-800 font-medium text-[15px] leading-relaxed mb-8 max-w-md">
                  Showcase your startup to a curated network of angel investors and VCs who match your industry, stage, and vision.
                </p>
                <ul className="space-y-4 mb-10">
                  {["Build a rich startup profile", "Get matched with relevant investors", "Pitch directly via secure chat", "Track requests & responses"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-zinc-700">
                      <div className="w-1.5 h-1.5 bg-[#2563eb] rounded-full shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => { setRole("Founder"); setView("signup"); }}
                className="btn-primary text-[13px] py-3 px-6 flex items-center gap-2 self-start shadow-sm"
              >
                Join as Founder <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Investors */}
            <div className="bg-white p-10 sm:p-14 group hover:bg-emerald-50/5 transition-colors duration-300 flex flex-col justify-between border border-zinc-300">
              <div>
                <p className="text-xs uppercase tracking-wider bg-[#059669]/10 text-[#059669] border border-[#059669]/20 font-bold px-3 py-1 rounded-full inline-block mb-6">For Investors</p>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight mb-6">
                  Discover high-potential<br />startups.
                </h3>
                <div className="my-8 border border-zinc-200 bg-zinc-50 aspect-[16/9] overflow-hidden group shadow-sm">
                  <img src="/investors.jpg" alt="Investor dashboard illustration" className="cta-scroll-image w-full h-full object-cover" />
                </div>
                <p className="text-zinc-800 font-medium text-[15px] leading-relaxed mb-8 max-w-md">
                  Explore curated startup profiles filtered by your investment thesis. Evaluate founders, review pitches, and build your portfolio.
                </p>
                <ul className="space-y-4 mb-10">
                  {["Define your investment mandate", "Explore curated startup feed", "Receive interest from founders", "Negotiate via real-time messaging"].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-zinc-700">
                      <div className="w-1.5 h-1.5 bg-[#059669] rounded-full shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => { setRole("Investor"); setView("signup"); }}
                className="btn-outline text-[13px] py-3 px-6 flex items-center gap-2 hover:border-[#059669] self-start shadow-sm"
              >
                Join as Investor <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <a
              href="/for-you"
              className="py-3.5 px-8 bg-[#059669] hover:bg-[#047857] text-white text-sm font-bold rounded-xl shadow-lg transition flex items-center gap-2 group"
            >
              <span>Explore Founder & Investor Ecosystem Breakdown</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           TESTIMONIALS
         ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="mb-16">
            <p className="text-xs uppercase tracking-wider bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 font-bold px-3 py-1 rounded-full inline-block mb-4">Testimonials</p>
            <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em]">
              What people are saying.
            </h2>
          </div>

          <div className="divider mb-0" />

          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left — Quotes */}
            <div className="lg:col-span-7">
              {[
                { name: "Arjun Mehta", role: "Founder, FinStack", quote: "StartupSync connected me with the perfect angel investor in under a week. The matching algorithm felt like it truly understood my startup's needs.", roleColor: "text-[#2563eb]" },
                { name: "Priya Sharma", role: "Angel Investor", quote: "As an investor, I love how easy it is to discover startups that match my thesis. The real-time chat makes due diligence seamless.", roleColor: "text-[#0d9488]" },
                { name: "Rahul Verma", role: "Founder, CloudNine AI", quote: "No spam, no noise — just serious investors ready to talk. We closed our pre-seed round through a connection made here.", roleColor: "text-[#059669]" },
              ].map((t, i) => (
                <div key={i} className="border-b border-zinc-200 py-10 sm:py-12 group">
                  <div className="flex flex-col sm:flex-row gap-6 sm:gap-12">
                    <div className="sm:w-48 shrink-0">
                      <p className="text-base font-bold text-black">{t.name}</p>
                      <p className={`text-[13px] mt-0.5 font-bold ${t.roleColor}`}>{t.role}</p>
                    </div>
                    <p className="text-zinc-800 font-medium text-base leading-relaxed flex-1">"{t.quote}"</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Right — Collage Image */}
            <div className="lg:col-span-5 border border-zinc-200 bg-zinc-50 aspect-[4/3] overflow-hidden group shadow-sm">
              <img src="/successclg.jpg" alt="Success stories collage" className="cta-scroll-image w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           FINAL CTA
         ═══════════════════════════════════════════════ */}
      <section className="relative z-10 py-24 sm:py-32 section-reveal">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="border border-zinc-300 bg-gradient-to-br from-white via-white to-blue-50/10 p-12 sm:p-20 relative overflow-hidden shadow-md rounded-3xl">
            {/* Subtle logo color gradient background orb */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-gradient-to-br from-blue-200/10 to-teal-200/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 grid lg:grid-cols-12 gap-12 items-center">
              {/* Left — CTA text */}
              <div className="lg:col-span-7">
                <p className="text-xs uppercase tracking-wider bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20 font-bold px-3 py-1 rounded-full inline-block mb-6">Get Started</p>
                <h2 className="text-3xl sm:text-5xl font-bold tracking-[-0.02em] mb-6">
                  Ready to sync up?
                </h2>
                <p className="text-zinc-800 font-medium text-base leading-relaxed mb-10 max-w-lg">
                  Join thousands of founders and investors already building the future together. Your next opportunity is one connection away.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => { setRole("Founder"); setView("signup"); }}
                    className="btn-primary flex items-center gap-3 text-[15px] shadow-md"
                  >
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setView("login")}
                    className="btn-outline flex items-center gap-3 text-[15px] hover:border-[#2563eb] shadow-sm"
                  >
                    Sign In to Dashboard
                  </button>
                </div>
              </div>

              {/* Right — CTA Image */}
              <div className="lg:col-span-5 border border-zinc-200 bg-white aspect-[4/3] shadow-md overflow-hidden group rounded-2xl">
                <img src="/W_White.jpg" alt="StartupSync Dashboard Preview" className="cta-scroll-image w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
           FOOTER
         ═══════════════════════════════════════════════ */}
      <footer className="relative z-10 border-t border-zinc-200 py-10">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => {
                setView("landing");
                if (typeof window !== "undefined") {
                  if (window.location.pathname !== "/") window.location.href = "/";
                  else window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              <img src="/logo.png" alt="StartupSync" className="h-5 w-auto object-contain" />
              <span className="text-[15px] font-bold tracking-tight text-black">
                StartupSync
              </span>
            </div>
            <div className="flex items-center gap-8 text-[14px] text-zinc-600 font-semibold flex-wrap justify-center">
              <button
                onClick={() => setLoading(true)}
                className="hover:text-black transition-colors flex items-center gap-1.5 text-[#0d9488] font-bold"
              >
                ✨ Replay Intro
              </button>
              <button
                onClick={() => setShowCookiePopup(true)}
                className="hover:text-[#2563eb] transition-colors font-bold"
              >
                🍪 Cookies
              </button>
              <button
                onClick={() => setShowWaitlistPopup(true)}
                className="hover:text-[#2563eb] transition-colors font-bold"
              >
                🚀 Waitlist
              </button>
              <a href="/features" className="hover:text-[#2563eb] transition-colors">Features</a>
              <a href="/how-it-works" className="hover:text-[#2563eb] transition-colors">How It Works</a>
              <a href="/for-you" className="hover:text-[#2563eb] transition-colors">For You</a>
            </div>
            <p className="text-xs text-zinc-600 font-medium">
              © {new Date().getFullYear()} StartupSync
            </p>
          </div>
        </div>
      </footer>

      {/* ═══ Cookie Consent Pop-up ═══ */}
      {showCookiePopup && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 bg-white border border-zinc-300 text-black p-6 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-50 animate-fade-in flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[#2563eb] font-bold text-sm">
              <Shield className="w-4 h-4 shrink-0" />
              <span>Cookie & Privacy Policy</span>
            </div>
            <button onClick={() => handleCookieConsent(false)} className="text-zinc-400 hover:text-black p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-zinc-700 leading-relaxed font-medium">
            We use cookies to improve your experience on StartupSync. By using our site, you agree to our cookie policy.
          </p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => handleCookieConsent(true)}
              className="flex-1 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
            >
              Accept Cookies
            </button>
            <button
              onClick={() => handleCookieConsent(false)}
              className="py-2.5 px-4 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 text-zinc-800 text-xs font-semibold rounded-xl transition"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* ═══ Priority Waitlist Pop-up ═══ */}
      {showWaitlistPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-zinc-300 rounded-3xl p-8 max-w-md w-full shadow-[0_25px_60px_rgba(0,0,0,0.18)] relative text-black overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#2563eb]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#0d9488]/10 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={closeWaitlist}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-400 hover:text-black hover:bg-zinc-100 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-[#2563eb]/10 border border-[#2563eb]/20 flex items-center justify-center text-[#2563eb] mb-5">
                <Rocket className="w-6 h-6" />
              </div>

              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-black mb-2 leading-snug">
                Get notified first when StartupSync goes live!
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 mb-6 leading-relaxed font-medium">
                Join 1,400+ top founders and angel investors on the exclusive priority access waitlist.
              </p>

              {waitlistSubmitted ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-5 text-center space-y-2 animate-fade-in">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-emerald-900">You're on the priority list!</h4>
                  <p className="text-xs text-emerald-700">We'll reach out to <strong className="text-emerald-950">{waitlistEmail}</strong> right before launch.</p>
                </div>
              ) : (
                <form onSubmit={handleJoinWaitlist} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-700 uppercase tracking-wider mb-1.5">
                      Work / Founder Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                      <input
                        type="email"
                        required
                        placeholder="name@startup.com"
                        value={waitlistEmail}
                        onChange={(e) => setWaitlistEmail(e.target.value)}
                        className="w-full bg-zinc-50 border border-zinc-300 rounded-xl pl-10 pr-4 py-3 text-sm text-black placeholder-zinc-400 focus:outline-none focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb] transition font-medium"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold rounded-xl shadow-sm text-xs sm:text-sm transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>Join Priority Waitlist</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <p className="text-[10px] text-zinc-500 text-center font-medium pt-1">
                    No spam, ever. Unsubscribe at any time with one click.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
