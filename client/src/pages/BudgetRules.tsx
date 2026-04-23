import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Play, Trash2, ChevronDown, ChevronUp, RefreshCw, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";

const METRIC_LABELS: Record<string, string> = {
  cpl: "CPL (Kosten/Lead)",
  ctr: "CTR (%)",
  cpc: "CPC (Kosten/Klick)",
  spend: "Ausgaben (CHF)",
  roas: "ROAS",
};

const CONDITION_LABELS: Record<string, string> = {
  gt: "> (grösser als)",
  lt: "< (kleiner als)",
  gte: "≥ (grösser gleich)",
  lte: "≤ (kleiner gleich)",
};

const ACTION_LABELS: Record<string, string> = {
  increase: "Budget erhöhen",
  decrease: "Budget senken",
  pause: "Kampagne pausieren",
  activate: "Kampagne aktivieren",
};

const ACTION_COLORS: Record<string, string> = {
  increase: "bg-green-500/10 text-green-400 border-green-500/20",
  decrease: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  pause: "bg-red-500/10 text-red-400 border-red-500/20",
  activate: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

type NewRule = {
  name: string;
  metric: string;
  condition: string;
  threshold: string;
  action: string;
  changePercent: string;
  maxBudgetCents: string;
  minBudgetCents: string;
  campaignId: string;
  lookbackDays: string;
  cooldownDays: string;
};

const DEFAULT_RULE: NewRule = {
  name: "",
  metric: "cpl",
  condition: "gt",
  threshold: "",
  action: "decrease",
  changePercent: "20",
  maxBudgetCents: "",
  minBudgetCents: "",
  campaignId: "",
  lookbackDays: "7",
  cooldownDays: "1",
};

export default function BudgetRules() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRule, setNewRule] = useState<NewRule>(DEFAULT_RULE);
  const [showLog, setShowLog] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<number | null>(null);
  const [runAllConfirm, setRunAllConfirm] = useState(false);

  const { data: rules = [], isLoading: rulesLoading } = trpc.budgetRules.list.useQuery();
  const { data: campaigns = [] } = trpc.budgetRules.getCampaigns.useQuery();
  const { data: executions = [], isLoading: execLoading, refetch: refetchExec } =
    trpc.budgetRules.getExecutions.useQuery({ limit: 100 });

  const createRule = trpc.budgetRules.create.useMutation({
    onSuccess: () => {
      utils.budgetRules.list.invalidate();
      setShowCreateDialog(false);
      setNewRule(DEFAULT_RULE);
      toast.success("Regel erstellt — Die Budget-Regel wurde erfolgreich gespeichert.");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const toggleRule = trpc.budgetRules.toggle.useMutation({
    onSuccess: () => utils.budgetRules.list.invalidate(),
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const deleteRule = trpc.budgetRules.delete.useMutation({
    onSuccess: () => {
      utils.budgetRules.list.invalidate();
      setDeleteRuleId(null);
      toast.success("Regel gelöscht");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const runSingle = trpc.budgetRules.runSingle.useMutation({
    onSuccess: () => {
      utils.budgetRules.getExecutions.invalidate();
      toast.success("Regel ausgeführt — Das Protokoll wurde aktualisiert.");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  const runAll = trpc.budgetRules.runNow.useMutation({
    onSuccess: () => {
      utils.budgetRules.getExecutions.invalidate();
      setRunAllConfirm(false);
      toast.success("Alle Regeln ausgeführt — Das Protokoll wurde aktualisiert.");
    },
    onError: (e) => toast.error(`Fehler: ${e.message}`),
  });

  function handleCreate() {
    if (!newRule.name || !newRule.threshold) {
      toast.error("Pflichtfelder fehlen — Bitte Name und Schwellenwert ausfüllen.");
      return;
    }
    const selectedCampaign = campaigns.find(c => c.id === newRule.campaignId);
    createRule.mutate({
      name: newRule.name,
      metric: newRule.metric as any,
      condition: newRule.condition as any,
      threshold: parseFloat(newRule.threshold),
      action: newRule.action as any,
      changePercent: newRule.changePercent ? parseFloat(newRule.changePercent) : undefined,
      maxBudgetCents: newRule.maxBudgetCents ? Math.round(parseFloat(newRule.maxBudgetCents) * 100) : undefined,
      minBudgetCents: newRule.minBudgetCents ? Math.round(parseFloat(newRule.minBudgetCents) * 100) : undefined,
      campaignId: newRule.campaignId || undefined,
      campaignName: selectedCampaign?.name,
      lookbackDays: parseInt(newRule.lookbackDays),
      cooldownDays: parseInt(newRule.cooldownDays),
    });
  }

  const activeRules = rules.filter(r => r.active).length;

  return (
    <DashboardLayout>
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-foreground">Budget-Regeln</h1>
          <p className="text-muted-foreground mt-1">
            Automatische Budgetanpassungen basierend auf Meta Ads KPIs — täglich um 10:10 Uhr CEST
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRunAllConfirm(true)}
            disabled={runAll.isPending}
          >
            <Play className="w-4 h-4 mr-2" />
            Alle jetzt ausführen
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Neue Regel
          </Button>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-foreground">{rules.length}</div>
            <div className="text-sm text-muted-foreground mt-1">Regeln gesamt</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-400">{activeRules}</div>
            <div className="text-sm text-muted-foreground mt-1">Aktive Regeln</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-400">
              {executions.filter(e => e.triggered).length}
            </div>
            <div className="text-sm text-muted-foreground mt-1">Ausgelöste Aktionen</div>
          </CardContent>
        </Card>
      </div>

      {/* Regeln-Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Konfigurierte Regeln</CardTitle>
        </CardHeader>
        <CardContent>
          {rulesLoading ? (
            <div className="text-center py-8 text-muted-foreground">Lade Regeln…</div>
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg">Noch keine Regeln konfiguriert</p>
              <p className="text-sm mt-2">Erstelle deine erste Budget-Regel mit dem Button oben rechts.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card/50"
                >
                  {/* Toggle */}
                  <Switch
                    checked={rule.active}
                    onCheckedChange={(checked) => toggleRule.mutate({ id: rule.id, active: checked })}
                  />

                  {/* Regel-Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground">{rule.name}</span>
                      <Badge
                        variant="outline"
                        className={ACTION_COLORS[rule.action] ?? ""}
                      >
                        {ACTION_LABELS[rule.action] ?? rule.action}
                      </Badge>
                      {!rule.active && (
                        <Badge variant="outline" className="text-muted-foreground">Inaktiv</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Wenn <strong>{METRIC_LABELS[rule.metric] ?? rule.metric}</strong>{" "}
                      <strong>{CONDITION_LABELS[rule.condition] ?? rule.condition}</strong>{" "}
                      <strong>{rule.threshold}</strong>
                      {(rule.action === "increase" || rule.action === "decrease") && rule.changePercent && (
                        <> → {rule.changePercent}%</>
                      )}
                      {" · "}Rückblick: {rule.lookbackDays} Tage
                      {" · "}Cooldown: {rule.cooldownDays} Tag(e)
                      {rule.campaignName && <> · Kampagne: {rule.campaignName}</>}
                    </div>
                    {rule.lastExecutedAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Zuletzt ausgeführt: {new Date(rule.lastExecutedAt).toLocaleString("de-CH")}
                      </div>
                    )}
                  </div>

                  {/* Aktionen */}
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runSingle.mutate({ id: rule.id })}
                      disabled={runSingle.isPending}
                      title="Jetzt ausführen"
                    >
                      <Play className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteRuleId(rule.id)}
                      title="Löschen"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ausführungsprotokoll */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Ausführungsprotokoll</CardTitle>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchExec()}
                disabled={execLoading}
              >
                <RefreshCw className={`w-4 h-4 ${execLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowLog(!showLog)}
              >
                {showLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {showLog ? "Ausblenden" : "Anzeigen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showLog && (
          <CardContent>
            {execLoading ? (
              <div className="text-center py-4 text-muted-foreground">Lade Protokoll…</div>
            ) : executions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Noch keine Ausführungen protokolliert.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeitpunkt</TableHead>
                      <TableHead>Regel</TableHead>
                      <TableHead>Kampagne</TableHead>
                      <TableHead>Metrik</TableHead>
                      <TableHead>Ausgelöst</TableHead>
                      <TableHead>Begründung</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executions.map((exec) => (
                      <TableRow key={exec.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {new Date(exec.executedAt).toLocaleString("de-CH")}
                        </TableCell>
                        <TableCell className="font-medium text-sm">{exec.ruleName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {exec.campaignName ?? exec.campaignId ?? "–"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {exec.metricValue !== null && exec.metricValue !== undefined
                            ? Number(exec.metricValue).toFixed(2)
                            : "–"}
                        </TableCell>
                        <TableCell>
                          {exec.triggered ? (
                            <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                              Ja
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Nein
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {exec.reason ?? "–"}
                        </TableCell>
                        <TableCell>
                          {exec.success ? (
                            <Badge className="bg-green-500/10 text-green-400 border-green-500/20">OK</Badge>
                          ) : (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Fehler</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Regel erstellen Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Neue Budget-Regel erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name der Regel *</Label>
              <Input
                placeholder="z.B. CPL zu hoch → Budget senken"
                value={newRule.name}
                onChange={e => setNewRule(p => ({ ...p, name: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Metrik *</Label>
                <Select value={newRule.metric} onValueChange={v => setNewRule(p => ({ ...p, metric: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(METRIC_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bedingung *</Label>
                <Select value={newRule.condition} onValueChange={v => setNewRule(p => ({ ...p, condition: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONDITION_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Schwellenwert *</Label>
              <Input
                type="number"
                placeholder="z.B. 15 für CPL > CHF 15"
                value={newRule.threshold}
                onChange={e => setNewRule(p => ({ ...p, threshold: e.target.value }))}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Aktion *</Label>
              <Select value={newRule.action} onValueChange={v => setNewRule(p => ({ ...p, action: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(newRule.action === "increase" || newRule.action === "decrease") && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Änderung (%)</Label>
                  <Input
                    type="number"
                    placeholder="20"
                    value={newRule.changePercent}
                    onChange={e => setNewRule(p => ({ ...p, changePercent: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Min. Budget (CHF)</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={newRule.minBudgetCents}
                    onChange={e => setNewRule(p => ({ ...p, minBudgetCents: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Max. Budget (CHF)</Label>
                  <Input
                    type="number"
                    placeholder="200"
                    value={newRule.maxBudgetCents}
                    onChange={e => setNewRule(p => ({ ...p, maxBudgetCents: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Kampagne (optional — leer = alle)</Label>
              <Select
                value={newRule.campaignId || "all"}
                onValueChange={v => setNewRule(p => ({ ...p, campaignId: v === "all" ? "" : v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Alle Kampagnen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kampagnen</SelectItem>
                  {campaigns.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rückblick (Tage)</Label>
                <Input
                  type="number"
                  value={newRule.lookbackDays}
                  onChange={e => setNewRule(p => ({ ...p, lookbackDays: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Cooldown (Tage)</Label>
                <Input
                  type="number"
                  value={newRule.cooldownDays}
                  onChange={e => setNewRule(p => ({ ...p, cooldownDays: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Abbrechen</Button>
            <Button onClick={handleCreate} disabled={createRule.isPending}>
              {createRule.isPending ? "Speichern…" : "Regel erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Löschen-Bestätigung */}
      <AlertDialog open={deleteRuleId !== null} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regel löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden. Die Regel und ihr Ausführungsprotokoll werden dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteRuleId !== null && deleteRule.mutate({ id: deleteRuleId })}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alle ausführen Bestätigung */}
      <AlertDialog open={runAllConfirm} onOpenChange={setRunAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle Regeln jetzt ausführen?</AlertDialogTitle>
            <AlertDialogDescription>
              Es werden alle aktiven Regeln sofort ausgeführt — Cooldown wird dabei übersprungen. Budgets können dadurch direkt in Meta angepasst werden. Bitte nur für manuelle Tests verwenden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => runAll.mutate({ forceRun: true })} disabled={runAll.isPending}>
              {runAll.isPending ? "Wird ausgeführt…" : "Jetzt ausführen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </DashboardLayout>
  );
}
