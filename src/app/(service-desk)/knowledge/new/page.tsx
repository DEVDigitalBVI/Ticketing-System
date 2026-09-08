import type { Metadata } from "next";
import { ArticleForm } from "@/modules/knowledge/components/article-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { requireCurrentAccess } from "@/server/auth/authorization";
import { getKnowledgeOptions } from "@/server/knowledge/service";

export const metadata: Metadata = { title: "New knowledge article" };

export default async function NewKnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ ticket?: string; status?: string }>;
}) {
  const access = await requireCurrentAccess("knowledge.author", "/knowledge");
  const search = await searchParams;
  const options = await getKnowledgeOptions(access);
  return (
    <section className="view knowledge-view">
      <PageHeader
        eyebrow="Knowledge workflow"
        title={search.ticket ? "Propose a reusable fix" : "Create an article"}
        titleId="knowledge-editor-title"
        lead={
          search.ticket
            ? "Rewrite the useful pattern without copying guest, staff, device, or ticket-sensitive details."
            : "Start in Draft, choose a reviewer, and publish only after review."
        }
      />
      <ArticleForm options={options} sourceTicketId={search.ticket} />
    </section>
  );
}
