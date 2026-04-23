import { useState } from "react";
import { Loader2, Mail, ShieldCheck, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler beim Senden");
      } else {
        setSent(true);
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
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-white tracking-tight">EasySignals</h1>
            <p className="text-sm text-gray-500 mt-0.5">Meta Ads Workflow</p>
          </div>
        </div>

        <div className="bg-[oklch(0.14_0.012_250)] border border-[oklch(0.22_0.015_250)] rounded-2xl p-6">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-white mb-2">E-Mail gesendet</h2>
              <p className="text-sm text-gray-400 mb-6">
                Falls ein Konto mit <span className="text-white font-medium">{email}</span> existiert, hast du eine E-Mail mit einem Reset-Link erhalten. Der Link ist 1 Stunde gültig.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Zurück zum Login
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate("/login")}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Zurück zum Login
              </button>
              <h2 className="text-lg font-medium text-white mb-1">Passwort vergessen?</h2>
              <p className="text-sm text-gray-400 mb-6">
                Gib deine E-Mail-Adresse ein. Wir senden dir einen Link zum Zurücksetzen deines Passworts.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Reset-Link senden
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
