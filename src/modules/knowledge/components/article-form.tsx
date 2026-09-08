type ArticleFormValue = {
  id?: string;
  title?: string;
  summary?: string;
  body?: string;
  audience?: string;
  categoryId?: string | null;
  reviewerUserId?: string | null;
  reviewDate?: Date | null;
  currentVersion?: number;
  assetLinks?: { asset: { id: string } }[];
};

export function ArticleForm({
  article,
  options,
  sourceTicketId,
}: {
  article?: ArticleFormValue;
  options: {
    categories: { id: string; name: string }[];
    reviewers: { id: string; displayName: string }[];
    assets: { id: string; assetTag: string; name: string }[];
  };
  sourceTicketId?: string;
}) {
  const editing = Boolean(article?.id);
  return (
    <form className="knowledge-editor panel" action="/auth/knowledge" method="post">
      <input type="hidden" name="intent" value={editing ? "update" : "create"} />
      {article?.id ? <input type="hidden" name="articleId" value={article.id} /> : null}
      {article?.currentVersion ? (
        <input type="hidden" name="expectedVersion" value={article.currentVersion} />
      ) : null}
      {sourceTicketId ? <input type="hidden" name="sourceTicketId" value={sourceTicketId} /> : null}
      <div className="knowledge-editor-heading">
        <div>
          <p className="overline">
            {sourceTicketId ? "Resolution proposal" : editing ? "Article revision" : "New article"}
          </p>
          <h2>{editing ? "Refine the guidance" : "Capture a reusable fix"}</h2>
        </div>
        <span className="status-pill waiting">Draft workspace</span>
      </div>
      {sourceTicketId ? (
        <div className="privacy-note">
          <strong>Start with a clean page</strong>
          <p>
            Nothing from the ticket or its resolution is copied. Rewrite only reusable,
            non-sensitive guidance.
          </p>
        </div>
      ) : null}
      <label className="field-label" htmlFor="knowledge-title">
        Title
      </label>
      <input
        id="knowledge-title"
        name="title"
        defaultValue={article?.title}
        minLength={3}
        maxLength={180}
        required
      />
      <label className="field-label" htmlFor="knowledge-summary">
        Summary
      </label>
      <textarea
        id="knowledge-summary"
        name="summary"
        rows={3}
        defaultValue={article?.summary}
        minLength={10}
        maxLength={500}
        required
      />
      <label className="field-label" htmlFor="knowledge-body">
        Article body
      </label>
      <textarea
        id="knowledge-body"
        name="body"
        rows={16}
        defaultValue={article?.body}
        minLength={10}
        maxLength={50000}
        required
        aria-describedby="knowledge-format-help"
      />
      <small id="knowledge-format-help">
        Plain text with optional ## headings, lists, **bold**, and `code`. HTML is always displayed
        as text.
      </small>
      <div className="knowledge-form-grid">
        <label>
          Audience
          <select name="audience" defaultValue={article?.audience ?? "staff"}>
            <option value="staff">All staff</option>
            <option value="technician">Technicians only</option>
          </select>
        </label>
        <label>
          Ticket category
          <select name="categoryId" defaultValue={article?.categoryId ?? ""}>
            <option value="">No category</option>
            {options.categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reviewer
          <select name="reviewerUserId" defaultValue={article?.reviewerUserId ?? ""}>
            <option value="">Choose before review</option>
            {options.reviewers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Review date
          <input
            name="reviewDate"
            type="date"
            defaultValue={article?.reviewDate?.toISOString().slice(0, 10)}
          />
        </label>
        <label>
          Related asset
          <select name="assetId" defaultValue={article?.assetLinks?.[0]?.asset.id ?? ""}>
            <option value="">No related asset</option>
            {options.assets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.assetTag} · {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field-label" htmlFor="change-summary">
        Version note
      </label>
      <input
        id="change-summary"
        name="changeSummary"
        minLength={3}
        maxLength={500}
        placeholder={editing ? "What changed in this version?" : "Why is this article useful?"}
        required
      />
      <div className="form-actions">
        <button className="primary-button" type="submit">
          {editing ? "Save new version" : "Save draft"}
        </button>
      </div>
    </form>
  );
}
