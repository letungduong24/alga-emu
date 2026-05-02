import "reflect-metadata";
import express from "express";
import cors from "cors";
import { AppDataSource } from "./data-source";
import gamesRouter from "./routes/games";

const PORT = parseInt(process.env.PORT || "3000");

async function main() {
  await AppDataSource.initialize();
  console.log("✅ Database connected");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/games", gamesRouter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.listen(PORT, () => {
    console.log(`🚀 Alga API running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start:", err);
  process.exit(1);
});
