package expo.modules.applauncher

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.swordfish.libretrodroid.GLRetroView
import com.swordfish.libretrodroid.GLRetroViewData
import com.swordfish.libretrodroid.ShaderConfig
import com.swordfish.libretrodroid.Variable
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import androidx.lifecycle.lifecycleScope

class GameActivity : AppCompatActivity() {

    var retroView: GLRetroView? = null

    // NDS Screen layouts
    private val screenLayouts = arrayOf(
        "Left/Right",
        "Top/Bottom",
        "Top Only",
        "Bottom Only",
        "Hybrid Top",
    )
    var currentLayoutIndex = 0
    var currentStateSlot = 0
    private var romBaseName: String = ""

    // Auto-save timer
    private val autoSaveHandler = Handler(Looper.getMainLooper())
    private val autoSaveInterval = 30_000L  // 30 giây
    private val autoSaveRunnable = object : Runnable {
        override fun run() {
            saveSRAM("auto-save")
            autoSaveHandler.postDelayed(this, autoSaveInterval)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val corePath = intent.getStringExtra("CORE_PATH")
        val romPath = intent.getStringExtra("ROM_PATH")

        if (corePath == null || romPath == null) {
            android.util.Log.e("GameActivity", "Missing CORE_PATH or ROM_PATH")
            finish()
            return
        }

        // Lấy tên ROM để đặt tên file state
        romBaseName = java.io.File(romPath).nameWithoutExtension

        android.util.Log.d("GameActivity", "=== Starting Game ===")
        android.util.Log.d("GameActivity", "Core: $corePath")
        android.util.Log.d("GameActivity", "ROM: $romPath")

        // Tạo directories
        val savesDir = java.io.File(filesDir, "saves")
        if (!savesDir.exists()) savesDir.mkdirs()
        val systemDir = java.io.File(filesDir, "system")
        if (!systemDir.exists()) systemDir.mkdirs()
        val statesDir = java.io.File(filesDir, "states")
        if (!statesDir.exists()) statesDir.mkdirs()

        // Import save từ external nếu có (người dùng bỏ file .sav vào /Alga/saves/)
        importSavesFromExternal(savesDir)

        val isNDS = corePath.contains("melonds", ignoreCase = true) ||
                    corePath.contains("desmume", ignoreCase = true)

        // Cấu hình LibretroDroid
        val viewData = GLRetroViewData(this).apply {
            coreFilePath = corePath
            gameFilePath = romPath
            savesDirectory = savesDir.absolutePath
            systemDirectory = systemDir.absolutePath
            shader = ShaderConfig.Default
            preferLowLatencyAudio = true
            rumbleEventsEnabled = false
            skipDuplicateFrames = false

            if (isNDS) {
                variables = arrayOf(
                    Variable("melonds_screen_layout", screenLayouts[0]),
                    Variable("melonds_touch_mode", "Touch"),
                )
            }
        }

        retroView = GLRetroView(this, viewData)

        // Error handling
        retroView!!.getGLRetroErrors()
            .onEach { errorCode ->
                android.util.Log.e("GameActivity", "LibretroDroid error: $errorCode")
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Emulation error: $errorCode", android.widget.Toast.LENGTH_SHORT).show()
                    finish()
                }
            }
            .catch { e -> android.util.Log.e("GameActivity", "Error flow exception", e) }
            .launchIn(lifecycleScope)

        // Layout
        val container = FrameLayout(this)
        container.addView(retroView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        val touchControls = TouchControlsOverlay(this)
        touchControls.retroView = retroView
        touchControls.gameActivity = this
        touchControls.isNDS = isNDS
        container.addView(touchControls, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(container)

        // Fullscreen
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, container).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        // Kết nối lifecycle — GLRetroView quản lý resume/pause/destroy qua đây
        lifecycle.addObserver(retroView!!)

        // Bắt đầu auto-save SRAM mỗi 30 giây
        autoSaveHandler.postDelayed(autoSaveRunnable, autoSaveInterval)
    }

    // === NDS screen layout ===
    fun toggleScreenLayout() {
        currentLayoutIndex = (currentLayoutIndex + 1) % screenLayouts.size
        applyScreenLayout(currentLayoutIndex)
    }

    fun applyScreenLayout(index: Int) {
        currentLayoutIndex = index.coerceIn(0, screenLayouts.size - 1)
        val layout = screenLayouts[currentLayoutIndex]
        android.util.Log.d("GameActivity", "Screen layout: $layout")
        retroView?.updateVariables(Variable("melonds_screen_layout", layout))
    }

    fun getCurrentLayoutName(): String = screenLayouts[currentLayoutIndex]

    // === Save State (lưu/tải trạng thái emulator) ===
    fun saveState(slot: Int) {
        try {
            val data = retroView?.serializeState()
            if (data != null && data.isNotEmpty()) {
                val statesDir = java.io.File(filesDir, "states")
                if (!statesDir.exists()) statesDir.mkdirs()
                val stateFile = java.io.File(statesDir, "${romBaseName}.slot${slot}.state")
                stateFile.writeBytes(data)
                currentStateSlot = slot
                android.util.Log.d("GameActivity", "State saved: ${stateFile.name} (${data.size} bytes)")
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Đã lưu Slot $slot", android.widget.Toast.LENGTH_SHORT).show()
                }

                // Backup ra external
                try {
                    val extStates = java.io.File(android.os.Environment.getExternalStorageDirectory(), "Alga/states")
                    if (!extStates.exists()) extStates.mkdirs()
                    stateFile.copyTo(java.io.File(extStates, stateFile.name), overwrite = true)
                } catch (_: Exception) {}
            } else {
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Không thể lưu state", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Save state failed", e)
            runOnUiThread {
                android.widget.Toast.makeText(this, "Lỗi lưu state: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun loadState(slot: Int) {
        try {
            val statesDir = java.io.File(filesDir, "states")
            val stateFile = java.io.File(statesDir, "${romBaseName}.slot${slot}.state")

            // Thử import từ external nếu internal không có
            if (!stateFile.exists()) {
                val extFile = java.io.File(android.os.Environment.getExternalStorageDirectory(), "Alga/states/${stateFile.name}")
                if (extFile.exists()) extFile.copyTo(stateFile, overwrite = true)
            }

            if (!stateFile.exists()) {
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Slot $slot trống", android.widget.Toast.LENGTH_SHORT).show()
                }
                return
            }

            val data = stateFile.readBytes()
            val success = retroView?.unserializeState(data) ?: false
            currentStateSlot = slot
            android.util.Log.d("GameActivity", "State loaded: ${stateFile.name} (${data.size} bytes) success=$success")
            runOnUiThread {
                android.widget.Toast.makeText(this, if (success) "Đã tải Slot $slot" else "Lỗi tải state", android.widget.Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Load state failed", e)
            runOnUiThread {
                android.widget.Toast.makeText(this, "Lỗi tải state: ${e.message}", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun hasState(slot: Int): Boolean {
        val statesDir = java.io.File(filesDir, "states")
        val stateFile = java.io.File(statesDir, "${romBaseName}.slot${slot}.state")
        if (stateFile.exists()) return true
        val extFile = java.io.File(android.os.Environment.getExternalStorageDirectory(), "Alga/states/${stateFile.name}")
        return extFile.exists()
    }

    // === SRAM Save Helper ===
    private fun saveSRAM(reason: String) {
        try {
            retroView?.serializeSRAM()
            android.util.Log.d("GameActivity", "SRAM saved ($reason)")

            // Backup save ra external storage để người dùng truy cập được
            backupSavesToExternal()
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Failed to save SRAM ($reason)", e)
        }
    }

    private fun backupSavesToExternal() {
        try {
            val internalSaves = java.io.File(filesDir, "saves")
            val externalSaves = java.io.File(
                android.os.Environment.getExternalStorageDirectory(), "Alga/saves"
            )
            if (!externalSaves.exists()) externalSaves.mkdirs()

            internalSaves.listFiles()?.forEach { src ->
                val dst = java.io.File(externalSaves, src.name)
                // Chỉ copy nếu file thay đổi (so sánh size + modified time)
                if (!dst.exists() || src.length() != dst.length() || src.lastModified() > dst.lastModified()) {
                    src.copyTo(dst, overwrite = true)
                    android.util.Log.d("GameActivity", "Backup save: ${src.name} → ${dst.absolutePath}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("GameActivity", "Backup save to external failed (non-critical)", e)
        }
    }

    private fun importSavesFromExternal(internalSavesDir: java.io.File) {
        try {
            val externalSaves = java.io.File(
                android.os.Environment.getExternalStorageDirectory(), "Alga/saves"
            )
            if (!externalSaves.exists()) return

            externalSaves.listFiles()?.forEach { src ->
                val dst = java.io.File(internalSavesDir, src.name)
                // Import nếu external mới hơn internal (người dùng thay file save)
                if (!dst.exists() || src.lastModified() > dst.lastModified()) {
                    src.copyTo(dst, overwrite = true)
                    android.util.Log.d("GameActivity", "Imported save: ${src.name} → internal")
                }
            }
        } catch (e: Exception) {
            android.util.Log.w("GameActivity", "Import save failed (non-critical)", e)
        }
    }

    // === Lifecycle: Lưu SRAM TRƯỚC khi core pause ===
    override fun onPause() {
        // QUAN TRỌNG: Gọi saveSRAM TRƯỚC super.onPause()
        // vì super.onPause() trigger lifecycle ON_PAUSE → LibretroDroid.pause()
        // Sau khi core pause, SRAM có thể không đọc được
        saveSRAM("onPause")
        autoSaveHandler.removeCallbacks(autoSaveRunnable)
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        // Restart auto-save timer
        autoSaveHandler.postDelayed(autoSaveRunnable, autoSaveInterval)
    }

    override fun onDestroy() {
        autoSaveHandler.removeCallbacks(autoSaveRunnable)

        // KHÔNG gọi lifecycle.removeObserver() ở đây!
        // Để super.onDestroy() dispatch ON_DESTROY → GLRetroView cleanup native resources
        // Nếu remove observer trước → LibretroDroid.destroy() không được gọi → memory leak → crash lần sau

        super.onDestroy()  // → dispatch ON_DESTROY → GLRetroView.destroy() → LibretroDroid.destroy()
        retroView = null
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            // Lưu SRAM trước khi thoát
            saveSRAM("back-button")
            finish()
            return true
        }
        return retroView?.onKeyDown(keyCode, event) ?: super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        return retroView?.onKeyUp(keyCode, event) ?: super.onKeyUp(keyCode, event)
    }
}
