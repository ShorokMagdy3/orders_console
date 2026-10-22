
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "./config/db";
import { User } from "./models/user.model";

async function seedUsers() {
  try {
    await connectDB();

    const users = [
      {
        name: "SARH Admin",
        email: process.env.SEED_ADMIN_EMAIL,
        password: process.env.SEED_ADMIN_PASSWORD,
        role: "admin" as const,
      },
      {
        name: "SARH Agent",
        email: process.env.SEED_AGENT_EMAIL,
        password: process.env.SEED_AGENT_PASSWORD,
        role: "agent" as const,
      },
    ];

    for (const user of users) {
      if (!user.email || !user.password || user.password.length < 12) {
        throw new Error(
          "Set seed emails and passwords (at least 12 characters) in .env"
        );
      }

      const email = user.email.trim().toLowerCase();
      const passwordHash = await bcrypt.hash(user.password, 12);

      await User.updateOne(
        { email },
        {
          $set: {
            name: user.name,
            email,
            passwordHash,
            role: user.role,
          },
        },
        { upsert: true, runValidators: true }
      );

      console.log(`Seeded ${user.role}: ${email}`);
    }
  } catch (error) {
    console.error("Failed to seed users:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

void seedUsers();