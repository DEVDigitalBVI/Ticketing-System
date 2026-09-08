import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleForm } from "@/modules/knowledge/components/article-form";
import { PageHeader } from "@/modules/service-desk/components/page-header";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";
import { KnowledgeError } from "@/server/knowledge/policy";
import { getKnowledgeArticle, getKnowledgeOptions } from "@/server/knowledge/service";

export const metadata: Metadata = { title: "Edit knowledge article" };

export default async function EditKnowledgePage({
  params,
}: {
  params: Promise<{ articleId: string }>;
}) {
  const access = await requireCurrentAccess("knowledge.author", "/knowledge");
  const { articleId } = await params;
  let article;
  try {
    article = await getKnowledgeArticle(access, articleId);
  } catch (error) {
    if (error instanceof KnowledgeError) notFound();
    throw error;
  }
  if (!["draft", "in_review"].includes(article.state)) notFound();
  if (article.ownerUserId !== access.userId && !accessCan(access, "knowledge.publish")) notFound();
  const options = await getKnowledgeOptions(access);
  return (
    <section className="view knowledge-view">
      <PageHeader
        eyebrow="Knowledge workflow"
        title="Edit article"
        titleId="knowledge-editor-title"
        lead="Every saved content change creates an immutable version."
      />
      <ArticleForm article={article} options={options} />
    </section>
  );
}
