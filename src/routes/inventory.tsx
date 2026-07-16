import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Stethoscope, Plus, Search, AlertTriangle, ArrowDownToLine } from "lucide-react";

export const Route = createFileRoute("/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Afyacore HMIS" }] }),
  component: InventoryPage,
});

const CATEGORIES = ["medication","supply","consumable","equipment","reagent","other"] as const;

function InventoryPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, user, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const hospitalId = profile?.hospital_id;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inv-items", hospitalId, q, cat],
    enabled: !!hospitalId,
    queryFn: async () => {
      let query = supabase
        .from("inventory_items")
        .select("*")
        .eq("hospital_id", hospitalId!)
        .eq("active", true)
        .order("name");
      if (cat !== "all") query = query.eq("category", cat as never);
      if (q.trim().length >= 2) query = query.or(`name.ilike.%${q}%,generic_name.ilike.%${q}%,sku.ilike.%${q}%`);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Stock-on-hand per item
  const { data: stockByItem = {} } = useQuery({
    queryKey: ["inv-stock", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .select("item_id, quantity_on_hand, expiry_date")
        .eq("hospital_id", hospitalId!);
      if (error) throw error;
      const map: Record<string, { total: number; nearestExpiry: string | null }> = {};
      for (const b of data ?? []) {
        const cur = map[b.item_id] ?? { total: 0, nearestExpiry: null };
        cur.total += Number(b.quantity_on_hand);
        if (b.expiry_date && (!cur.nearestExpiry || b.expiry_date < cur.nearestExpiry)) cur.nearestExpiry = b.expiry_date;
        map[b.item_id] = cur;
      }
      return map;
    },
  });

  const lowStock = useMemo(
    () => (items as Array<{ id: string; reorder_level: number }>).filter(
      (it) => (stockByItem[it.id]?.total ?? 0) <= Number(it.reorder_level ?? 0),
    ),
    [items, stockByItem],
  );

  if (loading || !user) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <Shell active="inventory">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Medications, supplies, and equipment across the hospital.</p>
        </div>
        <div className="flex gap-2">
          <AddItemDialog hospitalId={hospitalId ?? undefined} onSaved={() => qc.invalidateQueries({ queryKey: ["inv-items"] })} />
          <ReceiveStockDialog hospitalId={hospitalId ?? undefined} items={items as never[]} onSaved={() => {
            qc.invalidateQueries({ queryKey: ["inv-items"] });
            qc.invalidateQueries({ queryKey: ["inv-stock"] });
          }} />
        </div>
      </div>

      {lowStock.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-4 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span><b>{lowStock.length}</b> item(s) at or below reorder level.</span>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, generic, SKU…" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">On hand</th>
                <th className="px-4 py-2 text-right">Reorder at</th>
                <th className="px-4 py-2 text-left">Nearest expiry</th>
                <th className="px-4 py-2 text-right">Unit price</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && items.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No items. Add your first one.</td></tr>
              )}
              {items.map((raw) => {
                const i = raw as { id: string; name: string; generic_name: string|null; sku: string|null; category: string; form: string|null; strength: string|null; unit: string; unit_price: number; reorder_level: number; is_controlled: boolean };
                const s = stockByItem[i.id];
                const onHand = s?.total ?? 0;
                const low = onHand <= Number(i.reorder_level ?? 0);
                return (
                  <tr key={i.id} className="border-t hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium">{i.name}{i.strength ? ` ${i.strength}` : ""}{i.form ? ` · ${i.form}` : ""}</div>
                          <div className="text-xs text-muted-foreground">
                            {i.generic_name ? `${i.generic_name} · ` : ""}{i.sku ?? "—"} · {i.unit}
                          </div>
                        </div>
                        {i.is_controlled && <Badge variant="outline" className="text-[10px]">Controlled</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2 capitalize">{i.category}</td>
                    <td className="px-4 py-2 text-right">
                      <span className={low ? "font-semibold text-amber-600" : ""}>{onHand}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">{i.reorder_level}</td>
                    <td className="px-4 py-2">{s?.nearestExpiry ?? "—"}</td>
                    <td className="px-4 py-2 text-right">{Number(i.unit_price).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </Shell>
  );
}

// ---------------- Add item ----------------
function AddItemDialog({ hospitalId, onSaved }: { hospitalId?: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "", generic_name: "", sku: "", category: "medication" as string,
    form: "", strength: "", unit: "unit", unit_price: "0", reorder_level: "0",
    is_controlled: false, description: "",
  });
  const save = useMutation({
    mutationFn: async () => {
      if (!hospitalId) throw new Error("No hospital");
      const { error } = await supabase.from("inventory_items").insert({
        hospital_id: hospitalId,
        name: f.name.trim(),
        generic_name: f.generic_name.trim() || null,
        sku: f.sku.trim() || null,
        category: f.category as never,
        form: f.form.trim() || null,
        strength: f.strength.trim() || null,
        unit: f.unit.trim() || "unit",
        unit_price: Number(f.unit_price) || 0,
        reorder_level: Number(f.reorder_level) || 0,
        is_controlled: f.is_controlled,
        description: f.description.trim() || null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Item added"); setOpen(false); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="mr-2 h-4 w-4" />Add item</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add inventory item</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Generic name</Label><Input value={f.generic_name} onChange={(e) => setF({ ...f, generic_name: e.target.value })} /></div>
          <div><Label>SKU</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Form</Label><Input value={f.form} placeholder="tablet, syrup, IV…" onChange={(e) => setF({ ...f, form: e.target.value })} /></div>
          <div><Label>Strength</Label><Input value={f.strength} placeholder="500 mg" onChange={(e) => setF({ ...f, strength: e.target.value })} /></div>
          <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
          <div><Label>Unit price</Label><Input type="number" step="0.01" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
          <div><Label>Reorder level</Label><Input type="number" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} /></div>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={f.is_controlled} onChange={(e) => setF({ ...f, is_controlled: e.target.checked })} />
            <span className="text-sm">Controlled substance</span>
          </label>
          <div className="sm:col-span-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Receive stock ----------------
function ReceiveStockDialog({ hospitalId, items, onSaved }: { hospitalId?: string; items: never[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ item_id: "", batch_no: "", expiry_date: "", quantity: "", cost_price: "", supplier: "" });
  const save = useMutation({
    mutationFn: async () => {
      if (!hospitalId || !f.item_id) throw new Error("Missing item/hospital");
      const qty = Number(f.quantity);
      if (!qty || qty <= 0) throw new Error("Quantity must be > 0");
      const { data: batch, error } = await supabase.from("inventory_batches").insert({
        hospital_id: hospitalId,
        item_id: f.item_id,
        batch_no: f.batch_no.trim() || null,
        expiry_date: f.expiry_date || null,
        quantity_on_hand: qty,
        cost_price: Number(f.cost_price) || 0,
        supplier: f.supplier.trim() || null,
      } as never).select().single();
      if (error) throw error;
      const b = batch as { id: string; item_id: string; cost_price: number };
      const { error: mErr } = await supabase.from("stock_movements").insert({
        hospital_id: hospitalId,
        item_id: b.item_id,
        batch_id: b.id,
        movement_type: "receipt",
        quantity: qty,
        unit_cost: b.cost_price,
        reason: f.supplier ? `Received from ${f.supplier}` : "Stock receipt",
      } as never);
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      toast.success("Stock received");
      setOpen(false);
      setF({ item_id: "", batch_no: "", expiry_date: "", quantity: "", cost_price: "", supplier: "" });
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><ArrowDownToLine className="mr-2 h-4 w-4" />Receive stock</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Receive stock (GRN)</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Label>Item *</Label>
            <Select value={f.item_id} onValueChange={(v) => setF({ ...f, item_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
              <SelectContent>
                {items.map((raw) => {
                  const it = raw as { id: string; name: string; strength: string|null; unit: string };
                  return <SelectItem key={it.id} value={it.id}>{it.name}{it.strength ? ` ${it.strength}` : ""} ({it.unit})</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Batch no.</Label><Input value={f.batch_no} onChange={(e) => setF({ ...f, batch_no: e.target.value })} /></div>
          <div><Label>Expiry date</Label><Input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></div>
          <div><Label>Quantity *</Label><Input type="number" step="0.001" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><Label>Cost / unit</Label><Input type="number" step="0.01" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Supplier</Label><Input value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.item_id || !f.quantity || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Receive"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Shell (shared with pharmacy) ----------------
export function Shell({ children, active }: { children: React.ReactNode; active: "inventory" | "pharmacy" | "patients" | "hospital" }) {
  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </div>
            <span className="font-semibold tracking-tight">Afyacore HMIS</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/hospital"><Button size="sm" variant={active === "hospital" ? "secondary" : "ghost"}>Dashboard</Button></Link>
            <Link to="/patients"><Button size="sm" variant={active === "patients" ? "secondary" : "ghost"}>Patients</Button></Link>
            <Link to="/pharmacy"><Button size="sm" variant={active === "pharmacy" ? "secondary" : "ghost"}>Pharmacy</Button></Link>
            <Link to="/inventory"><Button size="sm" variant={active === "inventory" ? "secondary" : "ghost"}>Inventory</Button></Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
