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
    // Remove language tags like (En,Ja,Fr,De,Es,It,Ko)
    .replace(/\s*\((?:En|Fr|De|Es|It|Nl|Pt|Ru|Sv|No|Da|Fi|Ja|Zh|Ko|Ar|Tr|El)(?:,[A-Za-z]+)*\)/gi, "")
    // Remove revision tags like (Rev 2)
    .replace(/\s*\(Rev \d+\)/gi, "")
    // Remove misc tags
    .replace(/\s*\(DSi Enhanced\)/gi, "")
    .replace(/\s*\(Demo\)/gi, " [Demo]")
    .replace(/\s*\(Kiosk\)/gi, "")
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
  let updated = 0;

  for (const file of zipFiles) {
    // Strip the "all/" prefix from the filename for clean display
    const cleanFilename = file.name.replace(/^all\//, "");
    const newName = cleanGameName(cleanFilename);

    const existing = await repo.findOneBy({ filename: cleanFilename });
    if (existing) {
      // Update name/size/url if changed
      existing.name = newName;
      existing.size = parseInt(file.size) || 0;
      existing.downloadUrl = `${ARCHIVE_BASE}/${encodeURIComponent(cleanFilename)}`;
      await repo.save(existing);
      updated++;
      continue;
    }

    const game = repo.create({
      name: newName,
      filename: cleanFilename,
      platform: "3ds",
      size: parseInt(file.size) || 0,
      downloadUrl: `${ARCHIVE_BASE}/${encodeURIComponent(cleanFilename)}`,
    });

    await repo.save(game);
    inserted++;
  }

  console.log(`✅ Done! Inserted: ${inserted}, Updated: ${updated}`);
  console.log(`📊 Total 3DS games in DB: ${await repo.count({ where: { platform: "3ds" } })}`);

  await AppDataSource.destroy();
}

crawl3DS().catch((err) => {
  console.error("❌ 3DS Crawl failed:", err);
  process.exit(1);
});
