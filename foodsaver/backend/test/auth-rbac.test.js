const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const { pool } = require("../src/config/database");

const API_PORT = 4188;

let testServer;

function makePost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      `http://localhost:${API_PORT}${path}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: data });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

describe("Authentication & Security Audit Tests", () => {
  const testEmail = "security_qa_user@test.com";

  before(async () => {
    const express = require("express");
    const cors = require("cors");
    const { router: authRouter } = require("../src/routes/auth");
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use("/api/auth", authRouter);
    await new Promise((resolve) => {
      testServer = app.listen(API_PORT, resolve);
    });
    await pool.query("DELETE FROM users WHERE email = ?", [testEmail]);
  });

  after(async () => {
    await pool.query("DELETE FROM users WHERE email = ?", [testEmail]);
    if (testServer) testServer.close();
  });

  it("Customer Login & Account Creation: Should create user, authenticate and hash password securely", async () => {
    // 1. Register user
    const regRes = await makePost("/api/auth/register", {
      email: testEmail,
      password: "SuperSecurePassword123!",
      name: "Security QA User",
      role: "customer",
    });
    assert.strictEqual(regRes.statusCode, 200);

    // Mark user email_verified = TRUE for test session
    await pool.query("UPDATE dim_users SET email_verified = TRUE, email_verified_at = NOW(), status = 'APPROVED' WHERE LOWER(email) = ?", [testEmail]);

    // 2. Login user
    const res = await makePost("/api/auth/login", {
      email: testEmail,
      password: "SuperSecurePassword123!",
      name: "Security QA User",
      role: "customer",
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.token);

    // Verify MySQL: Password hash MUST NOT be plaintext
    const [rows] = await pool.query("SELECT password_hash FROM dim_users WHERE LOWER(email) = ?", [testEmail]);
    assert.strictEqual(rows.length, 1);
    assert.notStrictEqual(rows[0].password_hash, "SuperSecurePassword123!");
    assert.ok(rows[0].password_hash.startsWith("$2b$") || rows[0].password_hash.startsWith("$2a$"));
  });

  it("User Login: Should authenticate valid credentials and issue JWT token", async () => {
    const res = await makePost("/api/auth/login", {
      email: testEmail,
      password: "SuperSecurePassword123!",
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, testEmail);
  });

  it("Invalid Login: Should reject wrong password cleanly with 401 Unauthorized", async () => {
    const res = await makePost("/api/auth/login", {
      email: testEmail,
      password: "WrongPasswordAttempt!",
    });

    assert.strictEqual(res.statusCode, 401);
  });
});
