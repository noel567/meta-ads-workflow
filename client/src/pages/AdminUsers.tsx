import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  UserCog, Plus, Trash2, KeyRound, ArrowLeft, Shield, User, Loader2, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [, navigate] = useLocation();

  // Redirect non-admins
  if (currentUser && currentUser.role !== "admin") {
    navigate("/");
    return null;
  }

  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.adminUsers.list.useQuery();

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [showNewPw, setShowNewPw] = useState(false);

  const createMutation = trpc.adminUsers.create.useMutation({
    onSuccess: () => {
      toast.success("User erstellt");
      utils.adminUsers.list.invalidate();
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewName(""); setNewRole("user");
    },
    onError: (e) => toast.error(e.message),
  });

  // Reset password dialog
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);

  const resetMutation = trpc.adminUsers.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("Passwort zurückgesetzt");
      setResetUserId(null); setResetPw("");
    },
    onError: (e) => toast.error(e.message),
  });

  // Delete user
  const deleteMutation = trpc.adminUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("User gelöscht");
      utils.adminUsers.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout>
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><div className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">User-Verwaltung</h1>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer User
        </Button>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name / Username</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">E-Mail</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Rolle</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Login-Methode</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Erstellt</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  Noch keine User vorhanden
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{u.name || u.username || "—"}</p>
                      {u.username && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                <td className="px-4 py-3">
                  {u.role === "admin" ? (
                    <Badge variant="default" className="gap-1 text-xs">
                      <Shield className="h-3 w-3" /> Admin
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">User</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{u.loginMethod || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {new Date(u.createdAt).toLocaleDateString("de-CH")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {u.loginMethod === "password" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title="Passwort zurücksetzen"
                        onClick={() => { setResetUserId(u.id); setResetPw(""); }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {u.id !== currentUser?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="User löschen"
                        onClick={() => {
                          if (confirm(`User "${u.name || u.username}" wirklich löschen?`)) {
                            deleteMutation.mutate({ userId: u.id });
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Neuen User erstellen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Benutzername <span className="text-destructive">*</span></Label>
              <Input
                value={newUsername}
                onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="max_mustermann"
              />
              <p className="text-xs text-muted-foreground">Nur Kleinbuchstaben, Zahlen und _</p>
            </div>
            <div className="space-y-1.5">
              <Label>Anzeigename</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Passwort <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Rolle</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "user" | "admin")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button
              onClick={() => createMutation.mutate({ username: newUsername, password: newPassword, name: newName || undefined, role: newRole })}
              disabled={!newUsername || !newPassword || newPassword.length < 6 || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetUserId !== null} onOpenChange={(o) => { if (!o) { setResetUserId(null); setResetPw(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Passwort zurücksetzen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Neues Passwort <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showResetPw ? "text" : "password"}
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetUserId(null); setResetPw(""); }}>Abbrechen</Button>
            <Button
              onClick={() => resetMutation.mutate({ userId: resetUserId!, newPassword: resetPw })}
              disabled={!resetPw || resetPw.length < 6 || resetMutation.isPending}
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Zurücksetzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </DashboardLayout>
  );
}
