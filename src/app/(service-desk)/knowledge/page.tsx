import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/modules/service-desk/components/page-header";
import { accessCan, requireCurrentAccess } from "@/server/auth/authorization";
import { isDatabaseUnavailableError } from "@/server/database/errors";
import { getKnowledgeOptions, searchKnowledge } from "@/server/knowledge/service";

export const metadata: Metadata = { title: "Knowledge base" };

function date(value: Date | null) {
  return value
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "America/Tortola" }).format(
        value,
      )
    : "Not scheduled";
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string;
    categoryId?: string;
    state?: string;
    stale?: string;
    ticket?: string;
    status?: string;
  }>;
}) {
  const access = await requireCurrentAccess("knowledge.read");
  const search = await searchParams;
  let articles: Awaited<ReturnType<typeof searchKnowledge>> | undefined;
  let options: Awaited<ReturnType<typeof getKnowledgeOptions>> | undefined;
  try {
    [articles, options] = await Promise.all([
      searchKnowledge(access, search),
      getKnowledgeOptions(access),
    ]);
  } catch (error) {
    if (!isDatabaseUnavailableError(error)) throw error;
  }
  const canAuthor = accessCan(access, "knowledge.author");
  return (
    <section className="view knowledge-view" aria-labelledby="knowledge-title">
      <PageHeader
        eyebrow="Shared resort know-how"
        title="Knowledge base"
        titleId="knowledge-title"
        lead="Find clear, reviewed fixes before opening another request."
        actionHref={
          canAuthor ? `/knowledge/new${search.ticket ? `?ticket=${search.ticket}` : ""}` : undefined
        }
        actionLabel={
          canAuthor ? (search.ticket ? "Propose from resolution" : "New article") : undefined
        }
      />
      {search.status === "linked" ? (
        <p className="form-feedback success" role="status">
          Article linked to the ticket.
        </p>
      ) : null}
      <form className="filter-bar knowledge-filter" method="get">
        {search.ticket ? <input type="hidden" name="ticket" value={search.ticket} /> : null}
        <label className="sr-only" htmlFor="knowledge-query">
          Search knowledge
        </label>
        <input
          id="knowledge-query"
          name="query"
          placeholder="Search titles, summaries, and guidance"
          defaultValue={search.query}
        />
        <select
          name="categoryId"
          aria-label="Article category"
          defaultValue={search.categoryId ?? ""}
        >
          <option value="">All categories</option>
          {options?.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        {canAuthor ? (
          <select name="state" aria-label="Workflow state" defaultValue={search.state ?? ""}>
            <option value="">Visible states</option>
            <option value="draft">Draft</option>
            <option value="in_review">In review</option>
            <option value="published">Published</option>
            <option value="retired">Retired</option>
          </select>
        ) : null}
        {canAuthor ? (
          <label className="knowledge-stale-toggle">
            <input type="checkbox" name="stale" value="1" defaultChecked={search.stale === "1"} />{" "}
            Review overdue
          </label>
        ) : null}
        <button className="secondary-button" type="submit">
          Search
        </button>
      </form>
      {articles ? (
        articles.length ? (
          <div className="knowledge-grid" aria-label="Knowledge articles">
            {articles.map((article) => (
              <Link
                className="knowledge-card"
                href={`/knowledge/${article.id}${search.ticket ? `?ticket=${search.ticket}` : ""}`}
                key={article.id}
              >
                <div className="knowledge-card-meta">
                  <span
                    className={`status-pill ${article.state === "published" ? "progress" : "waiting"}`}
                  >
                    {article.state.replace("_", " ")}
                  </span>
                  <span>{article.audience === "staff" ? "All staff" : "Technicians"}</span>
                </div>
                <h2>{article.title}</h2>
                <p>{article.summary}</p>
                <footer>
                  <span>{article.category?.name ?? "General"}</span>
                  <span>Review {date(article.reviewDate)}</span>
                  {article.stale ? <strong className="stale-label">Review overdue</strong> : null}
                </footer>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No articles match this search</strong>
            <p>Try a broader phrase or another category.</p>
          </div>
        )
      ) : (
        <div className="empty-state">
          <strong>Knowledge is temporarily unavailable</strong>
          <p>The service database could not be reached.</p>
        </div>
      )}
    </section>
  );
}
