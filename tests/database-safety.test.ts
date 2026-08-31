import { describe, expect, it } from "vitest";

import { requireSafeLocalDatabaseUrl } from "../scripts/database-safety";

describe("database reset safety", () => {
  it("accepts only the expected local database name", () => {
    const value = "postgresql://resort_app:local-only@127.0.0.1:54329/resort_service_desk_test";

    expect(
      requireSafeLocalDatabaseUrl(value, "TEST_DATABASE_URL", "resort_service_desk_test"),
    ).toBe(value);
  });

  it("rejects remote or incorrectly named targets without exposing credentials", () => {
    const secret = "do-not-print-this";
    const remote = `postgresql://resort_app:${secret}@database.example.com/production`;

    expect(() =>
      requireSafeLocalDatabaseUrl(remote, "TEST_DATABASE_URL", "resort_service_desk_test"),
    ).toThrow("TEST_DATABASE_URL must target a local database named resort_service_desk_test.");

    try {
      requireSafeLocalDatabaseUrl(remote, "TEST_DATABASE_URL", "resort_service_desk_test");
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
