"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Crop, Plus, Star, Trash2, X } from "lucide-react";
import { useCollection } from "./collection-provider";
import { playersLabel, PlayersWithTeams, ebaySoldUrl, comcUrl } from "./card-row-shared";
import {
  createLocation, deletePhotoRow, deleteUserCard, insertPhotoRow, listPhotos,
  reorderPhotos, updatePhotoUrl, updateUserCard, type PhotoRow, type UserCardPatch,
} from "@/lib/collection/mutations";
import { removeCardPhotoObject, uploadCardPhoto } from "@/lib/collection/storage";
import { ImageEditor } from "./image-editor";
import type { CompactRow } from "@/lib/collection/index-types";

const numOrNull = (s: string): number | null => { const t = s.trim(); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

export function EditCardModal() {
  const { editingRow, locations, agencies, collectorId, dispatch, patchRow, removeRow, setLocations } = useCollection();
  const row = editingRow!;
  // form state (strings for number inputs)
  const [rc, setRc] = useState(row.rc ?? "");
  const [sn, setSn] = useState(row.sn != null ? String(row.sn) : "");
  const [li, setLi] = useState<string>(row.li != null ? String(row.li) : "");
  const [nt, setNt] = useState(row.nt ?? "");
  const [af, setAf] = useState(row.af);
  const [pp, setPp] = useState(row.pp != null ? String(row.pp) : "");
  const [ev, setEv] = useState(row.ev != null ? String(row.ev) : "");
  const [ga, setGa] = useState<string>(""); // grading_agency id as string
  const [grade, setGrade] = useState(row.g != null ? String(row.g) : "");
  const [gid, setGid] = useState(row.gid != null ? String(row.gid) : "");
  // Photos open by default (matches collectyourcards.com) so photo management is
  // discoverable; Pricing/Grading stay collapsed.
  const [open, setOpen] = useState<{ pricing: boolean; grading: boolean; photos: boolean }>({ pricing: false, grading: false, photos: true });
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // inline location create
  const [newLoc, setNewLoc] = useState<string | null>(null);

  // seed grading_agency id from the row's abbreviation
  useEffect(() => {
    if (row.ga) { const a = agencies.find((x) => x.abbreviation === row.ga); if (a) setGa(String(a.grading_agency_id)); }
  }, [row.ga, agencies]);

  const close = () => dispatch({ t: "editing", id: null });

  async function save() {
    setSaving(true); setErr(null);
    const agency = ga ? Number(ga) : null;
    const patch: UserCardPatch = {
      random_code: rc.trim() || null,
      serial_number: numOrNull(sn),
      user_location_id: li ? Number(li) : null,
      notes: nt.trim() || null,
      aftermarket_autograph: af,
      purchase_price: numOrNull(pp),
      estimated_value: numOrNull(ev),
      grading_agency: agency,
      grade: numOrNull(grade),
      grade_id: numOrNull(gid),
    };
    const before = { ...row };
    const locName = li ? (locations.find((l) => l.user_location_id === Number(li))?.location ?? null) : null;
    const gaAbbr = agency ? (agencies.find((a) => a.grading_agency_id === agency)?.abbreviation ?? null) : null;
    patchRow(row.i, { rc: patch.random_code, sn: patch.serial_number, li: patch.user_location_id, ln: locName,
      nt: patch.notes, af: patch.aftermarket_autograph, pp: patch.purchase_price, ev: patch.estimated_value,
      ga: gaAbbr, g: patch.grade, gid: patch.grade_id });
    try {
      await updateUserCard(row.i, patch);
      close();
    } catch (e) {
      patchRow(row.i, before); // rollback
      setErr((e as Error).message); setSaving(false);
    }
  }

  async function toggleFavorite() {
    const next = !row.sp;
    patchRow(row.i, { sp: next });
    try { await updateUserCard(row.i, { is_special: next }); } catch { patchRow(row.i, { sp: !next }); }
  }

  async function doDelete() {
    const photos = await listPhotos(row.i);
    await Promise.all(photos.map((p) => removeCardPhotoObject(p.photo_url).catch(() => {})));
    try { await deleteUserCard(row.i); removeRow(row.i); close(); }
    catch (e) { setErr((e as Error).message); }
  }

  async function addLocation() {
    const name = (newLoc ?? "").trim();
    if (!name) { setNewLoc(null); return; }
    try {
      const loc = await createLocation(collectorId, name);
      setLocations([...locations, loc].sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "")));
      setLi(String(loc.user_location_id)); setNewLoc(null);
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={close}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-base sm:rounded-3xl">
        {/* header — mirrors the closed list card (image · #number · stacked
            players with team circles · series) so it reads identically */}
        <div className="flex items-start gap-3 border-b border-white/5 p-4">
          <div className="relative aspect-[5/7] w-14 shrink-0 self-start overflow-hidden border border-white/10 bg-white/5">
            {row.pu ? <Image src={row.pu} alt={playersLabel(row)} fill sizes="56px" className="object-contain" /> : <div className="flex h-full items-center justify-center text-[10px] text-muted">#{row.n}</div>}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-semibold text-muted">#{row.n}</span>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={toggleFavorite} className="p-1" title="Favorite"><Star className={`size-5 ${row.sp ? "fill-gold text-gold" : "text-muted"}`} /></button>
                <button onClick={close} className="p-1 text-muted hover:text-ink"><X className="size-5" /></button>
              </div>
            </div>
            <PlayersWithTeams row={row} stacked />
            <div className="text-xs leading-snug text-muted">{row.se}</div>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code"><input value={rc} onChange={(e) => setRc(e.target.value)} className={inputCls} /></Field>
            {row.pr && row.pr > 1 ? (
              <Field label={`Serial (/${row.pr})`}><input value={sn} inputMode="numeric" onChange={(e) => setSn(e.target.value)} className={inputCls} /></Field>
            ) : <div />}
          </div>

          {/* location */}
          <Field label="Location" className="mt-3">
            {newLoc === null ? (
              <div className="flex gap-2">
                <select value={li} onChange={(e) => setLi(e.target.value)} className={`${inputCls} flex-1`}>
                  <option value="">Unassigned</option>
                  {locations.map((l) => <option key={l.user_location_id} value={l.user_location_id}>{l.location}</option>)}
                </select>
                <button onClick={() => setNewLoc("")} className="rounded-xl border border-white/10 px-3 text-muted hover:text-ink" title="New location"><Plus className="size-4" /></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input autoFocus value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New location name" className={`${inputCls} flex-1`} />
                <button onClick={addLocation} className="rounded-xl bg-brand px-3 text-sm font-semibold text-white">Add</button>
                <button onClick={() => setNewLoc(null)} className="rounded-xl border border-white/10 px-3 text-muted">✕</button>
              </div>
            )}
          </Field>

          <Field label="Notes" className="mt-3"><textarea value={nt} onChange={(e) => setNt(e.target.value)} rows={2} className={inputCls} /></Field>
          <label className="mt-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={af} onChange={(e) => setAf(e.target.checked)} className="accent-[var(--color-brand)]" /> Aftermarket autograph
          </label>

          <Section title="Pricing" open={open.pricing} onToggle={() => setOpen((o) => ({ ...o, pricing: !o.pricing }))}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Paid ($)"><input value={pp} inputMode="decimal" onChange={(e) => setPp(e.target.value)} className={inputCls} /></Field>
              <Field label="Est. value ($)"><input value={ev} inputMode="decimal" onChange={(e) => setEv(e.target.value)} className={inputCls} /></Field>
            </div>
            {/* Price research — logo-only links to sold/for-sale comps. */}
            <div className="mt-3 flex items-center justify-end gap-2">
              <PriceLink href={ebaySoldUrl(row)} label="eBay sold listings" src="/ebay.svg" width={1000} height={401} />
              <PriceLink href={comcUrl(row)} label="Find on COMC" src="/comc.webp" width={1023} height={456} />
            </div>
          </Section>

          <Section title="Grading" open={open.grading} onToggle={() => setOpen((o) => ({ ...o, grading: !o.grading }))}>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Agency"><select value={ga} onChange={(e) => setGa(e.target.value)} className={inputCls}><option value="">—</option>{agencies.map((a) => <option key={a.grading_agency_id} value={a.grading_agency_id}>{a.abbreviation}</option>)}</select></Field>
              <Field label="Grade"><input value={grade} inputMode="decimal" onChange={(e) => setGrade(e.target.value)} className={inputCls} /></Field>
              <Field label="Cert #"><input value={gid} inputMode="numeric" onChange={(e) => setGid(e.target.value)} className={inputCls} /></Field>
            </div>
          </Section>

          <Section title={`Photos (${row.pc}/5)`} open={open.photos} onToggle={() => setOpen((o) => ({ ...o, photos: !o.photos }))}>
            <PhotoManager row={row} patchRow={patchRow} collectorId={collectorId} />
          </Section>

          {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-white/5 p-4">
          {confirmDel ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-sm text-gold">Delete this card?</span>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted">Cancel</button>
                <button onClick={doDelete} className="rounded-xl bg-red-500/90 px-3 py-2 text-sm font-semibold text-white">Delete</button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-ink"><Trash2 className="size-4" /> Delete</button>
              <button onClick={save} disabled={saving} className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save"}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className ?? ""}`}><span className="text-xs text-muted">{label}</span>{children}</label>;
}

// Logo-only link to an external marketplace comp search (opens a new tab).
function PriceLink({ href, label, src, width, height }: { href: string; label: string; src: string; width: number; height: number }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}
      className="inline-flex h-9 items-center rounded-xl bg-white px-3 shadow-sm transition active:scale-[0.97] hover:bg-white/90">
      <Image src={src} alt="" width={width} height={height} unoptimized className="h-4 w-auto" />
    </a>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="mt-4 border-t border-white/5 pt-3">
      <button onClick={onToggle} className="flex w-full items-center justify-between text-sm font-semibold text-ink">
        {title}<ChevronDown className={`size-4 text-muted transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

function PhotoManager({ row, patchRow, collectorId }: { row: CompactRow; patchRow: (id: number, patch: Partial<CompactRow>) => void; collectorId: number }) {
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<PhotoRow | null>(null); // crop a photo that's already uploaded
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { listPhotos(row.i).then(setPhotos).catch(() => setPhotos([])); }, [row.i]);

  const syncRow = (list: PhotoRow[]) => {
    const primary = [...list].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))[0];
    patchRow(row.i, { pc: list.length, pu: primary?.photo_url ?? null });
  };

  // Upload first: selected files upload immediately (multi-select, up to the cap).
  // Cropping is an optional follow-up via the ⌗ button on an uploaded photo.
  async function onFiles(files: FileList | null) {
    if (!files || !photos) return;
    setBusy(true); setErr(null);
    const current = [...photos];
    try {
      for (const file of Array.from(files)) {
        if (current.length >= 5) break;
        const url = await uploadCardPhoto(collectorId, row.i, file);
        const r = await insertPhotoRow(row.i, url, (current.at(-1)?.sort_order ?? 0) + 1);
        current.push(r);
      }
      setPhotos(current); syncRow(current);
    } catch (e) { setErr((e as Error).message + " — is the card-photos bucket set up?"); }
    setBusy(false);
  }

  // Apply a crop/rotate to an already-uploaded photo. Optimistic: show the edited
  // image and close the editor immediately (matches v1's instant feel) using a
  // local object URL, then upload + repoint the row in the background. Old-object
  // cleanup is fire-and-forget; revert if the upload fails.
  async function onCropSave(blob: Blob) {
    if (!photos || !editing) return;
    const target = editing;
    const before = photos;
    const objUrl = URL.createObjectURL(blob);
    const optimistic = photos.map((p) =>
      p.user_card_photo_id === target.user_card_photo_id ? { ...p, photo_url: objUrl } : p);
    setPhotos(optimistic); syncRow(optimistic); setEditing(null); setErr(null);
    try {
      const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
      const url = await uploadCardPhoto(collectorId, row.i, file);
      await updatePhotoUrl(target.user_card_photo_id, url);
      void removeCardPhotoObject(target.photo_url).catch(() => {}); // old object, non-blocking
      const next = optimistic.map((p) =>
        p.user_card_photo_id === target.user_card_photo_id ? { ...p, photo_url: url } : p);
      setPhotos(next); syncRow(next);
    } catch (e) {
      setPhotos(before); syncRow(before); // revert on failure
      setErr((e as Error).message);
    } finally {
      // Free the blob once the real URL has long since swapped in.
      setTimeout(() => URL.revokeObjectURL(objUrl), 15000);
    }
  }

  async function del(p: PhotoRow) {
    if (!photos) return;
    const next = photos.filter((x) => x.user_card_photo_id !== p.user_card_photo_id);
    setPhotos(next); syncRow(next);
    await removeCardPhotoObject(p.photo_url).catch(() => {});
    await deletePhotoRow(p.user_card_photo_id).catch(() => {});
  }

  async function makePrimary(p: PhotoRow) {
    if (!photos) return;
    const rest = photos.filter((x) => x.user_card_photo_id !== p.user_card_photo_id);
    const ordered = [p, ...rest].map((x, idx) => ({ ...x, sort_order: idx + 1 }));
    setPhotos(ordered); syncRow(ordered);
    await reorderPhotos(ordered.map((x) => ({ id: x.user_card_photo_id, sort: x.sort_order! }))).catch(() => {});
  }

  if (photos === null) return <p className="text-xs text-muted">Loading photos…</p>;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-2">
        {[...photos].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99)).map((p, idx) => (
          <div key={p.user_card_photo_id} className="relative inline-flex flex-col">
            <AspectThumb src={p.photo_url} height={90} highlight={idx === 0}>
              <button onClick={() => setEditing(p)}
                title="Crop & rotate" className="absolute bottom-0 right-0 rounded-tl bg-black/60 p-0.5 text-white hover:bg-black/80"><Crop className="size-3" /></button>
            </AspectThumb>
            <button onClick={() => del(p)} className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white" title="Delete photo"><X className="size-3" /></button>
            {idx === 0 ? (
              <span className="mt-1 flex w-full items-center justify-center gap-0.5 text-[9px] font-semibold text-gold"><Star className="size-2.5 fill-gold" />Primary</span>
            ) : (
              <button onClick={() => makePrimary(p)} className="mt-1 w-full text-[9px] text-muted hover:text-ink">Make primary</button>
            )}
          </div>
        ))}
        {photos.length < 5 ? (
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="flex aspect-[5/7] w-16 items-center justify-center rounded border border-dashed border-white/20 text-muted hover:text-ink disabled:opacity-50">
            {busy ? "…" : <Plus className="size-5" />}
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] text-muted">Tap <Crop className="inline size-3" /> on a photo to crop or rotate it.</p>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
      {err ? <p className="mt-2 text-[11px] text-gold">{err}</p> : null}
      {editing ? <ImageEditor src={editing.photo_url} onCancel={() => setEditing(null)} onSave={onCropSave} /> : null}
    </div>
  );
}

// Thumbnail with a FIXED height; width follows the photo's real aspect (measured
// onLoad), so landscape and portrait photos share one height and aren't cropped.
// Defaults to portrait 5:7 until the bytes arrive. children are overlaid (crop btn).
function AspectThumb({ src, height, highlight, children }: {
  src: string; height: number; highlight?: boolean; children?: React.ReactNode;
}) {
  const [ar, setAr] = useState(5 / 7); // width / height
  return (
    <div
      className={`relative overflow-hidden rounded border bg-white/5 ${highlight ? "border-gold" : "border-white/10"}`}
      style={{ height, width: Math.round(height * ar) }}
    >
      <Image src={src} alt="" fill sizes="140px" className="object-cover" unoptimized
        onLoad={(e) => { const i = e.currentTarget; if (i.naturalWidth && i.naturalHeight) setAr(i.naturalWidth / i.naturalHeight); }} />
      {children}
    </div>
  );
}
