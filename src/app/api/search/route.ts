import { NextResponse, type NextRequest } from "next/server";
import { searchEntities } from "@/lib/catalog/queries";

// Reading the query string makes this handler dynamic under Cache Components.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ players: [], teams: [], sets: [], series: [] });
  }
  const results = await searchEntities(q, 6);
  // Public catalog data, identical across users -> let the browser/CDN reuse
  // repeated prefixes briefly while revalidating in the background.
  return NextResponse.json(results, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
