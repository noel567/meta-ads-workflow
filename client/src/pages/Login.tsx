import { useState } from "react";
import { Loader2, Mail, ShieldCheck, ArrowLeft, Lock, User } from "lucide-react";

type Step = "email" | "otp";
type LoginMode = "password" | "email";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("password");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function loginWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen");
      } else {
        window.location.href = "/";
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setLoading(false);
    }
  }

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Senden des Codes");
      } else {
        setInfo(`Code wurde an ${email} gesendet`);
        setStep("otp");
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Falscher Code");
      } else {
        // Redirect to app
        window.location.href = "/";
      }
    } catch {
      setError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[oklch(0.10_0.012_250)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white tracking-tight">EasySignals</h1>
            <p className="text-sm text-gray-500 mt-0.5">Meta Ads Workflow</p>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="flex rounded-xl bg-[oklch(0.14_0.012_250)] border border-[oklch(0.22_0.015_250)] p-1 mb-4">
          <button
            onClick={() => { setMode("password"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "password" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            Passwort
          </button>
          <button
            onClick={() => { setMode("email"); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === "email" ? "bg-indigo-600 text-white shadow" : "text-gray-400 hover:text-white"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            E-Mail Code
          </button>
        </div>

        {/* Card */}
        <div className="bg-[oklch(0.14_0.012_250)] border border-[oklch(0.22_0.015_250)] rounded-2xl p-6">
          {mode === "password" ? (
            <>
              <h2 className="text-lg font-medium text-white mb-1">Anmelden</h2>
              <p className="text-sm text-gray-400 mb-6">Benutzername und Passwort eingeben.</p>
              <form onSubmit={loginWithPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Benutzername</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="benutzername"
                      required
                      autoFocus
                      autoComplete="username"
                      className="w-full bg-[oklch(0.18_0.012_250)] border border-[oklch(0.28_0.015_250)] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Passwort</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full bg-[oklch(0.18_0.012_250)] border border-[oklch(0.28_0.015_250)] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading || !username || !password}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Anmelden
                </button>
                <div className="text-center pt-1">
                  <a
                    href="/forgot-password"
                    className="text-xs text-gray-500 hover:text-indigo-400 transition-colors"
                  >
                    Passwort vergessen?
                  </a>
                </div>
              </form>
            </>
          ) : step === "email" ? (
            <>
              <h2 className="text-lg font-medium text-white mb-1">Anmelden</h2>
              <p className="text-sm text-gray-400 mb-6">
                Gib deine E-Mail-Adresse ein — wir senden dir einen Code.
              </p>

              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    E-Mail-Adresse
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="deine@email.ch"
                      required
                      autoFocus
                      className="w-full bg-[oklch(0.18_0.012_250)] border border-[oklch(0.28_0.015_250)] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Code senden
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep("email"); setError(null); setOtp(""); }}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Zurück
              </button>

              <h2 className="text-lg font-medium text-white mb-1">Code eingeben</h2>
              {info && (
                <p className="text-sm text-gray-400 mb-6">{info}</p>
              )}

              <form onSubmit={verifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    6-stelliger Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={otp}
                    onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full bg-[oklch(0.18_0.012_250)] border border-[oklch(0.28_0.015_250)] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-2xl font-mono tracking-[0.4em] text-center"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Anmelden
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(null); setOtp(""); setInfo(null); }}
                  className="w-full text-sm text-gray-400 hover:text-white transition-colors py-1"
                >
                  Neuen Code anfordern
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          EasySignals © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
