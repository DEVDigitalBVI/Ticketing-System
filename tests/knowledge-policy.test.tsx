import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SafeArticleBody } from "@/modules/knowledge/components/safe-article-body";
import { articleInputSchema, isStaleArticle, workflowTransitions } from "@/server/knowledge/policy";

describe("knowledge policy", () => {
  it("supports the approved editorial lifecycle without skipping review", () => {
    expect(workflowTransitions.draft).toEqual(["in_review"]);
    expect(workflowTransitions.in_review).toContain("published");
    expect(workflowTransitions.draft).not.toContain("published");
    expect(workflowTransitions.published).toEqual(["retired"]);
  });

  it("reports published guidance after its UTC review date", () => {
    expect(
      isStaleArticle(new Date("2026-09-07T00:00:00.000Z"), new Date("2026-09-08T12:00:00.000Z")),
    ).toBe(true);
    expect(
      isStaleArticle(new Date("2026-09-08T00:00:00.000Z"), new Date("2026-09-08T23:59:00.000Z")),
    ).toBe(false);
  });

  it("rejects unbounded or unsupported article fields", () => {
    expect(
      articleInputSchema.safeParse({
        title: "Hi",
        summary: "Too short",
        body: "Too short",
        audience: "guest",
        changeSummary: "No",
      }).success,
    ).toBe(false);
  });

  it("renders unsafe markup as inert text and never creates script or image elements", () => {
    const { container } = render(
      <SafeArticleBody
        body={'## Reset safely\n\n<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>'}
      />,
    );
    expect(screen.getByText('<script>alert("x")</script>')).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
