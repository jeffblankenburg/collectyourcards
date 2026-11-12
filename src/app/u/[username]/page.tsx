import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bookmark } from "lucide-react";
import { getPublicProfile, publicCardToRow } from "@/lib/public-view";
import { CardRowInner } from "@/components/collection/card-row-shared";

export const instant = false; // per-user public data; owner-preview differs from anon

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const p = await getPublicProfile(username);
  return { title: p ? `${p.display_name || "@" + p.username} · Collection` : "Collector" };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) notFound();

  return (
    <main className="mx-auto max-w-screen-md px-4 py-6">
      <header className="flex items-center gap-4">
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-ink">
            {(profile.display_name || profile.username).charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl text-ink">{profile.display_name || `@${profile.username}`}</h1>
          <p className="text-sm text-muted">@{profile.username}</p>
        </div>
      </header>
      {profile.bio ? <p className="mt-3 text-sm text-ink/90">{profile.bio}</p> : null}

      {profile.views.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Shared views</h2>
          <div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5">
            {profile.views.map((v) => (
              <Link key={v.share_token} href={`/v/${v.share_token}`} className="flex items-center gap-3 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
                <Bookmark className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{v.name}</span>
                <span className="text-muted">›</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">★ Favorites</h2>
        {profile.favorites.length === 0 ? (
          <p className="text-sm text-muted">No favorites featured yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {profile.favorites.map((c) => (
              <Link key={c.user_card_id} href={`/cards/${c.card_id}`} className="block">
                <CardRowInner row={publicCardToRow(c)} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
