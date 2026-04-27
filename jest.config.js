/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/jest"],
  testMatch: ["**/*.test.js"],
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "lib/modules/newCaseInward.js",
    "lib/db.js",
    "lib/rbac.js",
    "lib/rbacMatrixModules.js",
    "lib/permissionScope.js",
    "lib/rowScope.js",
    "lib/sqlModuleTable.js",
    "lib/sqlDateFieldValue.js",
    "lib/auth.js",
    "lib/audit.js",
    "lib/session.js",
    "lib/istDateTime.js",
    "lib/crudNormalize.js",
    "lib/crudLookupEnrich.js",
    "lib/childTablesSync.js",
    "lib/childTablesLoad.js",
    "lib/crudListSearch.js",
    "lib/crudListSelect.js",
    "lib/sqlLikeEscape.js",
    "lib/lookupLovAccess.js",
    "lib/lookupLovQueryParams.js",
    "lib/lookupLabelField.js",
    "lib/lookupLabelFieldSql.js",
    "lib/lookupUi.js",
    "lib/formFieldLabel.js",
    "lib/formatViewCellValue.js",
    "lib/gridRowValue.js",
    "lib/moduleAfterCreate.js",
    "lib/crudRecordAudit.js",
    "lib/newCaseInwardCaseStatus.js",
    "lib/newCaseInwardViewRowTone.js",
    "lib/newCaseInwardCaseDetailsPdf.js",
    "lib/services/crudPayloadValidation.js",
    "lib/services/crud.service.js"
  ]
};

