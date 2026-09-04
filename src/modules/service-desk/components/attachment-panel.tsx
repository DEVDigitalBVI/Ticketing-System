import Link from "next/link";

import type { TicketAttachmentView } from "@/server/attachments/service";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scanLabel(status: TicketAttachmentView["scanStatus"]) {
  switch (status) {
    case "clean":
      return "Security check passed";
    case "infected":
      return "Blocked by security check";
    case "failed":
      return "Security check unavailable";
    case "pending":
      return "Quarantined · check pending";
  }
}

export function AttachmentPanel({
  ticketId,
  attachments,
  returnTo,
  filter,
  page,
  allowInternal = false,
}: {
  ticketId: string;
  attachments: TicketAttachmentView[];
  returnTo: "staff" | "technician";
  filter?: string;
  page?: number;
  allowInternal?: boolean;
}) {
  return (
    <section className="attachment-panel" aria-labelledby={`attachments-${ticketId}`}>
      <div className="attachment-heading">
        <div>
          <p className="overline">Private files</p>
          <h3 id={`attachments-${ticketId}`}>Attachments</h3>
        </div>
        <span>{attachments.length}</span>
      </div>
      {attachments.length ? (
        <ul className="attachment-list">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <span className="attachment-file" aria-hidden="true">
                ↗
              </span>
              <span>
                <strong>{attachment.fileName}</strong>
                <small>
                  {fileSize(attachment.byteSize)} · {scanLabel(attachment.scanStatus)}
                </small>
              </span>
              {attachment.canDownload ? (
                <Link href={`/attachments/${attachment.id}`}>Download</Link>
              ) : (
                <span className="attachment-locked">Locked</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="attachment-empty">No files have been added to this ticket.</p>
      )}
      <form
        className="attachment-upload"
        action="/auth/ticket-attachment"
        method="post"
        encType="multipart/form-data"
      >
        <input type="hidden" name="ticketId" value={ticketId} />
        <input type="hidden" name="returnTo" value={returnTo} />
        {filter ? <input type="hidden" name="filter" value={filter} /> : null}
        {page ? <input type="hidden" name="page" value={String(page)} /> : null}
        {allowInternal ? (
          <label>
            Visibility
            <select name="visibility" defaultValue="requester">
              <option value="requester">Requester and IT</option>
              <option value="internal">IT only</option>
            </select>
          </label>
        ) : (
          <input type="hidden" name="visibility" value="requester" />
        )}
        <label>
          Add screenshot or document
          <input type="file" name="attachment" accept=".png,.jpg,.jpeg,.webp,.pdf,.txt" required />
        </label>
        <small>PNG, JPG, WebP, PDF, or TXT · 10 MB maximum</small>
        <button className="secondary-button" type="submit">
          Upload privately
        </button>
      </form>
      <p className="attachment-note">
        Files stay private. Until malware scanning is available and a file passes its check, only
        its uploader can download it.
      </p>
    </section>
  );
}
