export default function CollectionLoading() {
  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <div className="h-7 w-40 animate-pulse rounded bg-white/10" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />
        ))}
      </div>
    </main>
  );
}
