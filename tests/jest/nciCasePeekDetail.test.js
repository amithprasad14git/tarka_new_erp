/**
 * Tests for NCI case peek / snapshot card layout.
 */

jest.mock("../../lib/gridRowValue", () => ({
  rowValueForField: (row, field) => (row && Object.prototype.hasOwnProperty.call(row, field) ? row[field] : null)
}));

jest.mock("../../lib/lookupLabelField", () => ({
  getLookupRowLabelKey: (f) => f.displayKey || `${f.name}Label`
}));

jest.mock("../../lib/formatViewCellValue", () => ({
  formatViewCellValue: (f, raw) => String(raw ?? "")
}));

const { modules } = require("../../config/modules");
const {
  buildNciReadonlyModalDetail,
  partitionNciPeekParentFields
} = require("../../lib/modules/nciCasePeekDetailBuild");

const nciConfig = modules.new_case_inward;

describe("partitionNciPeekParentFields", () => {
  test("splits fields into summary, status, and footer slices", () => {
    const fields = nciConfig.fields;
    const { summaryFields, statusFields, footerFields } = partitionNciPeekParentFields(fields);
    expect(summaryFields.map((f) => f.name)).toContain("caseNo");
    expect(summaryFields.map((f) => f.name)).toContain("closureBalance");
    expect(summaryFields.map((f) => f.name)).not.toContain("caseStatus");
    expect(statusFields.map((f) => f.name)).toEqual([
      "caseStatusUpdatedDate",
      "caseStatus",
      "caseStatusRemarks"
    ]);
    expect(footerFields.map((f) => f.name)).toEqual([
      "finalInvoice",
      "createdBy",
      "createdDate",
      "modifiedBy",
      "modifiedDate"
    ]);
  });
});

describe("buildNciReadonlyModalDetail", () => {
  const parent = {
    id: 42,
    caseNo: "BANK/HL/00001",
    closureBalance: 50000,
    caseStatusUpdatedDate: "2026-01-15",
    caseStatus: 3,
    caseStatusLabel: "Closed",
    caseStatusRemarks: "Done",
    finalInvoice: "Yes",
    createdBy: 1,
    createdBy_fullName: "Admin",
    createdDate: "2026-07-03 09:05:00",
    modifiedBy: 2,
    modifiedBy_fullName: "Clerk",
    modifiedDate: "2026-07-03 17:30:45"
  };

  test("returns three cards with footer audit dates formatted", () => {
    const detail = buildNciReadonlyModalDetail(
      {
        data: parent,
        childTableRows: {
          amount_recovered: [{ recoveredDate: "2026-02-01", recoveredAmount: 1000 }]
        }
      },
      nciConfig
    );

    expect(detail).not.toBeNull();
    expect(detail.cards).toHaveLength(3);
    expect(detail.cards[0].id).toBe("summary");
    expect(detail.cards[1].id).toBe("statusAndRecovery");
    expect(detail.cards[2].id).toBe("footer");

    const summaryLabels = detail.cards[0].rows.map((r) => r.label);
    expect(summaryLabels).toContain("Closure Balance");
    expect(summaryLabels).not.toContain("Final Invoice");

    expect(detail.cards[1].title).toBe("Case Status Update");
    expect(detail.cards[1].childBlocks).toHaveLength(1);
    expect(detail.cards[1].childBlocks[0].key).toBe("amount_recovered");

    const footerRows = detail.cards[2].rows;
    expect(footerRows.find((r) => r.label === "Final Invoice")?.value).toBe("Yes");
    expect(footerRows.find((r) => r.label === "Created Date")?.value).toBe("03-07-2026 9:05 AM");
    expect(footerRows.find((r) => r.label === "Modified Date")?.value).toBe("03-07-2026 5:30 PM");
  });

  test("amount_recovered appears only in status card", () => {
    const detail = buildNciReadonlyModalDetail({ data: parent, childTableRows: {} }, nciConfig);
    expect(detail.cards[0].childBlocks).toBeUndefined();
    expect(detail.cards[2].childBlocks).toBeUndefined();
    expect(detail.cards[1].childBlocks[0].rows).toEqual([]);
  });
});
