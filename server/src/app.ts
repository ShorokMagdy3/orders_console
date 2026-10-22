import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "Orders API is running" });
});

// Last resort: never leak stack traces to the client.
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ success: false, message: "Internal server error" });
});

export default app;