/** @jest-environment node */

import { modules } from "../../config/modules";
import { validateCrudPayloadForWrite } from "../../lib/services/crudPayloadValidation";

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
});
