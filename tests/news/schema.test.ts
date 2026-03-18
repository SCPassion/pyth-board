import { describe, expect, it } from "vitest";
import schema from "../../convex/schema";

describe("news schema", () => {
  it("exports a schema object", () => {
    expect(schema).toBeTruthy();
  });
});
