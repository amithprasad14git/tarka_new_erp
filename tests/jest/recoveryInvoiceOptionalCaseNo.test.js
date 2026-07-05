/** @jest-environment node */

import { modules } from "../../config/modules";
import { reports } from "../../config/reports";
import { validateCrudPayloadForWrite } from "../../lib/services/crudPayloadValidation";
import { validateRecoveryInvoiceClientSubmit } from "../../lib/modules/recoveryInvoiceClient";

function collectNpaCurrentAcLookups(registry) {
  const out = [];
  for (const cfg of Object.values(registry)) {
    for (const f of cfg.fields || []) {
      if (f.name === "npaCurrentAc" && f.lookup) {
        out.push(f.lookup);
      }
    }
  }
  return out;
}

describe("recovery_invoice optional caseNo", () => {
  test("caseNo is optional in module config", () => {
    const field = modules.recovery_invoice.fields.find((f) => f.name === "caseNo");
    expect(field?.required).toBe(false);
  });

  test("sarfaesi and vehicle caseNo remain required", () => {
    expect(modules.sarfaesi_invoice.fields.find((f) => f.name === "caseNo")?.required).toBe(true);
    expect(modules.vehicle_invoice.fields.find((f) => f.name === "caseNo")?.required).toBe(true);
  });

  test("create without caseNo passes when billToUnit and other required fields are set", () => {
    const body = {
      date: "2026-06-01",
      billToUnit: 2,
      npaCurrentAc: 1,
      cancelledInvoice: "No",
      finalInvoice: "Yes"
    };
    const err = validateCrudPayloadForWrite(
      modules.recovery_invoice,
      body,
      "create",
      Object.keys(body)
    );
    expect(err).toBeNull();
  });

  test("all module npaCurrentAc lookups filter active Yes", () => {
    const lookups = collectNpaCurrentAcLookups(modules);
    expect(lookups.length).toBeGreaterThanOrEqual(8);
    for (const lookup of lookups) {
      expect(lookup.extraLovParams?.f_active).toBe("Yes");
    }
  });

  test("all report npaCurrentAc filters filter active Yes", () => {
    const lookups = collectNpaCurrentAcLookups(reports);
    expect(lookups.length).toBeGreaterThanOrEqual(10);
    for (const lookup of lookups) {
      expect(lookup.extraLovParams?.f_active).toBe("Yes");
    }
  });

  test("client submit requires billToUnit and npa when caseNo empty", () => {
    expect(
      validateRecoveryInvoiceClientSubmit({
        cancelledInvoice: "No",
        billToUnit: "",
        npaCurrentAc: ""
      })
    ).toBe("Bill to Unit and NPA Current AC are required when Case No is not selected.");
    expect(
      validateRecoveryInvoiceClientSubmit({
        cancelledInvoice: "No",
        billToUnit: 2,
        npaCurrentAc: 1
      })
    ).toBeNull();
  });
});
