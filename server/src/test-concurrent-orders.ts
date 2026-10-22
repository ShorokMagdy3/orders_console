
import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { connectDB } from "./config/db";
import { Order } from "./models/order.model";

const API_URL = "http://localhost:3000";
const email = process.env.SEED_AGENT_EMAIL;
const password = process.env.SEED_AGENT_PASSWORD;

async function runTest() {
  try {
    if (!email || !password) {
      throw new Error("Seed agent credentials are missing from .env");
    }

    await connectDB();
    await Order.init();

    const loginResponse = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginResponse.status}`);
    }

    const loginData = (await loginResponse.json()) as {
      data: { token: string };
    };

    const token = loginData.data.token;
    const idempotencyKey = randomUUID();

    const body = {
      customerName: "Concurrent Test Customer",
      customerEmail: "concurrent-test@example.com",
      items: [
        {
          name: "Test Product",
          quantity: 2,
          unitPrice: 25,
        },
      ],
    };

    const sendCreateRequest = () =>
      fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(body),
      });

    // Fire both requests at the same time.
    const [response1, response2] = await Promise.all([
      sendCreateRequest(),
      sendCreateRequest(),
    ]);

    const result1 = (await response1.json()) as {
      success: boolean;
      data?: { _id: string };
      message?: string;
    };

    const result2 = (await response2.json()) as {
      success: boolean;
      data?: { _id: string };
      message?: string;
    };

    if (!response1.ok || !response2.ok) {
      throw new Error(
        `Requests failed: ${response1.status}, ${response2.status}. ` +
          `${result1.message ?? ""} ${result2.message ?? ""}`
      );
    }

    if (!result1.data?._id || result1.data._id !== result2.data?._id) {
      throw new Error("The two responses do not reference the same order");
    }

    const count = await Order.countDocuments({ idempotencyKey });

    if (count !== 1) {
      throw new Error(`Expected exactly 1 order, found ${count}`);
    }

    console.log("PASS: concurrent requests created exactly one order.");
    console.log("Order ID:", result1.data._id);
    console.log("Database count:", count);
  } finally {
    await mongoose.disconnect();
  }
}

runTest().catch((error) => {
  console.error("Concurrent order test FAILED:", error);
  process.exitCode = 1;
});