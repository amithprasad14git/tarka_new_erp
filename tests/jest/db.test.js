// Test file — automated checks so changes do not break existing behaviour.

/**
 * Tests for `db`.
 * Run with: npm test
 */

// Test file for validating app behavior and regression safety.
// Keep module-specific business logic in lib/modules/<module> files.

/**
 * Comprehensive tests for lib/db.js
 */

// Helper used by tests: withEnv.
function withEnv(tempEnv, fn) {
  const prev = { ...process.env };
  process.env = { ...prev, ...tempEnv };
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      process.env = prev;
    });
}

// Helper used by tests: loadDbModule.
function loadDbModule({ env = {}, createPoolImpl, fsExistsSync = () => false, fsReadFileSync = () => "" } = {}) {
  jest.resetModules();
  process.env = { ...process.env, ...env };
  delete globalThis.__erpMysqlPool;

  const mockPool = {
    query: jest.fn(async () => [[]]),
    on: jest.fn()
  };
  const createPoolMock = jest.fn(createPoolImpl || (() => mockPool));

  jest.doMock("mysql2/promise", () => ({
    createPool: createPoolMock
  }));
  jest.doMock("fs", () => ({
    existsSync: jest.fn(fsExistsSync),
    readFileSync: jest.fn(fsReadFileSync)
  }));

  const db = require("../../lib/db");
  return { db, mockPool, createPoolMock };
}

// Automated checks for: lib/db.
describe("lib/db", () => {
  test("missing required environment variables", async () => {
    await withEnv(
      {
        DB_HOST: "",
        DB_USER: "",
        DB_PASS: "",
        DB_NAME: ""
      },
      async () => {
        const { db } = loadDbModule();
        expect(db.getMissingRequiredDbEnvVars()).toEqual(["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]);
      }
    );
  });

  test("production localhost rejection (helper)", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        DB_HOST: "localhost",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule();
        expect(db.getLoopbackDbHostError()).toContain("DB_HOST is localhost");
      }
    );
  });

  test("production non-loopback helper returns null", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        DB_HOST: "mydb.abc.ap-south-1.rds.amazonaws.com",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule();
        expect(db.getLoopbackDbHostError()).toBeNull();
      }
    );
  });

  test("production helper returns null when host is blank", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        DB_HOST: "   ",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule();
        expect(db.getLoopbackDbHostError()).toBeNull();
      }
    );
  });

  test("production localhost rejection (pool creation path)", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        DB_HOST: "127.0.0.1",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule();
        expect(() => db.default.query("SELECT 1")).toThrow(
          "DB_HOST cannot be localhost in production"
        );
      }
    );
  });

  test("pool singleton reuse", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db, createPoolMock, mockPool } = loadDbModule();
        mockPool.query.mockResolvedValueOnce([["ok1"]]).mockResolvedValueOnce([["ok2"]]);

        await db.default.query("SELECT 1");
        await db.default.query("SELECT 2");

        expect(createPoolMock).toHaveBeenCalledTimes(1);
        expect(mockPool.query).toHaveBeenCalledTimes(2);
      }
    );
  });

  test("connection limit clamping", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d",
        DB_POOL_LIMIT: "1000"
      },
      async () => {
        const { db, createPoolMock } = loadDbModule();
        await db.default.query("SELECT 1");

        const cfg = createPoolMock.mock.calls[0][0];
        expect(cfg.connectionLimit).toBe(25);
        expect(cfg.maxIdle).toBe(24);
      }
    );

    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d",
        DB_POOL_LIMIT: "0"
      },
      async () => {
        const { db, createPoolMock } = loadDbModule();
        await db.default.query("SELECT 1");

        const cfg = createPoolMock.mock.calls[0][0];
        expect(cfg.connectionLimit).toBe(1);
        expect(cfg.maxIdle).toBe(0);
      }
    );
  });

  test("timezone initialization", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db, mockPool } = loadDbModule();
        await db.default.query("SELECT 1");

        expect(mockPool.on).toHaveBeenCalledWith("connection", expect.any(Function));
        const handler = mockPool.on.mock.calls[0][1];
        const conn = { query: jest.fn((sql, cb) => cb && cb(null)) };
        handler(conn);
        expect(conn.query).toHaveBeenCalledWith("SET SESSION time_zone = '+05:30'", expect.any(Function));
      }
    );
  });

  test("timezone initialization logs error when SET SESSION fails", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        try {
          const { db, mockPool } = loadDbModule();
          await db.default.query("SELECT 1");
          const handler = mockPool.on.mock.calls[0][1];
          const conn = { query: jest.fn((sql, cb) => cb && cb(new Error("tz failed"))) };
          handler(conn);
          expect(spy).toHaveBeenCalledWith("[db] SET SESSION time_zone failed", expect.any(Error));
        } finally {
          spy.mockRestore();
        }
      }
    );
  });

  test("connection failure handling (mysql2 createPool throws)", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule({
          createPoolImpl: () => {
            throw new Error("createPool failed");
          }
        });

        expect(() => db.default.query("SELECT 1")).toThrow("createPool failed");
      }
    );
  });

  test("throws clear error when DB_HOST is empty during pool creation", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "   ",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule();
        expect(() => db.default.query("SELECT 1")).toThrow("DB_HOST is empty");
      }
    );
  });

  test("ssl uses inline CA PEM and sets rejectUnauthorized true", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d",
        DB_SSL: "true",
        DB_SSL_CA_PEM: "-----BEGIN CERT-----\\nabc\\n-----END CERT-----"
      },
      async () => {
        const { db, createPoolMock } = loadDbModule();
        await db.default.query("SELECT 1");
        const cfg = createPoolMock.mock.calls[0][0];
        expect(cfg.ssl).toEqual({
          ca: "-----BEGIN CERT-----\nabc\n-----END CERT-----",
          rejectUnauthorized: true
        });
      }
    );
  });

  test("ssl reads CA file when path exists", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d",
        DB_SSL: "yes",
        DB_SSL_CA: "/path/to/ca.pem"
      },
      async () => {
        const { db, createPoolMock } = loadDbModule({
          fsExistsSync: () => true,
          fsReadFileSync: () => "CA_FROM_FILE"
        });
        await db.default.query("SELECT 1");
        const cfg = createPoolMock.mock.calls[0][0];
        expect(cfg.ssl).toEqual({
          ca: "CA_FROM_FILE",
          rejectUnauthorized: true
        });
      }
    );
  });

  test("ssl handles invalid CA path and respects rejectUnauthorized override", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d",
        DB_SSL: "1",
        DB_SSL_CA: "/bad/path",
        DB_SSL_REJECT_UNAUTHORIZED: "false"
      },
      async () => {
        const { db, createPoolMock } = loadDbModule({
          fsExistsSync: () => {
            throw new Error("path check failed");
          }
        });
        await db.default.query("SELECT 1");
        const cfg = createPoolMock.mock.calls[0][0];
        expect(cfg.ssl).toEqual({
          rejectUnauthorized: false
        });
      }
    );
  });

  test("proxy returns non-function properties from underlying pool", async () => {
    await withEnv(
      {
        NODE_ENV: "test",
        DB_HOST: "db.example",
        DB_USER: "u",
        DB_PASS: "p",
        DB_NAME: "d"
      },
      async () => {
        const { db } = loadDbModule({
          createPoolImpl: () => ({
            on: jest.fn(),
            query: jest.fn(async () => [[]]),
            config: { tag: "pool-config" }
          })
        });
        expect(db.default.config).toEqual({ tag: "pool-config" });
      }
    );
  });
});


