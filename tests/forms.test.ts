import { describe, expect, test } from "bun:test";
import { submissionSchema } from "../src/plugins/community/validation";
import { safeUrl, localizedPath } from "../src/i18n";
const valid = {
  submissionId: crypto.randomUUID(),
  type: "community",
  locale: "nl",
  name: "Test",
  email: "test@example.com",
  consent: true,
};
describe("public form boundary", () => {
  test("rejects missing privacy consent and unsupported form types", () => {
    expect(
      submissionSchema.safeParse({ ...valid, consent: false }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({ ...valid, type: "users" }).success,
    ).toBe(false);
  });
  test("requires separate newsletter consent", () => {
    expect(
      submissionSchema.safeParse({ ...valid, type: "newsletter" }).success,
    ).toBe(false);
    expect(
      submissionSchema.safeParse({
        ...valid,
        type: "newsletter",
        updates: true,
      }).success,
    ).toBe(true);
  });
  test("rejects incomplete contact, artist and registration requests", () => {
    for (const type of ["contact", "artist", "registration"])
      expect(submissionSchema.safeParse({ ...valid, type }).success).toBe(
        false,
      );
  });
  test("bounds payload and locale and strips undeclared fields", () => {
    expect(
      submissionSchema.safeParse({ ...valid, message: "x".repeat(5001) })
        .success,
    ).toBe(false);
    expect(submissionSchema.safeParse({ ...valid, locale: "fr" }).success).toBe(
      false,
    );
    const parsed = submissionSchema.parse({
      ...valid,
      admin: true,
      email: "TEST@example.com",
    });
    expect(parsed.email).toBe("test@example.com");
    expect(parsed).not.toHaveProperty("admin");
  });
});
test("CMS buttons cannot inject executable or protocol-relative URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,test",
    "//evil.example",
    "/\\evil.example",
    " https://evil.example",
  ])
    expect(safeUrl(url, "/")).toBe("/");
  expect(safeUrl("/events")).toBe("/events");
  expect(localizedPath("en", "/events")).toBe("/en/events");
});
