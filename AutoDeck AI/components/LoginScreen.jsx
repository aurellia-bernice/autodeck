
// Login Screen — AutoDeck AI
// Two-panel layout: brand left, sign-in form right.
// Props:
//   onLogin(userData) — called after successful sign-in or SSO click

const COLORS_LOGIN = {
  deepPurple: "#1A0530",
  richPurple: "#2D0A4E",
  vibrantPurple: "#7B2FBE",
  magenta: "#D946A8",
  gold: "#F5A623",
  white: "#FFFFFF",
  lightGray: "#F5F5F7",
  muted: "#9B8FB0",
  inputBg: "rgba(123, 47, 190, 0.08)",
  inputBorder: "rgba(123, 47, 190, 0.2)",
};

function GemParticles() {
  const canvasRef = React.useRef(null);
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    const particles = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();
    window.addEventListener("resize", resize);
    const cols = ["#7B2FBE", "#D946A8", "#F5A623", "#9B6FD9"];
    for (let i = 0; i < 30; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.4 + 0.1,
        color: cols[Math.floor(Math.random() * cols.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      particles.forEach((p) => {
        p.x += p.speedX; p.y += p.speedY; p.pulse += p.pulseSpeed;
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y < 0) p.y = canvas.offsetHeight;
        if (p.y > canvas.offsetHeight) p.y = 0;
        const op = p.opacity * (0.6 + Math.sin(p.pulse) * 0.4);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = op;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); };
  }, []);
  return (
    <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
  );
}

function LoginGemIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="lgGemGrad" x1="0" y1="0" x2="32" y2="32">
          <stop offset="0%" stopColor="#D946A8" />
          <stop offset="50%" stopColor="#7B2FBE" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>
      </defs>
      <path d="M16 2L28 12L16 30L4 12L16 2Z" fill="url(#lgGemGrad)" opacity="0.9" />
      <path d="M16 2L28 12L16 14L4 12L16 2Z" fill="white" opacity="0.25" />
      <path d="M8 12L16 14L16 30L4 12L8 12Z" fill="black" opacity="0.1" />
    </svg>
  );
}

function EyeToggleIcon({ visible }) {
  if (visible) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B8FB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9B8FB0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const LoginScreen = ({ onLogin }) => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [focusedField, setFocusedField] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (onLogin) onLogin({ email });
    }, 1800);
  };

  const C = COLORS_LOGIN;

  return (
    <div style={{ minHeight: "100vh", width: "100%", display: "flex", fontFamily: "'Calibri', 'Segoe UI', sans-serif", background: C.deepPurple, overflow: "hidden" }}>
      {/* Left panel */}
      <div style={{ flex: "0 0 48%", background: `linear-gradient(160deg, ${C.deepPurple} 0%, ${C.richPurple} 40%, #3D1270 100%)`, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", position: "relative", padding: "60px", overflow: "hidden" }}>
        <GemParticles />
        <div style={{ position: "absolute", top: "-15%", right: "-10%", width: "500px", height: "500px", borderRadius: "50%", background: `radial-gradient(circle, ${C.magenta}22 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", left: "-15%", width: "600px", height: "600px", borderRadius: "50%", background: `radial-gradient(circle, ${C.vibrantPurple}18 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "420px", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(30px)", transition: "all 0.8s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "56px" }}>
            <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
              <LoginGemIcon size={26} />
            </div>
            <div>
              <span style={{ fontSize: "20px", fontWeight: 800, color: C.white, letterSpacing: "-0.02em" }}>AutoDeck</span>
              <span style={{ fontSize: "20px", fontWeight: 800, background: `linear-gradient(135deg, ${C.magenta}, ${C.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginLeft: "6px", letterSpacing: "-0.02em" }}>AI</span>
            </div>
          </div>

          <h1 style={{ fontSize: "44px", fontWeight: 800, color: C.white, lineHeight: 1.1, letterSpacing: "-0.03em", margin: "0 0 20px 0" }}>
            Branded decks,<br />
            <span style={{ background: `linear-gradient(135deg, ${C.magenta}, ${C.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>zero effort.</span>
          </h1>
          <p style={{ fontSize: "16px", lineHeight: 1.65, color: C.muted, margin: "0 0 48px 0", maxWidth: "360px" }}>
            Paste your notes, upload a document, and get a perfectly branded Quidax presentation in seconds.
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {["Brand-compliant", "AI-powered", "Secure & private"].map((label, i) => (
              <div key={label} style={{ padding: "8px 16px", borderRadius: "100px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)", fontSize: "13px", fontWeight: 500, opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: `all 0.6s cubic-bezier(0.16,1,0.3,1) ${0.4 + i * 0.1}s` }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "absolute", bottom: "32px", left: "60px", display: "flex", alignItems: "center", gap: "8px", opacity: 0.4 }}>
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="white" fillOpacity="0.5" />
            <text x="7" y="23" fontSize="18" fontWeight="800" fill="#2D0A4E">Q</text>
          </svg>
          <span style={{ fontSize: "12px", color: C.white, letterSpacing: "0.04em" }}>Quidax Internal Tool</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", background: C.lightGray, padding: "60px", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "300px", background: `linear-gradient(180deg, ${C.vibrantPurple}06 0%, transparent 100%)`, pointerEvents: "none" }} />

        <div style={{ width: "100%", maxWidth: "400px", position: "relative", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800, color: C.richPurple, margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>Sign in</h2>
          <p style={{ fontSize: "15px", color: "#7A7090", margin: "0 0 36px 0", lineHeight: 1.5 }}>Use your Quidax work email to continue</p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.richPurple, marginBottom: "8px", letterSpacing: "0.01em" }}>Work email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="you@quidax.com"
                style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: `1.5px solid ${focusedField === "email" ? C.vibrantPurple : C.inputBorder}`, background: focusedField === "email" ? "#FFFFFF" : C.inputBg, fontSize: "15px", color: C.richPurple, outline: "none", transition: "all 0.2s ease", boxShadow: focusedField === "email" ? `0 0 0 3px ${C.vibrantPurple}15` : "none", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: C.richPurple, marginBottom: "8px", letterSpacing: "0.01em" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your password"
                  style={{ width: "100%", padding: "14px 48px 14px 16px", borderRadius: "12px", border: `1.5px solid ${focusedField === "password" ? C.vibrantPurple : C.inputBorder}`, background: focusedField === "password" ? "#FFFFFF" : C.inputBg, fontSize: "15px", color: C.richPurple, outline: "none", transition: "all 0.2s ease", boxShadow: focusedField === "password" ? `0 0 0 3px ${C.vibrantPurple}15` : "none", boxSizing: "border-box" }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}>
                  <EyeToggleIcon visible={showPassword} />
                </button>
              </div>
            </div>

            <div style={{ textAlign: "right", marginBottom: error ? "16px" : "32px" }}>
              <a href="#" onClick={e => e.preventDefault()} style={{ fontSize: "13px", color: C.vibrantPurple, textDecoration: "none", fontWeight: 500 }}
                onMouseEnter={e => e.target.style.textDecoration = "underline"}
                onMouseLeave={e => e.target.style.textDecoration = "none"}>
                Forgot password?
              </a>
            </div>

            {error && (
              <div style={{ marginBottom: "20px", padding: "12px 16px", borderRadius: "10px", background: "rgba(217,70,168,0.08)", border: "1px solid rgba(217,70,168,0.2)", fontSize: "13px", color: "#B0186E", fontWeight: 500 }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{ width: "100%", padding: "15px", borderRadius: "12px", border: "none", background: isLoading ? C.vibrantPurple : `linear-gradient(135deg, ${C.richPurple} 0%, ${C.vibrantPurple} 50%, ${C.magenta} 100%)`, color: C.white, fontSize: "15px", fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", transition: "all 0.3s ease", letterSpacing: "0.01em", opacity: isLoading ? 0.85 : 1 }}
              onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${C.vibrantPurple}40`; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {isLoading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: "lgSpin 1s linear infinite" }}>
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </span>
              ) : "Sign in"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "28px 0" }}>
            <div style={{ flex: 1, height: "1px", background: C.inputBorder }} />
            <span style={{ fontSize: "12px", color: "#9B8FB0", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: C.inputBorder }} />
          </div>

          <button
            onClick={() => { if (onLogin) onLogin({ email: "sso-user@quidax.com", sso: true }); }}
            style={{ width: "100%", padding: "14px", borderRadius: "12px", border: `1.5px solid ${C.inputBorder}`, background: "#FFFFFF", color: C.richPurple, fontSize: "14px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", transition: "all 0.2s ease", letterSpacing: "0.01em" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.vibrantPurple; e.currentTarget.style.background = C.inputBg; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.inputBorder; e.currentTarget.style.background = "#FFFFFF"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.vibrantPurple} strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              <circle cx="12" cy="16.5" r="1" fill={C.vibrantPurple} />
            </svg>
            Continue with SSO
          </button>

          <p style={{ textAlign: "center", fontSize: "13px", color: "#9B8FB0", marginTop: "32px", lineHeight: 1.5 }}>
            Need access?{" "}
            <a href="#" onClick={e => e.preventDefault()} style={{ color: C.vibrantPurple, textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => e.target.style.textDecoration = "underline"}
              onMouseLeave={e => e.target.style.textDecoration = "none"}>
              Contact your team admin
            </a>
          </p>
        </div>
      </div>

      <style>{`@keyframes lgSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};
