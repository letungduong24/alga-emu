import "reflect-metadata";
import fetch from "node-fetch";
import { AppDataSource } from "./data-source";
import { Game } from "./entity/Game";

const ARCHIVE_BASE = "https://archive.org/download/nds-collection";
const METADATA_URL = "https://archive.org/metadata/nds-collection";

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
    // Remove revision tags
    .replace(/\s*\(Rev \d+\)/gi, "")
    .replace(/\s*\(DSi Enhanced\)/gi, "")
    .replace(/\s*\(Demo\)/gi, " [Demo]")
    .trim();
}

async function crawl() {
  console.log("🔄 Connecting to database...");
  await AppDataSource.initialize();

  console.log("📥 Fetching NDS collection metadata from Archive.org...");
  const res = await fetch(METADATA_URL);
  const data = await res.json() as any;

  const files: ArchiveFile[] = data.files || [];

  // Chỉ lấy file ZIP gốc (không lấy metadata, torrent...)
  const zipFiles = files.filter(
    (f) => f.source === "original" && f.name.endsWith(".zip")
  );

  console.log(`📦 Found ${zipFiles.length} ZIP files`);

  const repo = AppDataSource.getRepository(Game);
  let inserted = 0;
  let updated = 0;

  for (const file of zipFiles) {
    const newName = cleanGameName(file.name);

    const existing = await repo.findOneBy({ filename: file.name });
    if (existing) {
      existing.name = newName;
      existing.size = parseInt(file.size) || 0;
      existing.downloadUrl = `${ARCHIVE_BASE}/${encodeURIComponent(file.name)}`;
      await repo.save(existing);
      updated++;
      continue;
    }

    const game = repo.create({
      name: newName,
      filename: file.name,
      platform: "nds",
      size: parseInt(file.size) || 0,
      downloadUrl: `${ARCHIVE_BASE}/${encodeURIComponent(file.name)}`,
    });

    await repo.save(game);
    inserted++;
  }

  console.log(`✅ Done! Inserted: ${inserted}, Updated: ${updated}`);
  console.log(`📊 Total games in DB: ${await repo.count()}`);

  await AppDataSource.destroy();
}

crawl().catch((err) => {
  console.error("❌ Crawl failed:", err);
  process.exit(1);
});
