import { describe, expect, it } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { isDatabaseUnavailableError } from "@/server/database/errors";

describe("database error classification", () => {
  it.each(["P1000", "P1001", "P1002", "P1003", "P2021", "P2022"])(
    "treats %s as a section availability problem",
    (code) => {
      expect(
        isDatabaseUnavailableError(
          new Prisma.PrismaClientKnownRequestError("safe failure", {
            code,
            clientVersion: "test",
          }),
        ),
      ).toBe(true);
    },
  );

  it("recognizes an adapter-level PostgreSQL authentication failure", () => {
    const error = Object.assign(new Error("database authentication failed"), { code: "28P01" });
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it("does not hide ordinary application defects", () => {
    expect(isDatabaseUnavailableError(new Error("unexpected mapping defect"))).toBe(false);
  });
});
