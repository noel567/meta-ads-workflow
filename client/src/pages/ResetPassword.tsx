import { useState, useEffect } from "react";
import { Loader2, Lock, ShieldCheck, CheckCircle2, XCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  // Extract token from URL path: /reset-password/:token
  const token = window.location.pathname.split("/reset-password/")[1] ?? "";

  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setTokenValid(false); setTokenError("Kein Token angegeben"); return; }
    fetch(`/api/auth/reset-password/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setTokenValid(true);
        else { setTokenValid(false); setTokenError(data.error ?? "Ungültiger Token"); }
      })
      .catch(() => { setTokenValid(false); setTokenError("Netzwerkfehler"); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 6) { setError("Passwort muss mindestens 6 Zeichen lang sein"); return; }
    if (newPassword !== confirmPassword) { setError("Passwörter stimmen nicht überein"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Fehler beim Zurücksetzen");
      else setSuccess(true);
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
          {tokenValid === null && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Token wird geprüft…</span>
            </div>
          )}

          {tokenValid === false && (
            <div className="text-center py-4">
              <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-white mb-2">Link ungültig</h2>
              <p className="text-sm text-gray-400 mb-6">
                {tokenError ?? "Dieser Reset-Link ist ungültig oder abgelaufen."}
              </p>
              <button
                onClick={() => navigate("/forgot-password")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Neuen Link anfordern
              </button>
            </div>
          )}

          {tokenValid === true && success && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-lg font-medium text-white mb-2">Passwort geändert</h2>
              <p className="text-sm text-gray-400 mb-6">
                Dein Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt anmelden.
              </p>
              <button
                onClick={() => navigate("/login")}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
              >
                Zum Login
              </button>
            </div>
          )}

          {tokenValid === true && !success && (
            <>
              <h2 className="text-lg font-medium text-white mb-1">Neues Passwort</h2>
              <p className="text-sm text-gray-400 mb-6">
                Wähle ein sicheres Passwort mit mindestens 6 Zeichen.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Neues Passwort
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Mindestens 6 Zeichen"
                      required
                      autoFocus
                      className="w-full bg-[oklch(0.18_0.012_250)] border border-[oklch(0.28_0.015_250)] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Passwort bestätigen
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Passwort wiederholen"
                      required
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
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Passwort zurücksetzen
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
