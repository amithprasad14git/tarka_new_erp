import { buildLookupLovCacheKey, clearLookupLovCache, fetchLookupLovCached } from "../../lib/lookupLovCache";

describe("lookupLovCache", () => {
  afterEach(() => clearLookupLovCache());

  test("fetchLookupLovCached dedupes concurrent requests", async () => {
    const key = buildLookupLovCacheKey(
      { module: "unit_master", extraLovParams: { f_active: "Yes" } },
      "unitCode"
    );
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return [{ id: 1 }];
    };
    const [a, b] = await Promise.all([
      fetchLookupLovCached(key, loader),
      fetchLookupLovCached(key, loader)
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual([{ id: 1 }]);
    expect(b).toEqual([{ id: 1 }]);
  });

  test("fetchLookupLovCached returns settled cache without reloading", async () => {
    const key = buildLookupLovCacheKey({ module: "bank_master" }, "bankName");
    let calls = 0;
    const loader = async () => {
      calls += 1;
      return [{ id: 2 }];
    };
    await fetchLookupLovCached(key, loader);
    await fetchLookupLovCached(key, loader);
    expect(calls).toBe(1);
  });
});
