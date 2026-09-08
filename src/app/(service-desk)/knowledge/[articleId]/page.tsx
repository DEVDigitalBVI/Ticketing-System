import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SafeArticleBody } from "@/modules/knowledge/components/safe-article-body";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";
import {
  KnowledgeError,
  workflowTransitions,
  type KnowledgeState,
} from "@/server/knowledge/policy";
import { getKnowledgeArticle } from "@/server/knowledge/service";

export const metadata: Metadata = { title: "Knowledge article" };

function date(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "America/Tortola" }).format(
        value,
      )
    : "Not scheduled";
}

export default async function KnowledgeArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ articleId: string }>;
  searchParams: Promise<{ ticket?: string; status?: string }>;
}) {
  const access = await requireCurrentAccess("knowledge.read");
  const [{ articleId }, search] = await Promise.all([params, searchParams]);
  let article;
  try {
    article = await getKnowledgeArticle(access, articleId);
  } catch (error) {
    if (error instanceof KnowledgeError && error.code === "not_found") notFound();
    throw error;
  }
  const canWorkflow =
    accessCan(access, "knowledge.author") &&
    (article.ownerUserId === access.userId ||
      article.reviewerUserId === access.userId ||
      accessCan(access, "knowledge.publish"));
  const canEdit =
    accessCan(access, "knowledge.author") &&
    (article.ownerUserId === access.userId || accessCan(access, "knowledge.publish"));
  const transitions = canWorkflow ? workflowTransitions[article.state as KnowledgeState] : [];
  return (
    <article className="view knowledge-article" aria-labelledby="article-title">
      <nav className="article-breadcrumb" aria-label="Breadcrumb">
        <Link href="/knowledge">Knowledge base</Link>
        <span aria-hidden="true">/</span>
        <span>{article.category?.name ?? "General"}</span>
      </nav>
      {search.status ? (
        <p
          className={`form-feedback ${search.status === "feedback" || search.status === "linked" ? "success" : "error"}`}
          role="status"
        >
          {search.status === "feedback"
            ? "Thanks for the feedback."
            : search.status === "linked"
              ? "Article linked to the ticket."
              : "The request could not be completed."}
        </p>
      ) : null}
      <header className="knowledge-article-header">
        <div>
          <p className="overline">
            {article.audience === "staff" ? "All staff guidance" : "Technician runbook"}
          </p>
          <h1 id="article-title">{article.title}</h1>
          <p className="lead">{article.summary}</p>
        </div>
        <div className="article-status-card">
          <span className={`status-pill ${article.state === "published" ? "progress" : "waiting"}`}>
            {article.state.replace("_", " ")}
          </span>
          <strong>Version {article.currentVersion}</strong>
          <small>Owner · {article.owner.displayName}</small>
          <small>Reviewer · {article.reviewer?.displayName ?? "Not assigned"}</small>
          <small>Review · {date(article.reviewDate)}</small>
          {article.stale ? <span className="stale-label">Review overdue</span> : null}
        </div>
      </header>
      <div className="knowledge-article-layout">
        <section className="panel article-copy">
          <SafeArticleBody body={article.body} />
        </section>
        <aside className="article-rail">
          {article.state === "published" ? (
            <form className="panel feedback-card" action="/auth/knowledge" method="post">
              <input type="hidden" name="intent" value="feedback" />
              <input type="hidden" name="articleId" value={article.id} />
              <h2>Was this helpful?</h2>
              <div className="tech-actions">
                <button className="secondary-button" name="helpful" value="yes" type="submit">
                  Yes
                </button>
                <button className="secondary-button" name="helpful" value="no" type="submit">
                  Not yet
                </button>
              </div>
              <small>
                {article.helpful} helpful · {article.unhelpful} not yet
              </small>
            </form>
          ) : null}
          {search.ticket && article.state === "published" && accessCan(access, "knowledge.link") ? (
            <form className="panel feedback-card" action="/auth/knowledge" method="post">
              <input type="hidden" name="intent" value="link" />
              <input type="hidden" name="articleId" value={article.id} />
              <input type="hidden" name="ticketId" value={search.ticket} />
              <h2>Link to selected ticket</h2>
              <p>Add this reviewed article to the ticket activity.</p>
              <button className="primary-button" type="submit">
                Link article
              </button>
            </form>
          ) : null}
          {canWorkflow ? (
            <section className="panel feedback-card">
              <h2>Editorial workflow</h2>
              {canEdit && ["draft", "in_review"].includes(article.state) ? (
                <Link className="secondary-button" href={`/knowledge/${article.id}/edit`}>
                  Edit article
                </Link>
              ) : null}
              {transitions.map((state) => (
                <form action="/auth/knowledge" method="post" key={state}>
                  <input type="hidden" name="intent" value="transition" />
                  <input type="hidden" name="articleId" value={article.id} />
                  <input type="hidden" name="expectedVersion" value={article.currentVersion} />
                  <input type="hidden" name="toState" value={state} />
                  <button
                    className={state === "published" ? "primary-button" : "secondary-button"}
                    type="submit"
                  >
                    {state === "in_review"
                      ? "Send for review"
                      : state === "published"
                        ? "Publish"
                        : state === "retired"
                          ? "Retire"
                          : "Return to draft"}
                  </button>
                </form>
              ))}
            </section>
          ) : null}
          {article.assetLinks.length ? (
            <section className="panel feedback-card">
              <h2>Related assets</h2>
              {article.assetLinks.map(({ asset }) => (
                <Link href={`/assets/${asset.id}`} key={asset.id}>
                  {asset.assetTag} · {asset.name}
                </Link>
              ))}
            </section>
          ) : null}
        </aside>
      </div>
      {canWorkflow ? (
        <section className="version-history">
          <div className="section-heading">
            <div>
              <p className="overline">Change record</p>
              <h2>Version history</h2>
            </div>
          </div>
          <ol>
            {article.versions.map((version) => (
              <li key={version.id}>
                <strong>Version {version.version}</strong>
                <span>{version.changeSummary}</span>
                <small>
                  {version.createdBy.displayName} · {date(version.createdAt)}
                </small>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </article>
  );
}
