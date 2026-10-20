import { describe, it, expect } from "vitest";

// The service-role client bypasses RLS. `server-only` makes any client
// bundle that imports it fail the build; only Server Components and server
// actions resolve it to an empty module. Vitest resolves it the way a client
// bundle would, so importing the real module here must throw.
describe("service-role client", () => {
  it("can't be imported outside the server", async () => {
    await expect(import("../service")).rejects.toThrow(/Client Component/);
  });
});
