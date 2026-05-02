import "reflect-metadata";
import fetch from "node-fetch";
import { AppDataSource } from "./data-source";
import { Game } from "./entity/Game";

const ARCHIVE_BASE = "https://archive.org/download/3ds-decrypted-roms321com/all";
const METADATA_URL = "https://archive.org/metadata/3ds-decrypted-roms321com";

interface ArchiveFile {
  name: string;
  source: string;
  size: string;
  format?: string;
}

function cleanGameName(filename: string): string {
  return filename
    .replace(/\.zip$/i, "")
    .replace(/\s*\(DSi Enhanced\)/gi, "")
    .replace(/\s*\(USA\)/gi, "")
    .replace(/\s*\(Europe\)/gi, "")
    .replace(/\s*\(Japan\)/gi, "")
    .replace(/\s*\(Korea\)/gi, "")
    .replace(/\s*\(Taiwan\)/gi, "")
    .replace(/\s*\(Australia\)/gi, "")
    .replace(/\s*\(World\)/gi, "")
    .replace(/\s*\(Demo\)/gi, "")
    .replace(/\s*\(Kiosk\)/gi, "")
    .replace(/\s*\(Rev \d+\)/gi, "")
    .replace(/\s*\(En[^)]*\)/gi, "")
    .replace(/\s*\(Fr[^)]*\)/gi, "")
    .replace(/\s*\(De[^)]*\)/gi, "")
    .replace(/\s*\(Es[^)]*\)/gi, "")
    .replace(/\s*\(It[^)]*\)/gi, "")
    .replace(/\s*\(Nl[^)]*\)/gi, "")
    .replace(/\s*\(Pt[^)]*\)/gi, "")
    .replace(/\s*\(Ru[^)]*\)/gi, "")
    .replace(/\s*\(Sv[^)]*\)/gi, "")
    .replace(/\s*\(No[^)]*\)/gi, "")
    .replace(/\s*\(Da[^)]*\)/gi, "")
    .replace(/\s*\(Fi[^)]*\)/gi, "")
    .replace(/\s*\(Ja[^)]*\)/gi, "")
    .replace(/\s*\(Zh[^)]*\)/gi, "")
    .replace(/\s*\(Ko[^)]*\)/gi, "")
    .replace(/\s*\(Ar[^)]*\)/gi, "")
    .replace(/\s*\(Tr[^)]*\)/gi, "")
    .replace(/\s*\(El[^)]*\)/gi, "")
    .trim();
}

async function crawl3DS() {
  console.log("🔄 Connecting to database...");
  await AppDataSource.initialize();

  console.log("📥 Fetching 3DS collection metadata from Archive.org...");
  const res = await fetch(METADATA_URL);
  const data = await res.json() as any;

  const files: ArchiveFile[] = data.files || [];

  // Only original ZIP files (not metadata, torrent, etc.)
  // Files are nested in the "all/" subdirectory
  const zipFiles = files.filter(
    (f) => f.source === "original" && f.name.endsWith(".zip") && f.name.startsWith("all/")
  );

  console.log(`📦 Found ${zipFiles.length} ZIP files in 3DS collection`);

  const repo = AppDataSource.getRepository(Game);
  let inserted = 0;
  let skipped = 0;

  for (const file of zipFiles) {
    // Strip the "all/" prefix from the filename for clean display
    const cleanFilename = file.name.replace(/^all\//, "");

    const existing = await repo.findOneBy({ filename: cleanFilename });
    if (existing) {
      skipped++;
      continue;
    }

    const game = repo.create({
      name: cleanGameName(cleanFilename),
      filename: cleanFilename,
      platform: "3ds",
      size: parseInt(file.size) || 0,
      downloadUrl: `${ARCHIVE_BASE}/${encodeURIComponent(cleanFilename)}`,
    });

    await repo.save(game);
    inserted++;
  }

  console.log(`✅ Done! Inserted: ${inserted}, Skipped: ${skipped}`);
  console.log(`📊 Total 3DS games in DB: ${await repo.count({ where: { platform: "3ds" } })}`);

  await AppDataSource.destroy();
}

crawl3DS().catch((err) => {
  console.error("❌ 3DS Crawl failed:", err);
  process.exit(1);
});
