import { describe, expect, it } from "vitest";
import { checkExcerpt, isLiteralExcerpt } from "@/lib/ai/excerpt";

const SOURCE = `Het slagvolume is het einddiastolisch volume (EDV) min het eindsystolisch volume (ESV).
De ejectiefractie is het slagvolume gedeeld door het EDV — normaal is dat 55–70%.
ACE-remmers verlagen de vorming van angiotensine II, waardoor minder aldosteron vrijkomt.`;

describe("isLiteralExcerpt", () => {
  it("vindt een letterlijk citaat, ook over regels heen", () => {
    expect(isLiteralExcerpt(SOURCE, "min het eindsystolisch volume (ESV). De ejectiefractie is")).toBe(true);
  });

  it("negeert verschillen in witruimte, streepjes, hoofdletters en afkappunten", () => {
    expect(isLiteralExcerpt(SOURCE, "…het EDV - normaal is dat 55-70%.")).toBe(true);
    expect(isLiteralExcerpt(SOURCE, "ace-remmers   verlagen de vorming van angiotensine II")).toBe(true);
  });

  it("weigert een parafrase of iets dat er niet staat", () => {
    expect(isLiteralExcerpt(SOURCE, "ACE-remmers verhogen het kalium via minder aldosteron.")).toBe(false);
    expect(isLiteralExcerpt(SOURCE, "Het slagvolume is EDV min ESV.")).toBe(false);
  });

  it("weigert een te kort citaat", () => {
    expect(isLiteralExcerpt(SOURCE, "EDV")).toBe(false);
  });
});

describe("checkExcerpt", () => {
  it("bewaart een letterlijk citaat, zonder te controleren", () => {
    expect(checkExcerpt(SOURCE, "waardoor minder aldosteron vrijkomt")).toEqual({
      excerpt: "waardoor minder aldosteron vrijkomt",
      needsVerification: false,
    });
  });

  it("bewaart een verzonnen citaat niet en markeert de kaart", () => {
    expect(checkExcerpt(SOURCE, "ACE-remmers geven hyperkaliëmie bij nierinsufficiëntie.")).toEqual({
      excerpt: null,
      needsVerification: true,
    });
  });

  it("zonder citaat: markeren", () => {
    expect(checkExcerpt(SOURCE, "  ")).toEqual({ excerpt: null, needsVerification: true });
  });
});
