const { pool } = require("../src/config/database");

const API_BASE = "http://localhost:4000";

async function runE2ETests() {
  console.log("🚀 Starting 12-Step Complete E2E QA Security Audit & Test Suite...");

  let testUser1Email = `user1_${Date.now()}@test.com`;
  let testUser1Pass = "User1Pass@123";
  let testUser1Id = null;

  let testUser2Email = `user2_${Date.now()}@test.com`;
  let testUser2Pass = "User2Pass@123";
  let testUser2Id = null;

  let adminToken = null;
  let normalUserToken = null;

  try {
    // TEST 1: Register a new user & verify MySQL status = PENDING
    console.log("\n--- TEST 1: Register new user ---");
    const regRes1 = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser1Email,
        password: testUser1Pass,
        name: "Test User One",
        role: "USER",
      }),
    });
    const regData1 = await regRes1.json();
    console.log("Registration response:", regData1);
    if (!regData1.ok || !regData1.message.includes("waiting for administrator approval")) {
      throw new Error(`Test 1 Failed: Registration response invalid - ${JSON.stringify(regData1)}`);
    }

    const [dbRows1] = await pool.query(
      "SELECT * FROM dim_users WHERE LOWER(email) = ?",
      [testUser1Email]
    );
    if (dbRows1.length === 0) throw new Error("Test 1 Failed: User record not found in MySQL");
    console.log("MySQL User 1 Status:", dbRows1[0].status);
    if (dbRows1[0].status !== "PENDING") {
      throw new Error(`Test 1 Failed: Expected status PENDING in MySQL, got ${dbRows1[0].status}`);
    }
    testUser1Id = dbRows1[0].user_id;
    console.log("✅ TEST 1 PASSED: User registered with status = PENDING in MySQL.");

    // TEST 2: Try logging in with the pending account -> Expected LOGIN BLOCKED
    console.log("\n--- TEST 2: Attempt login with PENDING account ---");
    const loginRes1 = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser1Email, password: testUser1Pass }),
    });
    const loginData1 = await loginRes1.json();
    console.log("Pending login response (Status:", loginRes1.status, "):", loginData1);
    if (loginRes1.status !== 403 || !loginData1.error.includes("waiting for administrator approval")) {
      throw new Error(`Test 2 Failed: Login should be blocked for pending user - ${JSON.stringify(loginData1)}`);
    }
    console.log("✅ TEST 2 PASSED: Login blocked for PENDING account with correct message.");

    // TEST 3: Login as admin (admin@yourapp.com / Admin@12345)
    console.log("\n--- TEST 3: Login as Administrator ---");
    const adminLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@yourapp.com", password: "Admin@12345", role: "admin" }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log("Admin login response:", adminLoginData);
    if (!adminLoginRes.ok || !adminLoginData.token) {
      throw new Error(`Test 3 Failed: Admin login failed - ${JSON.stringify(adminLoginData)}`);
    }
    adminToken = adminLoginData.token;
    console.log("✅ TEST 3 PASSED: Admin authenticated successfully, JWT issued.");

    // TEST 4: Approve the pending user -> Verify MySQL status = APPROVED, approved_at, approved_by
    console.log("\n--- TEST 4: Approve pending user via Admin API ---");
    const approveRes = await fetch(`${API_BASE}/api/admin/users/${testUser1Id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const approveData = await approveRes.json();
    console.log("Approve API response:", approveData);
    if (!approveRes.ok || !approveData.ok) {
      throw new Error(`Test 4 Failed: Approve API failed - ${JSON.stringify(approveData)}`);
    }

    const [dbApprovedRows] = await pool.query(
      "SELECT * FROM dim_users WHERE user_id = ?",
      [testUser1Id]
    );
    const approvedUserObj = dbApprovedRows[0];
    console.log("MySQL User 1 Approved Record:", {
      status: approvedUserObj.status,
      approved_at: approvedUserObj.approved_at,
      approved_by: approvedUserObj.approved_by,
    });
    if (approvedUserObj.status !== "APPROVED" || !approvedUserObj.approved_at || !approvedUserObj.approved_by) {
      throw new Error("Test 4 Failed: MySQL record not properly updated with status APPROVED, approved_at, approved_by.");
    }
    console.log("✅ TEST 4 PASSED: User approved successfully and verified in MySQL.");

    // TEST 5: Login using the approved user
    console.log("\n--- TEST 5: Login with APPROVED account ---");
    const approvedLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser1Email, password: testUser1Pass }),
    });
    const approvedLoginData = await approvedLoginRes.json();
    console.log("Approved login response:", approvedLoginData);
    if (!approvedLoginRes.ok || !approvedLoginData.token) {
      throw new Error(`Test 5 Failed: Login for approved user failed - ${JSON.stringify(approvedLoginData)}`);
    }
    normalUserToken = approvedLoginData.token;
    console.log("✅ TEST 5 PASSED: Approved user login successful.");

    // TEST 6: Register another user -> Verify status = PENDING
    console.log("\n--- TEST 6: Register second user ---");
    const regRes2 = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser2Email,
        password: testUser2Pass,
        name: "Test User Two",
        role: "USER",
      }),
    });
    const regData2 = await regRes2.json();
    const [dbRows2] = await pool.query("SELECT * FROM dim_users WHERE LOWER(email) = ?", [testUser2Email]);
    if (dbRows2.length === 0 || dbRows2[0].status !== "PENDING") {
      throw new Error("Test 6 Failed: User 2 record not PENDING in MySQL.");
    }
    testUser2Id = dbRows2[0].user_id;
    console.log("✅ TEST 6 PASSED: Second user registered with status PENDING.");

    // TEST 7: Reject that user -> Verify MySQL status = REJECTED, rejected_at, rejected_by
    console.log("\n--- TEST 7: Reject user via Admin API ---");
    const rejectRes = await fetch(`${API_BASE}/api/admin/users/${testUser2Id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const rejectData = await rejectRes.json();
    console.log("Reject API response:", rejectData);

    const [dbRejectedRows] = await pool.query("SELECT * FROM dim_users WHERE user_id = ?", [testUser2Id]);
    const rejectedUserObj = dbRejectedRows[0];
    console.log("MySQL User 2 Rejected Record:", {
      status: rejectedUserObj.status,
      rejected_at: rejectedUserObj.rejected_at,
      rejected_by: rejectedUserObj.rejected_by,
    });
    if (rejectedUserObj.status !== "REJECTED" || !rejectedUserObj.rejected_at || !rejectedUserObj.rejected_by) {
      throw new Error("Test 7 Failed: MySQL record not updated with REJECTED, rejected_at, rejected_by.");
    }
    console.log("✅ TEST 7 PASSED: User rejected and verified in MySQL.");

    // TEST 8: Try logging in using rejected user -> Expected LOGIN BLOCKED
    console.log("\n--- TEST 8: Attempt login with REJECTED user ---");
    const rejectedLoginRes = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser2Email, password: testUser2Pass }),
    });
    const rejectedLoginData = await rejectedLoginRes.json();
    console.log("Rejected login response (Status:", rejectedLoginRes.status, "):", rejectedLoginData);
    if (rejectedLoginRes.status !== 403 || !rejectedLoginData.error.includes("rejected by the administrator")) {
      throw new Error(`Test 8 Failed: Rejected user login was not blocked properly - ${JSON.stringify(rejectedLoginData)}`);
    }
    console.log("✅ TEST 8 PASSED: Login blocked for REJECTED account with correct message.");

    // TEST 9 & 10: Try directly calling approval API as normal user -> Expected HTTP 403 / unauthorized
    console.log("\n--- TEST 9 & 10: Normal user calls Admin Approval API directly ---");
    const unauthorizedCallRes = await fetch(`${API_BASE}/api/admin/users/${testUser2Id}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalUserToken}`,
      },
    });
    const unauthorizedCallData = await unauthorizedCallRes.json();
    console.log("Unauthorized admin call response (Status:", unauthorizedCallRes.status, "):", unauthorizedCallData);
    if (unauthorizedCallRes.status !== 403 && unauthorizedCallRes.status !== 401) {
      throw new Error(`Test 9/10 Failed: Expected 403/401 for unauthorized admin API call, got ${unauthorizedCallRes.status}`);
    }
    console.log("✅ TEST 9 & 10 PASSED: Normal user forbidden from calling Admin APIs (HTTP 403/401).");

    console.log("\n🎉 ALL E2E QA SECURITY AUDIT & TEST SUITE VERIFICATION TESTS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ E2E TEST FAILURE:", err);
    process.exit(1);
  }
}

runE2ETests();
