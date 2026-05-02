package expo.modules.applauncher

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.os.Environment
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

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

    // === EXPORT SAVE — Copy .sav ra /Alga/saves/ ===
    AsyncFunction("exportSave") { romBaseName: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val savesDir = File(context.filesDir, "saves")
      val saveFile = File(savesDir, "${romBaseName}.sav")

      if (!saveFile.exists() || saveFile.length() == 0L) {
        throw Exception("Chưa có save cho game này")
      }

      val externalSaves = File(Environment.getExternalStorageDirectory(), "Alga/saves")
      if (!externalSaves.exists()) externalSaves.mkdirs()
      val externalFile = File(externalSaves, "${romBaseName}.sav")
      saveFile.copyTo(externalFile, overwrite = true)

      android.util.Log.d("AppLauncher", "Exported save: ${externalFile.absolutePath} (${externalFile.length()} bytes)")
      externalFile.absolutePath
    }

    // === IMPORT SAVE — Copy từ /Alga/saves/ vào internal ===
    AsyncFunction("importSave") { romBaseName: String, sourceUri: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val savesDir = File(context.filesDir, "saves")
      if (!savesDir.exists()) savesDir.mkdirs()
      val destFile = File(savesDir, "${romBaseName}.sav")

      // sourceUri có thể là file path hoặc content URI
      if (sourceUri.startsWith("content://") || sourceUri.startsWith("file://")) {
        val uri = Uri.parse(sourceUri)
        context.contentResolver.openInputStream(uri)?.use { input ->
          java.io.FileOutputStream(destFile).use { output ->
            input.copyTo(output, bufferSize = 8192)
          }
        } ?: throw Exception("Không thể đọc file: $sourceUri")
      } else {
        // Plain file path
        val srcFile = File(sourceUri)
        if (!srcFile.exists()) throw Exception("File không tồn tại: $sourceUri")
        srcFile.copyTo(destFile, overwrite = true)
      }

      android.util.Log.d("AppLauncher", "Imported save: ${destFile.name} (${destFile.length()} bytes)")
      destFile.absolutePath
    }

    // === CHECK SAVE EXISTS ===
    AsyncFunction("hasSave") { romBaseName: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      val saveFile = File(context.filesDir, "saves/${romBaseName}.sav")
      saveFile.exists() && saveFile.length() > 0L
    }

    // === CHECK EXTERNAL SAVE EXISTS (for import) ===
    AsyncFunction("hasExternalSave") { romBaseName: String ->
      val externalFile = File(Environment.getExternalStorageDirectory(), "Alga/saves/${romBaseName}.sav")
      externalFile.exists() && externalFile.length() > 0L
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
  }
}
