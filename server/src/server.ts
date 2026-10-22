import "dotenv/config";
import app from "./app";
import { connectDB } from "./config/db";

const PORT = Number(process.env.PORT ?? 3000);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void startServer();