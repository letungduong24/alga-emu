package expo.modules.applauncher

import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Environment
import android.os.StrictMode
import android.provider.Settings
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

    // === LAUNCH RETROARCH — ĐẦY ĐỦ EXTRAS NHƯ RETROARCH TỰ LÀM ===
    // Tham khảo: MainMenuActivity.startRetroActivity()
    AsyncFunction("launchRetroArch") { packageName: String, activityName: String, romPath: String, corePath: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")

      val romFile = File(romPath)
      if (!romFile.exists()) {
        throw Exception("ROM not found: $romPath")
      }

      val coreFile = File(corePath)
      if (!coreFile.exists()) {
        throw Exception("Core not found: $corePath")
      }

      // Lấy thông tin package của RetroArch
      val raPackageInfo = try {
        context.packageManager.getApplicationInfo(packageName, 0)
      } catch (e: PackageManager.NameNotFoundException) {
        throw Exception("RetroArch not installed: $packageName")
      }

      val dataDir = raPackageInfo.dataDir                    // /data/data/com.retroarch.aarch64
      val sourceDir = raPackageInfo.sourceDir                // /data/app/.../base.apk
      val sdcard = Environment.getExternalStorageDirectory().absolutePath  // /storage/emulated/0
      val external = "$sdcard/Android/data/$packageName/files"
      val configFile = "$external/retroarch.cfg"

      // Lấy IME hiện tại
      val ime = Settings.Secure.getString(context.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD) ?: ""

      android.util.Log.d("AppLauncher", "=== Launch RetroArch (FULL EXTRAS) ===")
      android.util.Log.d("AppLauncher", "ROM: $romPath")
      android.util.Log.d("AppLauncher", "LIBRETRO: $corePath")
      android.util.Log.d("AppLauncher", "CONFIGFILE: $configFile")
      android.util.Log.d("AppLauncher", "IME: $ime")
      android.util.Log.d("AppLauncher", "DATADIR: $dataDir")
      android.util.Log.d("AppLauncher", "APK: $sourceDir")
      android.util.Log.d("AppLauncher", "SDCARD: $sdcard")
      android.util.Log.d("AppLauncher", "EXTERNAL: $external")

      // Tạo intent GIỐNG HỆT MainMenuActivity.startRetroActivity()
      val intent = Intent(Intent.ACTION_MAIN)
      intent.component = ComponentName(packageName, activityName)

      // FLAG_ACTIVITY_CLEAR_TOP — giống cách RetroArch tự launch
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

      // === ĐẦY ĐỦ 8 EXTRAS ===
      intent.putExtra("ROM", romPath)
      intent.putExtra("LIBRETRO", corePath)
      intent.putExtra("CONFIGFILE", configFile)
      intent.putExtra("IME", ime)
      intent.putExtra("DATADIR", dataDir)
      intent.putExtra("APK", sourceDir)
      intent.putExtra("SDCARD", sdcard)
      intent.putExtra("EXTERNAL", external)

      android.util.Log.d("AppLauncher", "Launching with all extras...")
      context.startActivity(intent)
    }

    // Mở ứng dụng kèm file (cho các emulator khác)
    AsyncFunction("launchAppWithFile") { packageName: String, filePath: String ->
      val context = appContext.reactContext ?: throw Exception("Context is null")
      
      val file = File(filePath)
      if (!file.exists()) {
        throw Exception("File not found: $filePath")
      }

      val oldPolicy = StrictMode.getVmPolicy()
      StrictMode.setVmPolicy(StrictMode.VmPolicy.Builder().build())

      try {
        val uri = Uri.fromFile(file)
        val intent = Intent(Intent.ACTION_VIEW)
        intent.setDataAndType(uri, "*/*")
        intent.setPackage(packageName)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        
        try {
          context.startActivity(intent)
        } catch (e: Exception) {
          val fallbackIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            ?: throw Exception("App not found: $packageName")
          fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          fallbackIntent.putExtra("GAME_PATH", filePath)
          fallbackIntent.data = uri
          context.startActivity(fallbackIntent)
        }
      } finally {
        StrictMode.setVmPolicy(oldPolicy)
      }
    }
  }
}
