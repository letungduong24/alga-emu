import "reflect-metadata";
import fetch from "node-fetch";
import { AppDataSource } from "./data-source";
import { Game } from "./entity/Game";

const ARCHIVE_BASE = "https://archive.org/download/GameBoyAdvanceTOSEC";
const METADATA_URL = "https://archive.org/metadata/GameBoyAdvanceTOSEC";

interface ArchiveFile {
  name: string;
  source: string;
  size: string;
  format?: string;
}

function cleanGameName(filename: string): string {
  return filename
    .replace(/\.zip$/i, "")
    // Remove language tags like (En,Ja,Fr,De,Es,It,Ko)
    .replace(/\s*\((?:En|Fr|De|Es|It|Nl|Pt|Ru|Sv|No|Da|Fi|Ja|Zh|Ko|Ar|Tr|El)(?:,[A-Za-z]+)*\)/gi, "")
    // Remove revision tags like (Rev 1)
    .replace(/\s*\(Rev \d+\)/gi, "")
    // Remove region tags like (USA), (Europe), (Japan), (Germany), etc.
    .replace(/\s*\((?:USA|Europe|Japan|Germany|France|Spain|Italy|Netherlands|Australia|China|Korea|Brazil|Sweden|Norway|Denmark|Finland|Unknown|World)(?:,\s*(?:USA|Europe|Japan|Germany|France|Spain|Italy|Netherlands|Australia|China|Korea|Brazil|Sweden|Norway|Denmark|Finland|Unknown|World))*\)/gi, "")
    // Remove misc tags
    .replace(/\s*\(Beta\)/gi, " [Beta]")
    .replace(/\s*\(Proto\)/gi, " [Proto]")
    .replace(/\s*\(Demo\)/gi, " [Demo]")
    .replace(/\s*\(Kiosk\)/gi, "")
    .replace(/\s*\(Unl\)/gi, "")
    .replace(/\s*\(Alt \d+\)/gi, "")
    .trim();
}

async function crawlGBA() {
  console.log("🔄 Connecting to database...");
  await AppDataSource.initialize();

  console.log("📥 Fetching GBA collection metadata from Archive.org...");
  const res = await fetch(METADATA_URL);
  const data = await res.json() as any;

  const files: ArchiveFile[] = data.files || [];

  // Only original ZIP files
  const zipFiles = files.filter(
    (f) => f.source === "original" && f.name.endsWith(".zip")
  );

  console.log(`📦 Found ${zipFiles.length} ZIP files in GBA collection`);

  const repo = AppDataSource.getRepository(Game);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const file of zipFiles) {
    const filename = file.name;
    const newName = cleanGameName(filename);

    // Skip Action Replay, CodeBreaker, and other non-game files
    if (/action replay|codebreaker/i.test(newName)) {
      skipped++;
      continue;
    }

    const existing = await repo.findOneBy({ filename });
    if (existing) {
      existing.name = newName;
      existing.size = parseInt(file.size) || 0;
      existing.downloadUrl = `${ARCHIVE_BASE}/${encodeURIComponent(filename)}`;
      await repo.save(existing);
      updated++;
      continue;
    }

    const game = repo.create({
      name: newName,
      filename,
      platform: "gba",
      size: parseInt(file.size) || 0,
      downloadUrl: `${ARCHIVE_BASE}/${encodeURIComponent(filename)}`,
    });

    await repo.save(game);
    inserted++;
  }

  console.log(`✅ Done! Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`📊 Total GBA games in DB: ${await repo.count({ where: { platform: "gba" } })}`);

  await AppDataSource.destroy();
}

crawlGBA().catch((err) => {
  console.error("❌ GBA Crawl failed:", err);
  process.exit(1);
});
