package expo.modules.applauncher

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AppLauncherModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AppLauncher")

    // Tạo thư mục trên bộ nhớ ngoài
    AsyncFunction("createDirectory") { path: String ->
      val dir = File(path)
      if (!dir.exists()) {
        val created = dir.mkdirs()
        if (!created) {
          throw Exception("Cannot create directory: $path")
        }
      }
      true
    }

    // Kiểm tra file tồn tại
    AsyncFunction("fileExists") { path: String ->
      File(path).exists()
    }

    // Liệt kê tất cả file trong thư mục (bao gồm cả thư mục con)
    AsyncFunction("listFiles") { dirPath: String ->
      val dir = File(dirPath)
      if (!dir.exists() || !dir.isDirectory) {
        emptyList<String>()
      } else {
        dir.walkTopDown().filter { it.isFile }.map { it.absolutePath }.toList()
      }
    }

    // Kiểm tra app đã cài đặt chưa
    AsyncFunction("isAppInstalled") { packageName: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        context.packageManager.getPackageInfo(packageName, 0)
        true
      } catch (e: PackageManager.NameNotFoundException) {
        false
      }
    }

    // Mở ứng dụng bằng package name
    AsyncFunction("launchApp") { packageName: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        ?: throw Exception("App not found: $packageName")
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // === LAUNCH GAME IN-APP via LibretroDroid ===
    AsyncFunction("launchGame") { corePath: String, romPath: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")

      val coreFile = File(corePath)
      if (!coreFile.exists()) {
        throw Exception("Core not found: $corePath")
      }

      val romFile = File(romPath)
      if (!romFile.exists()) {
        throw Exception("ROM not found: $romPath")
      }

      android.util.Log.d("AppLauncher", "=== Launch Game In-App ===")
      android.util.Log.d("AppLauncher", "Core: $corePath")
      android.util.Log.d("AppLauncher", "ROM: $romPath")

      val intent = Intent(context, GameActivity::class.java)
      intent.putExtra("CORE_PATH", corePath)
      intent.putExtra("ROM_PATH", romPath)
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // Copy file
    AsyncFunction("copyFile") { srcPath: String, destPath: String ->
      val srcFile = File(srcPath)
      if (!srcFile.exists()) {
        throw Exception("Source file not found: $srcPath")
      }
      val destFile = File(destPath)
      val destDir = destFile.parentFile
      if (destDir != null && !destDir.exists()) destDir.mkdirs()
      if (!destFile.exists() || destFile.length() != srcFile.length()) {
        FileInputStream(srcFile).use { input ->
          FileOutputStream(destFile).use { output ->
            input.copyTo(output, bufferSize = 8192)
          }
        }
      }
      destFile.absolutePath
    }

    // === Xoá file/thư mục ===
    AsyncFunction("deleteFileOrDir") { path: String ->
      val target = File(path)
      if (target.exists()) {
        target.deleteRecursively()
      }
      true
    }

    // === Get the correct save extension for a given core ===
    fun getSaveExtForCore(coreId: String): String {
      return when {
        coreId.contains("desmume", ignoreCase = true) -> ".dsv"
        coreId.contains("melonds", ignoreCase = true) -> ".sav"
        coreId.contains("citra", ignoreCase = true) -> ".citra" // special marker
        coreId.contains("mgba", ignoreCase = true) -> ".srm"
        else -> ".srm"
      }
    }

    // === Find save file matching romBaseName, prioritizing core-specific extension ===
    fun findSaveFile(savesDir: File, romBaseName: String, coreId: String = ""): File? {
      if (!savesDir.exists()) return null

      // Core-specific extension first
      val coreExt = getSaveExtForCore(coreId)
      if (coreExt != ".citra") {
        val coreFile = File(savesDir, "${romBaseName}${coreExt}")
        if (coreFile.exists() && coreFile.length() > 0L) return coreFile
      }

      // Then try all known extensions
      val saveExts = listOf(".dsv", ".sav", ".srm", ".dat", ".bin")
      for (ext in saveExts) {
        val f = File(savesDir, "${romBaseName}${ext}")
        if (f.exists() && f.length() > 0L) return f
      }

      // Prefix match (any file with matching base name)
      return savesDir.listFiles()?.firstOrNull { f ->
        f.isFile && f.length() > 0L && f.nameWithoutExtension.equals(romBaseName, ignoreCase = true)
      }
    }

    // === Check for Citra (3DS) save directory ===
    fun hasCitraSave(savesDir: File): Boolean {
      val citraDir = File(savesDir, "Citra")
      if (citraDir.exists() && citraDir.isDirectory) {
        return citraDir.walkTopDown().any { it.isFile && it.length() > 0L }
      }
      return false
    }

    // === EXPORT SAVE ===
    // coreId: "desmume", "melonds", "citra", "mgba" etc.
    AsyncFunction("exportSave") { romBaseName: String, coreId: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val savesDir = File(context.filesDir, "saves")

      // Citra: export directory as zip
      if (coreId.contains("citra", ignoreCase = true)) {
        val citraDir = File(savesDir, "Citra")
        if (citraDir.exists() && citraDir.isDirectory && citraDir.walkTopDown().any { it.isFile }) {
          val externalSaves = File(Environment.getExternalStorageDirectory(), "Alga/saves")
          if (!externalSaves.exists()) externalSaves.mkdirs()
          val externalFile = File(externalSaves, "${romBaseName}_3ds_save.zip")
          val zipOut = java.util.zip.ZipOutputStream(FileOutputStream(externalFile))
          citraDir.walkTopDown().filter { it.isFile }.forEach { file ->
            val entryPath = file.relativeTo(savesDir).path
            zipOut.putNextEntry(java.util.zip.ZipEntry(entryPath))
            file.inputStream().use { it.copyTo(zipOut) }
            zipOut.closeEntry()
          }
          zipOut.close()
          android.util.Log.d("AppLauncher", "Exported Citra saves: ${externalFile.absolutePath}")
          return@AsyncFunction externalFile.absolutePath
        }
        throw Exception("Chưa có save cho game này")
      }

      // Standard: find and copy save file
      val saveFile = findSaveFile(savesDir, romBaseName, coreId)
      if (saveFile == null) {
        // Log what IS in the saves dir for debugging
        android.util.Log.w("AppLauncher", "No save found for '$romBaseName' (core=$coreId)")
        savesDir.listFiles()?.forEach { f ->
          android.util.Log.w("AppLauncher", "  saves/${f.name} (${f.length()} bytes)")
        }
        throw Exception("Chưa có save cho game này")
      }

      val externalSaves = File(Environment.getExternalStorageDirectory(), "Alga/saves")
      if (!externalSaves.exists()) externalSaves.mkdirs()
      val externalFile = File(externalSaves, saveFile.name)
      saveFile.copyTo(externalFile, overwrite = true)

      android.util.Log.d("AppLauncher", "Exported save: ${externalFile.absolutePath} (${externalFile.length()} bytes)")
      externalFile.absolutePath
    }

    // === IMPORT SAVE ===
    // coreId determines which extension to use for the imported file
    // For Citra: imported file should be a zip containing Citra/ directory structure
    AsyncFunction("importSave") { romBaseName: String, sourceUri: String, coreId: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val savesDir = File(context.filesDir, "saves")
      if (!savesDir.exists()) savesDir.mkdirs()

      // === Citra: extract zip to restore directory structure ===
      if (coreId.contains("citra", ignoreCase = true)) {
        val uri = Uri.parse(sourceUri)
        val inputStream = if (sourceUri.startsWith("content://") || sourceUri.startsWith("file://")) {
          context.contentResolver.openInputStream(uri)
        } else {
          File(sourceUri).inputStream()
        } ?: throw Exception("Không thể đọc file: $sourceUri")

        // Check if it's a zip file by trying to read as zip
        try {
          val zipIn = java.util.zip.ZipInputStream(inputStream)
          var entry = zipIn.nextEntry
          var extractedCount = 0

          if (entry == null) {
            zipIn.close()
            throw Exception("File không phải định dạng zip")
          }

          // Merge: overwrite files from zip, but keep existing saves for other games
          // (Citra saves are organized by title ID, so different games don't conflict)

          while (entry != null) {
            if (!entry.isDirectory) {
              val outFile = File(savesDir, entry.name)
              outFile.parentFile?.mkdirs()
              FileOutputStream(outFile).use { fos ->
                zipIn.copyTo(fos)
              }
              extractedCount++
            }
            zipIn.closeEntry()
            entry = zipIn.nextEntry
          }
          zipIn.close()

          android.util.Log.d("AppLauncher", "Imported Citra saves: $extractedCount files extracted")
          return@AsyncFunction "${savesDir.absolutePath}/Citra"
        } catch (e: java.util.zip.ZipException) {
          android.util.Log.w("AppLauncher", "Not a zip file, trying as raw save")
          // Fall through to standard import
        }
      }

      // === Standard: single file import ===
      val existing = findSaveFile(savesDir, romBaseName, coreId)
      val ext = if (existing != null) {
        "." + existing.extension
      } else {
        val coreExt = getSaveExtForCore(coreId)
        if (coreExt == ".citra") ".sav" else coreExt
      }
      val destFile = File(savesDir, "${romBaseName}${ext}")

      if (sourceUri.startsWith("content://") || sourceUri.startsWith("file://")) {
        val uri = Uri.parse(sourceUri)
        context.contentResolver.openInputStream(uri)?.use { input ->
          java.io.FileOutputStream(destFile).use { output ->
            input.copyTo(output, bufferSize = 8192)
          }
        } ?: throw Exception("Không thể đọc file: $sourceUri")
      } else {
        val srcFile = File(sourceUri)
        if (!srcFile.exists()) throw Exception("File không tồn tại: $sourceUri")
        srcFile.copyTo(destFile, overwrite = true)
      }

      android.util.Log.d("AppLauncher", "Imported save: ${destFile.name} (${destFile.length()} bytes) for core=$coreId")
      destFile.absolutePath
    }

    // === CHECK SAVE EXISTS ===
    AsyncFunction("hasSave") { romBaseName: String, coreId: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val savesDir = File(context.filesDir, "saves")
      if (coreId.contains("citra", ignoreCase = true)) {
        return@AsyncFunction hasCitraSave(savesDir)
      }
      findSaveFile(savesDir, romBaseName, coreId) != null
    }

    // === CHECK EXTERNAL SAVE EXISTS (for import) ===
    AsyncFunction("hasExternalSave") { romBaseName: String ->
      val externalSaves = File(Environment.getExternalStorageDirectory(), "Alga/saves")
      if (!externalSaves.exists()) return@AsyncFunction false
      val saveExts = listOf(".dsv", ".sav", ".srm")
      saveExts.any { File(externalSaves, "${romBaseName}${it}").let { f -> f.exists() && f.length() > 0L } }
    }

    // === BACKGROUND DOWNLOAD — Android DownloadManager ===
    // Tải nền thật sự, hiện notification trên thanh trạng thái
    // destSubPath = relative path inside Downloads folder, e.g. "Alga/game_123.zip"
    AsyncFunction("enqueueDownload") { url: String, destSubPath: String, title: String, description: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

      val request = DownloadManager.Request(Uri.parse(url))
        .setTitle(title)
        .setDescription(description)
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, destSubPath)
        .setAllowedOverMetered(true)
        .setAllowedOverRoaming(false)

      val downloadId = dm.enqueue(request)
      // Return both the ID and the actual resolved path
      val resolvedPath = "${Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)}/$destSubPath"
      android.util.Log.d("AppLauncher", "Enqueued download #$downloadId: $url -> $resolvedPath")
      mapOf("downloadId" to downloadId.toString(), "filePath" to resolvedPath)
    }

    // Kiểm tra tiến trình download
    AsyncFunction("getDownloadProgress") { downloadIdStr: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val downloadId = downloadIdStr.toLong()

      val query = DownloadManager.Query().setFilterById(downloadId)
      val cursor: Cursor? = dm.query(query)

      if (cursor != null && cursor.moveToFirst()) {
        val bytesDownloaded = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
        val bytesTotal = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
        val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
        val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
        cursor.close()

        val statusStr = when (status) {
          DownloadManager.STATUS_PENDING -> "pending"
          DownloadManager.STATUS_RUNNING -> "running"
          DownloadManager.STATUS_PAUSED -> "paused"
          DownloadManager.STATUS_SUCCESSFUL -> "success"
          DownloadManager.STATUS_FAILED -> "failed"
          else -> "unknown"
        }

        mapOf(
          "bytesDownloaded" to bytesDownloaded,
          "bytesTotal" to bytesTotal,
          "status" to statusStr,
          "reason" to reason,
          "progress" to if (bytesTotal > 0) (bytesDownloaded.toDouble() / bytesTotal) else 0.0
        )
      } else {
        cursor?.close()
        mapOf(
          "bytesDownloaded" to 0L,
          "bytesTotal" to 0L,
          "status" to "not_found",
          "reason" to 0,
          "progress" to 0.0
        )
      }
    }

    // Huỷ download
    AsyncFunction("cancelNativeDownload") { downloadIdStr: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
      val downloadId = downloadIdStr.toLong()
      dm.remove(downloadId)
      true
    }

    // === STORAGE PERMISSION (Android 11+) ===
    AsyncFunction("checkStoragePermission") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        Environment.isExternalStorageManager()
      } else {
        true // Pre-Android 11 doesn't need this special permission
      }
    }

    AsyncFunction("requestStoragePermission") {
      val context = appContext.reactContext ?: throw Exception("Context is null")
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION)
        intent.data = Uri.parse("package:${context.packageName}")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
      true
    }

    // === EXTRACT NDS ROM ICON ===
    // Reads the 32x32 4-bit tiled icon from the NDS banner data and saves as PNG
    AsyncFunction("extractNdsIcon") { romPath: String, outputPngPath: String ->
      try {
        val romFile = File(romPath)
        if (!romFile.exists()) return@AsyncFunction false

        val raf = RandomAccessFile(romFile, "r")

        // Read banner offset from NDS header at 0x68 (4 bytes, little-endian)
        raf.seek(0x68)
        val b0 = raf.read()
        val b1 = raf.read()
        val b2 = raf.read()
        val b3 = raf.read()
        val bannerOffset = (b0 and 0xFF) or
          ((b1 and 0xFF) shl 8) or
          ((b2 and 0xFF) shl 16) or
          ((b3 and 0xFF) shl 24)

        if (bannerOffset <= 0 || bannerOffset >= raf.length()) {
          raf.close()
          return@AsyncFunction false
        }

        // Read icon bitmap data: 512 bytes at bannerOffset + 0x20
        raf.seek(bannerOffset.toLong() + 0x20)
        val bitmapData = ByteArray(512)
        raf.readFully(bitmapData)

        // Read palette data: 32 bytes at bannerOffset + 0x220
        raf.seek(bannerOffset.toLong() + 0x220)
        val paletteData = ByteArray(32)
        raf.readFully(paletteData)
        raf.close()

        // Decode palette: 16 colors, BGR555 format (2 bytes each)
        val palette = IntArray(16)
        for (i in 0 until 16) {
          val lo = paletteData[i * 2].toInt() and 0xFF
          val hi = paletteData[i * 2 + 1].toInt() and 0xFF
          val color16 = lo or (hi shl 8)
          val r = ((color16 and 0x001F) shl 3) or ((color16 and 0x001F) shr 2)
          val g = (((color16 and 0x03E0) shr 5) shl 3) or (((color16 and 0x03E0) shr 5) shr 2)
          val b = (((color16 and 0x7C00) shr 10) shl 3) or (((color16 and 0x7C00) shr 10) shr 2)
          palette[i] = if (i == 0) Color.TRANSPARENT else Color.argb(255, r, g, b)
        }

        // Decode 4-bit tiled bitmap (8x8 tiles, 4 tiles across, 4 tiles down)
        val pixels = IntArray(32 * 32)
        var byteIdx = 0
        for (tileY in 0 until 4) {
          for (tileX in 0 until 4) {
            for (row in 0 until 8) {
              for (col in 0 until 4) {
                if (byteIdx >= bitmapData.size) break
                val byte = bitmapData[byteIdx].toInt() and 0xFF
                val px0 = byte and 0x0F      // low nibble = first pixel
                val px1 = (byte shr 4) and 0x0F // high nibble = second pixel

                val x0 = tileX * 8 + col * 2
                val y0 = tileY * 8 + row
                if (x0 < 32 && y0 < 32) pixels[y0 * 32 + x0] = palette[px0]
                if (x0 + 1 < 32 && y0 < 32) pixels[y0 * 32 + x0 + 1] = palette[px1]

                byteIdx++
              }
            }
          }
        }

        // Create 32x32 bitmap
        val smallBmp = Bitmap.createBitmap(32, 32, Bitmap.Config.ARGB_8888)
        smallBmp.setPixels(pixels, 0, 32, 0, 0, 32, 32)

        // Upscale to 128x128 for better display quality (nearest neighbor)
        val scaledBmp = Bitmap.createScaledBitmap(smallBmp, 128, 128, false)
        smallBmp.recycle()

        // Save as PNG
        val outFile = File(outputPngPath)
        outFile.parentFile?.mkdirs()
        FileOutputStream(outFile).use { fos ->
          scaledBmp.compress(Bitmap.CompressFormat.PNG, 100, fos)
        }
        scaledBmp.recycle()

        android.util.Log.d("AppLauncher", "Extracted NDS icon: $outputPngPath")
        true
      } catch (e: Exception) {
        android.util.Log.e("AppLauncher", "Failed to extract NDS icon: ${e.message}")
        false
      }
    }

    // === EXTRACT 3DS ROM ICON ===
    // Reads SMDH icon from NCSD (.3ds) ROM files
    AsyncFunction("extract3dsIcon") { romPath: String, outputPngPath: String ->
      try {
        val romFile = File(romPath)
        if (!romFile.exists()) return@AsyncFunction false

        val raf = RandomAccessFile(romFile, "r")
        var iconPixels: IntArray? = null

        // Step 1: Read magic at 0x100 to detect format
        raf.seek(0x100)
        val magic = ByteArray(4)
        raf.readFully(magic)
        val magicStr = String(magic)

        var ncchStart: Long = -1

        if (magicStr == "NCSD") {
          // NCSD format (.3ds game card image)
          // Partition table at 0x120: partition 0 offset (in media units = 0x200)
          raf.seek(0x120)
          val partition0OffsetMU = readLE32(raf)
          ncchStart = partition0OffsetMU.toLong() * 0x200
          android.util.Log.d("AppLauncher", "NCSD: partition0 at 0x${ncchStart.toString(16)}")
        } else if (magicStr == "NCCH") {
          // Plain NCCH file (CXI)
          ncchStart = 0
        }

        if (ncchStart >= 0) {
          // Verify NCCH magic at ncchStart + 0x100
          raf.seek(ncchStart + 0x100)
          val ncchMagic = ByteArray(4)
          raf.readFully(ncchMagic)

          if (String(ncchMagic) == "NCCH") {
            // ExeFS offset at NCCH + 0x1A0 (in media units, relative to NCCH start)
            raf.seek(ncchStart + 0x1A0)
            val exefsOffsetMU = readLE32(raf)
            val exefsOffset = ncchStart + exefsOffsetMU.toLong() * 0x200
            android.util.Log.d("AppLauncher", "ExeFS at 0x${exefsOffset.toString(16)}")

            // ExeFS header: 10 entries × 16 bytes (8 name + 4 offset + 4 size)
            for (i in 0 until 10) {
              raf.seek(exefsOffset + i * 16)
              val nameBytes = ByteArray(8)
              raf.readFully(nameBytes)
              val entryName = String(nameBytes).trim('\u0000')
              val entryOffset = readLE32(raf)
              val entrySize = readLE32(raf)

              if (entryName == "icon" && entrySize > 0) {
                // SMDH at exefsOffset + 0x200 (header) + entryOffset
                val smdhOffset = exefsOffset + 0x200 + entryOffset.toLong()
                android.util.Log.d("AppLauncher", "SMDH at 0x${smdhOffset.toString(16)}, size=$entrySize")
                iconPixels = extractSmdhIcon(raf, smdhOffset)
                break
              }
            }
          } else {
            android.util.Log.w("AppLauncher", "NCCH magic not found at 0x${(ncchStart + 0x100).toString(16)}")
          }
        }

        raf.close()

        if (iconPixels != null) {
          val bmp = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888)
          bmp.setPixels(iconPixels, 0, 48, 0, 0, 48, 48)
          val scaled = Bitmap.createScaledBitmap(bmp, 128, 128, true)
          bmp.recycle()

          val outFile = File(outputPngPath)
          outFile.parentFile?.mkdirs()
          FileOutputStream(outFile).use { fos ->
            scaled.compress(Bitmap.CompressFormat.PNG, 100, fos)
          }
          scaled.recycle()
          android.util.Log.d("AppLauncher", "Extracted 3DS icon: $outputPngPath")
          true
        } else {
          android.util.Log.w("AppLauncher", "Could not find SMDH icon in 3DS ROM")
          false
        }
      } catch (e: Exception) {
        android.util.Log.e("AppLauncher", "Failed to extract 3DS icon: ${e.message}", e)
        false
      }
    }

    // === BACKUP/RESTORE SYSTEM ===
    
    // List all backup files in backup directory
    AsyncFunction("listBackups") {
      try {
        val backupDir = File(Environment.getExternalStorageDirectory(), "Alga/backups")
        
        // Return empty list if directory doesn't exist
        if (!backupDir.exists() || !backupDir.isDirectory) {
          android.util.Log.d("AppLauncher", "Backup directory does not exist")
          return@AsyncFunction emptyList<Map<String, Any>>()
        }
        
        // Scan directory for ZIP files
        val backupFiles = backupDir.listFiles { file ->
          file.isFile && file.name.endsWith(".zip", ignoreCase = true)
        } ?: emptyArray()
        
        // Build list of backup metadata
        val backupList = mutableListOf<Map<String, Any>>()
        
        for (backupFile in backupFiles) {
          try {
            // Extract basic file metadata
            val filePath = backupFile.absolutePath
            val fileName = backupFile.name
            val fileSize = backupFile.length()
            
            // Get creation date from file system (last modified time)
            val createdAt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
              timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(Date(backupFile.lastModified()))
            
            // Try to peek into manifest.json to get game count
            var gameCount = 0
            try {
              val zipIn = java.util.zip.ZipInputStream(FileInputStream(backupFile))
              var entry = zipIn.nextEntry
              
              // Look for manifest.json
              while (entry != null) {
                if (entry.name == "manifest.json" && !entry.isDirectory) {
                  val manifestBytes = zipIn.readBytes()
                  val manifestJson = String(manifestBytes, Charsets.UTF_8)
                  val manifest = JSONObject(manifestJson)
                  
                  // Extract game count from games array
                  if (manifest.has("games")) {
                    val gamesArray = manifest.getJSONArray("games")
                    gameCount = gamesArray.length()
                  }
                  
                  zipIn.closeEntry()
                  break
                }
                zipIn.closeEntry()
                entry = zipIn.nextEntry
              }
              zipIn.close()
            } catch (e: Exception) {
              // If we can't read manifest, just use gameCount = 0
              android.util.Log.w("AppLauncher", "Could not read manifest from ${fileName}: ${e.message}")
            }
            
            // Add backup info to list
            backupList.add(mapOf(
              "filePath" to filePath,
              "fileName" to fileName,
              "createdAt" to createdAt,
              "fileSize" to fileSize,
              "gameCount" to gameCount
            ))
            
            android.util.Log.d("AppLauncher", "Found backup: $fileName ($fileSize bytes, $gameCount games)")
          } catch (e: Exception) {
            // Skip this file if we can't read its metadata
            android.util.Log.w("AppLauncher", "Skipping backup file ${backupFile.name}: ${e.message}")
          }
        }
        
        // Sort by creation date (newest first)
        backupList.sortedByDescending { it["createdAt"] as String }
      } catch (e: Exception) {
        android.util.Log.e("AppLauncher", "Failed to list backups: ${e.message}", e)
        throw Exception("Failed to list backups: ${e.message}")
      }
    }
    
    // Restore backup from ZIP file
    AsyncFunction("restoreBackup") { backupFilePath: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      
      try {
        // Validate ZIP file exists and is readable
        val backupFile = File(backupFilePath)
        if (!backupFile.exists()) {
          throw Exception("Backup file not found: $backupFilePath")
        }
        if (!backupFile.canRead()) {
          throw Exception("Cannot read backup file: $backupFilePath")
        }
        
        // Use ZipInputStream to extract ZIP
        val zipIn = java.util.zip.ZipInputStream(FileInputStream(backupFile))
        
        var manifestJson: String? = null
        var savesRestored = 0
        var coversRestored = 0
        
        try {
          var entry = zipIn.nextEntry
          
          // First pass: find and parse manifest.json
          while (entry != null) {
            if (entry.name == "manifest.json" && !entry.isDirectory) {
              val manifestBytes = zipIn.readBytes()
              manifestJson = String(manifestBytes, Charsets.UTF_8)
              zipIn.closeEntry()
              break
            }
            zipIn.closeEntry()
            entry = zipIn.nextEntry
          }
          
          // Validate manifest exists
          if (manifestJson == null) {
            throw Exception("Invalid backup: manifest.json not found")
          }
          
          // Parse and validate manifest
          val manifest = JSONObject(manifestJson)
          
          // Validate required fields
          if (!manifest.has("version")) {
            throw Exception("Invalid backup: manifest missing 'version' field")
          }
          if (!manifest.has("createdAt")) {
            throw Exception("Invalid backup: manifest missing 'createdAt' field")
          }
          if (!manifest.has("games")) {
            throw Exception("Invalid backup: manifest missing 'games' field")
          }
          
          // Close and reopen ZIP to start from beginning for file extraction
          zipIn.close()
          val zipIn2 = java.util.zip.ZipInputStream(FileInputStream(backupFile))
          
          try {
            var entry2 = zipIn2.nextEntry
            
            // Second pass: extract save files and cover files
            while (entry2 != null) {
              val entryName = entry2.name
              
              if (!entry2.isDirectory) {
                // Extract save files to internal storage
                if (entryName.startsWith("saves/")) {
                  val relativePath = entryName.substring(6) // Remove "saves/" prefix
                  val savesDir = File(context.filesDir, "saves")
                  val destFile = File(savesDir, relativePath)
                  
                  // Create parent directories if needed
                  destFile.parentFile?.mkdirs()
                  
                  // Extract file
                  FileOutputStream(destFile).use { output ->
                    zipIn2.copyTo(output)
                  }
                  savesRestored++
                  android.util.Log.d("AppLauncher", "Restored save: $relativePath")
                }
                // Extract cover files to external storage
                else if (entryName.startsWith("covers/")) {
                  val relativePath = entryName.substring(7) // Remove "covers/" prefix
                  val coversDir = File(Environment.getExternalStorageDirectory(), "Alga/covers")
                  if (!coversDir.exists()) {
                    coversDir.mkdirs()
                  }
                  val destFile = File(coversDir, relativePath)
                  
                  // Create parent directories if needed
                  destFile.parentFile?.mkdirs()
                  
                  // Extract file
                  FileOutputStream(destFile).use { output ->
                    zipIn2.copyTo(output)
                  }
                  coversRestored++
                  android.util.Log.d("AppLauncher", "Restored cover: $relativePath")
                }
              }
              
              zipIn2.closeEntry()
              entry2 = zipIn2.nextEntry
            }
            
            zipIn2.close()
            
            // Return restore result
            android.util.Log.d("AppLauncher", "Restore complete: $savesRestored saves, $coversRestored covers")
            
            mapOf(
              "manifest" to manifestJson,
              "savesRestored" to savesRestored,
              "coversRestored" to coversRestored
            )
          } catch (e: Exception) {
            zipIn2.close()
            throw e
          }
        } catch (e: Exception) {
          zipIn.close()
          throw e
        }
      } catch (e: Exception) {
        android.util.Log.e("AppLauncher", "Failed to restore backup: ${e.message}", e)
        throw Exception("Failed to restore backup: ${e.message}")
      }
    }
    
    // Create backup ZIP with manifest and save files
    AsyncFunction("createBackup") { includeCovers: Boolean, gamesJson: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      var zipFile: File? = null
      
      try {
        // Parse games JSON to extract game metadata
        val gamesArray = JSONArray(gamesJson)
        val games = mutableListOf<JSONObject>()
        for (i in 0 until gamesArray.length()) {
          games.add(gamesArray.getJSONObject(i))
        }
        
        // Create backup directory if it doesn't exist
        val backupDir = File(Environment.getExternalStorageDirectory(), "Alga/backups")
        if (!backupDir.exists()) {
          backupDir.mkdirs()
        }
        
        // Generate backup filename with timestamp
        val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        val backupFileName = "alga_backup_${timestamp}.zip"
        zipFile = File(backupDir, backupFileName)
        
        // Create ZIP output stream
        val zipOut = ZipOutputStream(FileOutputStream(zipFile))
        
        try {
          // Collect save files
          val savesDir = File(context.filesDir, "saves")
          val saveFiles = mutableListOf<String>()
          
          if (savesDir.exists() && savesDir.isDirectory) {
            savesDir.walkTopDown().filter { it.isFile }.forEach { file ->
              val relativePath = file.relativeTo(savesDir).path
              saveFiles.add(relativePath)
              
              // Add save file to ZIP
              val entry = ZipEntry("saves/$relativePath")
              zipOut.putNextEntry(entry)
              FileInputStream(file).use { input ->
                input.copyTo(zipOut)
              }
              zipOut.closeEntry()
            }
          }
          
          // Collect cover files if requested
          val coverFiles = mutableListOf<String>()
          if (includeCovers) {
            val coversDir = File(Environment.getExternalStorageDirectory(), "Alga/covers")
            if (coversDir.exists() && coversDir.isDirectory) {
              coversDir.walkTopDown().filter { it.isFile }.forEach { file ->
                val relativePath = file.relativeTo(coversDir).path
                coverFiles.add(relativePath)
                
                // Add cover file to ZIP
                val entry = ZipEntry("covers/$relativePath")
                zipOut.putNextEntry(entry)
                FileInputStream(file).use { input ->
                  input.copyTo(zipOut)
                }
                zipOut.closeEntry()
              }
            }
          }
          
          // Generate manifest.json
          val manifest = JSONObject()
          manifest.put("version", "1.0")
          manifest.put("createdAt", SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = java.util.TimeZone.getTimeZone("UTC")
          }.format(Date()))
          
          // Add games array to manifest
          val gamesManifestArray = JSONArray()
          for (game in games) {
            val gameMetadata = JSONObject()
            gameMetadata.put("id", game.getInt("id"))
            gameMetadata.put("name", game.getString("name"))
            gameMetadata.put("platform", game.getString("platform"))
            gameMetadata.put("downloadUrl", game.getString("downloadUrl"))
            gameMetadata.put("filename", game.getString("filename"))
            gamesManifestArray.put(gameMetadata)
          }
          manifest.put("games", gamesManifestArray)
          
          // Add saveFiles array to manifest
          val saveFilesArray = JSONArray()
          for (saveFile in saveFiles) {
            saveFilesArray.put(saveFile)
          }
          manifest.put("saveFiles", saveFilesArray)
          
          // Add coverFiles array to manifest if covers were included
          if (includeCovers) {
            val coverFilesArray = JSONArray()
            for (coverFile in coverFiles) {
              coverFilesArray.put(coverFile)
            }
            manifest.put("coverFiles", coverFilesArray)
          }
          
          // Add manifest.json to ZIP as first entry
          val manifestEntry = ZipEntry("manifest.json")
          zipOut.putNextEntry(manifestEntry)
          zipOut.write(manifest.toString(2).toByteArray(Charsets.UTF_8))
          zipOut.closeEntry()
          
          zipOut.close()
          
          // Return file path and size
          val fileSize = zipFile.length()
          android.util.Log.d("AppLauncher", "Created backup: ${zipFile.absolutePath} (${fileSize} bytes)")
          
          mapOf(
            "filePath" to zipFile.absolutePath,
            "fileSize" to fileSize
          )
        } catch (e: Exception) {
          zipOut.close()
          throw e
        }
      } catch (e: Exception) {
        // Delete partial ZIP file on error
        zipFile?.let {
          if (it.exists()) {
            it.delete()
            android.util.Log.d("AppLauncher", "Deleted partial backup file after error")
          }
        }
        android.util.Log.e("AppLauncher", "Failed to create backup: ${e.message}", e)
        throw Exception("Failed to create backup: ${e.message}")
      }
    }
    
    // Delete backup file from filesystem
    AsyncFunction("deleteBackup") { backupFilePath: String ->
      try {
        val backupFile = File(backupFilePath)
        
        // Check if file exists
        if (!backupFile.exists()) {
          android.util.Log.w("AppLauncher", "Backup file not found: $backupFilePath")
          return@AsyncFunction false
        }
        
        // Attempt to delete the file
        val deleted = backupFile.delete()
        
        if (deleted) {
          android.util.Log.d("AppLauncher", "Successfully deleted backup: $backupFilePath")
        } else {
          android.util.Log.w("AppLauncher", "Failed to delete backup: $backupFilePath")
        }
        
        deleted
      } catch (e: Exception) {
        android.util.Log.e("AppLauncher", "Error deleting backup: ${e.message}", e)
        false
      }
    }
  }

  // Helper: read 32-bit little-endian int
  private fun readLE32(raf: RandomAccessFile): Int {
    val b = ByteArray(4)
    raf.readFully(b)
    return (b[0].toInt() and 0xFF) or
      ((b[1].toInt() and 0xFF) shl 8) or
      ((b[2].toInt() and 0xFF) shl 16) or
      ((b[3].toInt() and 0xFF) shl 24)
  }

  // Extract 48x48 large icon from SMDH data
  private fun extractSmdhIcon(raf: RandomAccessFile, smdhOffset: Long): IntArray? {
    // SMDH magic at offset 0: "SMDH"
    raf.seek(smdhOffset)
    val magic = ByteArray(4)
    raf.readFully(magic)
    if (String(magic) != "SMDH") return null

    // Large icon: 48x48 RGB565, starts at SMDH + 0x24C0
    val iconOffset = smdhOffset + 0x24C0
    raf.seek(iconOffset)
    val iconData = ByteArray(48 * 48 * 2) // RGB565, 2 bytes per pixel
    raf.readFully(iconData)

    // Decode tiled RGB565 → ARGB pixels
    // 3DS icons use Morton/Z-order tiling in 8x8 tiles
    // Each 8x8 tile stores pixels in Z-curve order (bit-interleaved x,y)
    val pixels = IntArray(48 * 48)

    var dataIdx = 0
    for (tileY in 0 until 6) {
      for (tileX in 0 until 6) {
        for (morton in 0 until 64) {
          if (dataIdx + 1 >= iconData.size) break
          val lo = iconData[dataIdx].toInt() and 0xFF
          val hi = iconData[dataIdx + 1].toInt() and 0xFF
          val rgb565 = lo or (hi shl 8)

          val r = ((rgb565 shr 11) and 0x1F) * 255 / 31
          val g = ((rgb565 shr 5) and 0x3F) * 255 / 63
          val b = (rgb565 and 0x1F) * 255 / 31

          // Decode Morton Z-order: deinterleave bits to get (x, y) within tile
          val x = (morton and 1) or ((morton shr 1) and 2) or ((morton shr 2) and 4)
          val y = ((morton shr 1) and 1) or ((morton shr 2) and 2) or ((morton shr 3) and 4)
          val px = tileX * 8 + x
          val py = tileY * 8 + y
          if (px < 48 && py < 48) {
            pixels[py * 48 + px] = Color.argb(255, r, g, b)
          }
          dataIdx += 2
        }
      }
    }
    return pixels
  }
}
