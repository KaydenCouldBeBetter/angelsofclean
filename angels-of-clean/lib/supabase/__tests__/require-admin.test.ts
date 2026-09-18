import { describe, it, expect, vi, beforeEach } from "vitest";

const getUserMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: getUserMock } }),
}));

import {
  requireAdmin,
  NOT_SIGNED_IN_ERROR,
  NOT_AUTHORIZED_ERROR,
} from "../require-admin";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("refuses when there is no session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses when token verification errors", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_SIGNED_IN_ERROR });
  });

  it("refuses a verified user whose app_metadata has no admin role", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { email: "user@example.com", app_metadata: {} } },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_AUTHORIZED_ERROR });
  });

  it("ignores the client-editable user_metadata when deciding the role", async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          email: "user@example.com",
          app_metadata: {},
          user_metadata: { role: "admin" },
        },
      },
      error: null,
    });

    const result = await requireAdmin();

    expect(result).toEqual({ ok: false, error: NOT_AUTHORIZED_ERROR });
  });

  it("accepts a verified user with app_metadata.role === 'admin'", async () => {
    const user = { email: "admin@example.com", app_metadata: { role: "admin" } };
    getUserMock.mockResolvedValue({ data: { user }, error: null });

    const result = await requireAdmin();

    expect(result).toMatchObject({ ok: true, user });
  });
});
