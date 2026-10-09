const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const http = require("node:http");
const express = require("express");
const { router: authRouter } = require("../src/routes/auth");

const API_PORT = 4199;
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

describe("Google OAuth API Tests", () => {
  before((done) => {
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    testServer = app.listen(API_PORT, done);
  });

  after((done) => {
    if (testServer) {
      testServer.close(done);
    } else {
      done();
    }
  });

  it("POST /api/auth/google: Should reject request without credential or access token", async () => {
    const res = await makePost("/api/auth/google", {});
    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.body.error, "Google credential token is required.");
  });

  it("POST /api/auth/google: Should return 401 when invalid ID token is provided", async () => {
    const res = await makePost("/api/auth/google", {
      credential: "invalid_google_jwt_token_string",
      role: "customer",
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, "Invalid Google authorization token.");
  });

  it("POST /api/auth/google: Should return 401 when invalid access token is provided", async () => {
    const res = await makePost("/api/auth/google", {
      accessToken: "invalid_access_token_string",
      role: "customer",
    });
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.body.error, "Invalid Google authorization token.");
  });
});
