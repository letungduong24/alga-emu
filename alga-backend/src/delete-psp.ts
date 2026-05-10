import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Game } from "./entity/Game";

async function deletePSP() {
  console.log("🔄 Connecting to database...");
  await AppDataSource.initialize();

  console.log("🗑️  Deleting PSP games...");
  const repo = AppDataSource.getRepository(Game);
  const result = await repo.delete({ platform: "psp" });
  
  console.log(`✅ Deleted ${result.affected} PSP games`);
  
  await AppDataSource.destroy();
}

deletePSP().catch((err) => {
  console.error("❌ Delete failed:", err);
  process.exit(1);
});
