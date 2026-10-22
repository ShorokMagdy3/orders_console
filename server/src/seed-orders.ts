import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { Order } from "./models/order.model";
import type { OrderStatus } from "./models/order.model";
import { User } from "./models/user.model";

const TOTAL_ORDERS = 50_000;
const BATCH_SIZE = 5_000;

const firstNames = ["Ahmed", "Mohamed", "Sara", "Layla", "Omar", "Nour", "Youssef", "Mona", "Khaled", "Hana", "Ali", "Salma", "Tarek", "Dina", "Hassan", "Rana"];
const lastNames = ["Hassan", "Ibrahim", "Mostafa", "Said", "Farouk", "Nabil", "Adel", "Samir", "Fathy", "Gamal", "Kamal", "Zaki", "Mansour", "Salem"];
const products = ["Keyboard", "Mouse", "Monitor", "Laptop Stand", "USB Cable", "Webcam", "Headset", "Desk Lamp", "Notebook", "Backpack"];
const statuses: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function buildOrder(index: number, createdBy: mongoose.Types.ObjectId) {
  const customerName = `${pick(firstNames)} ${pick(lastNames)}`;
  const items = Array.from({ length: randomInt(1, 5) }, () => ({
    name: pick(products),
    quantity: randomInt(1, 5),
    unitPrice: randomInt(5, 500),
  }));
  const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  // Random date within the last 365 days.
  const createdAt = new Date(Date.now() - randomInt(0, 365 * 24 * 3600) * 1000);

  return {
    customerName,
    customerNameLower: customerName.toLowerCase(),
    customerEmail: `${customerName.toLowerCase().replace(" ", ".")}${index}@example.com`,
    status: pick(statuses),
    items,
    total,
    createdBy,
    idempotencyKey: `seed-${index}`,
    requestHash: "seed",
    createdAt,
    updatedAt: createdAt,
  };
}

async function seedOrders() {
  try {
    await connectDB();

    const admin = await User.findOne({ role: "admin" });
    if (!admin) {
      throw new Error("No admin user found. Run `npm run seed:users` first.");
    }

    await Order.init();
    // Re-running the script replaces the old seeded orders.
    await Order.deleteMany({ idempotencyKey: /^seed-/ });

    for (let start = 0; start < TOTAL_ORDERS; start += BATCH_SIZE) {
      const batch = Array.from({ length: BATCH_SIZE }, (_, i) =>
        buildOrder(start + i, admin._id)
      );
      // Raw driver insert: much faster than going through Mongoose validation.
      await Order.collection.insertMany(batch);
      console.log(`Inserted ${start + BATCH_SIZE} / ${TOTAL_ORDERS}`);
    }

    console.log("Done.");
  } catch (error) {
    console.error("Failed to seed orders:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seedOrders();