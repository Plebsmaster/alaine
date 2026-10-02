import { describe, expect, it } from "vitest";
import { chainSteps } from "@/app/(app)/vandaag/chain";

describe("chainSteps", () => {
  it("splitst op → en ->, zonder lege stappen", () => {
    expect(chainSteps("ACE-remming → minder angiotensine II -> minder aldosteron →  ")).toEqual([
      "ACE-remming",
      "minder angiotensine II",
      "minder aldosteron",
    ]);
    expect(chainSteps("")).toEqual([]);
  });
});
