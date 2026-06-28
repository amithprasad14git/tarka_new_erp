/** @jest-environment node */

import { getLookupPickerSearchPlaceholder } from "../../lib/lookupUi";

describe("getLookupPickerSearchPlaceholder", () => {
  test("Case No picker searches caseNo only", () => {
    expect(
      getLookupPickerSearchPlaceholder({
        module: "new_case_inward",
        valueField: "id",
        pickerSortBy: "id",
        pickerSortDir: "desc",
        pickerColumns: [{ field: "caseNo", header: "Case No" }]
      })
    ).toBe("Enter the Case No and Press Enter to Search");
  });

  test("branch picker searches branch code and name", () => {
    expect(
      getLookupPickerSearchPlaceholder({
        module: "branch_master",
        valueField: "id",
        pickerColumns: [
          { field: "branchCode", header: "Branch Code" },
          { field: "branchName", header: "Branch Name" }
        ]
      })
    ).toBe("Enter Branch Code or Branch Name and Press Enter to Search");
  });

  test("explicit pickerSearchPlaceholder wins", () => {
    expect(
      getLookupPickerSearchPlaceholder({
        module: "new_case_inward",
        pickerSearchPlaceholder: "Custom hint"
      })
    ).toBe("Custom hint");
  });
});
