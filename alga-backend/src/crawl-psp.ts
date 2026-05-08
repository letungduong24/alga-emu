import fetch from "node-fetch";
import "reflect-metadata";
import { AppDataSource } from "./data-source";
import { Game } from "./entity/Game";

// Archive.org PSP collection
const ARCHIVE_COLLECTION = "PSNCollectionByGhostware";
const METADATA_URL = `https://archive.org/metadata/${ARCHIVE_COLLECTION}`;
const ARCHIVE_BASE = `https://archive.org/download/${ARCHIVE_COLLECTION}`;

interface ArchiveFile {
  name: string;
  source: string;
  size: string;
  format?: string;
}

function cleanGameName(filename: string): string {
  return filename
    // Remove extensions
    .replace(/\.(iso|cso|pbp|zip)$/i, "")
    // Remove region tags like (USA), (Europe), (Japan), etc.
    .replace(/\s*\((?:USA|Europe|Japan|Asia|World|En|Fr|De|Es|It|Pt|Ru|Ko|Zh)\)/gi, "")
    // Remove language tags
    .replace(/\s*\((?:En|Fr|De|Es|It|Nl|Pt|Ru|Sv|No|Da|Fi|Ja|Zh|Ko|Ar|Tr|El)(?:,[A-Za-z]+)*\)/gi, "")
    // Remove version/revision tags
    .replace(/\s*\(v\d+\.\d+\)/gi, "")
    .replace(/\s*\(Rev \d+\)/gi, "")
    // Remove misc tags
    .replace(/\s*\(Demo\)/gi, " [Demo]")
    .replace(/\s*\(Beta\)/gi, " [Beta]")
    .replace(/\s*\(Proto\)/gi, " [Proto]")
    // Clean up underscores and multiple spaces
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function crawlPSP() {
  console.log("🔄 Connecting to database...");
  await AppDataSource.initialize();

  console.log("📥 Fetching PSP collection metadata from Archive.org...");
  const res = await fetch(METADATA_URL);
  const data = await res.json() as any;

  const files: ArchiveFile[] = data.files || [];

  // Filter for PSP ROM files (ISO, CSO, PBP)
  const romFiles = files.filter(
    (f) => 
      f.source === "original" && 
      (f.name.endsWith(".iso") || f.name.endsWith(".cso") || f.name.endsWith(".pbp") || 
       (f.name.endsWith(".zip") && !f.name.includes("_meta")))
  );

  console.log(`📦 Found ${romFiles.length} PSP ROM files in collection`);

  const repo = AppDataSource.getRepository(Game);
  let inserted = 0;
  let updated = 0;

  for (const file of romFiles) {
    const cleanFilename = file.name;
    const newName = cleanGameName(cleanFilename);

    // Skip if name is too short (likely metadata file)
    if (newName.length < 3) continue;

    const existing = await repo.findOneBy({ filename: cleanFilename, platform: "psp" });
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
      platform: "psp",
      size: parseInt(file.size) || 0,
      downloadUrl: `${ARCHIVE_BASE}/${encodeURIComponent(cleanFilename)}`,
    });

    await repo.save(game);
    inserted++;
  }

  console.log(`✅ Done! Inserted: ${inserted}, Updated: ${updated}`);
  console.log(`📊 Total PSP games in DB: ${await repo.count({ where: { platform: "psp" } })}`);

  await AppDataSource.destroy();
}

crawlPSP().catch((err) => {
  console.error("❌ PSP Crawl failed:", err);
  process.exit(1);
});
