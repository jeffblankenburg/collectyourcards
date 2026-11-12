import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListDetailShell } from "@/components/lists/list-detail-shell";

export const metadata: Metadata = { title: "List" };
export const instant = false; // per-user (owner vs public) + reads session

export default async function ListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listId = Number(id);
  if (!Number.isFinite(listId)) notFound();
  return <ListDetailShell listId={listId} />;
}
