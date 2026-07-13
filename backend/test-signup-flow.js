import readline from "readline";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from local .env
dotenv.config();

const BASE_URL = `http://localhost:${process.env.PORT || 5000}/api`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runTest() {
  console.log("🚀 Starting Signup & Verification Test Flow...\n");

  const email = `testuser_${Date.now()}@example.com`;
  const password = "Password123!";
  const signupData = {
    firstName: "Test",
    lastName: "User",
    email,
    password,
  };

  console.log(`1. Sending SignUp request for: ${email}`);
  try {
    const signupRes = await fetch(`${BASE_URL}/users/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signupData),
    });

    const signupJson = await signupRes.json();
    if (!signupRes.ok) {
      console.error("❌ SignUp failed:", signupJson);
      process.exit(1);
    }
    console.log("✅ SignUp successful! Response:", signupJson);
    console.log("\n--------------------------------------------------");
    console.log("👉 CHECK YOUR BACKEND TERMINAL LOGS FOR THE OTP.");
    console.log("Look for: 🔑 [TESTING] OTP for " + email + ": xxxxxx");
    console.log("--------------------------------------------------\n");

    const otp = await askQuestion("🔑 Enter the 6-digit OTP from your terminal: ");

    console.log(`\n2. Verifying email for ${email} with OTP: ${otp}`);
    const verifyRes = await fetch(`${BASE_URL}/users/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok) {
      console.error("❌ Verification failed:", verifyJson);
      process.exit(1);
    }
    console.log("✅ Email verified successfully! Response:", verifyJson);

    console.log(`\n3. Attempting to SignIn with the verified account...`);
    const signinRes = await fetch(`${BASE_URL}/users/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const signinJson = await signinRes.json();
    if (!signinRes.ok) {
      console.error("❌ SignIn failed:", signinJson);
      process.exit(1);
    }
    console.log("✅ SignIn successful! Access Token generated:", signinJson.accessToken ? "SUCCESS" : "FAILED");
    console.log("\n🎉 E2E Authentication flow test passed successfully!");
  } catch (error) {
    console.error("❌ Network or unexpected error:", error.message);
  } finally {
    rl.close();
  }
}

runTest();
