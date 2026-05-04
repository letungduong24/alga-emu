package expo.modules.applauncher

import android.os.Bundle
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.FrameLayout
import android.hardware.input.InputManager
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

class GameActivity : AppCompatActivity(), InputManager.InputDeviceListener {

    var retroView: GLRetroView? = null
    private var touchControls: TouchControlsOverlay? = null
    private var inputManager: InputManager? = null

    // melonDS layouts
    private val melondsLayouts = arrayOf(
        "Left/Right", "Top/Bottom", "Top Only", "Bottom Only", "Hybrid Top",
    )
    // DeSmuME layouts
    private val desmumeLayouts = arrayOf(
        "left/right", "top/bottom", "top only", "bottom only", "hybrid/top",
    )
    // Citra (3DS) layouts
    private val citraLayouts = arrayOf(
        "Default Top-Bottom Screen", "Single Screen Only",
        "Large Screen, Small Screen", "Side by Side",
    )
    private var screenLayouts = melondsLayouts
    private var screenLayoutVar = "melonds_screen_layout"
    private var isMelonDS = true
    var is3DS = false
    var isGBA = false
    var currentLayoutIndex = 0
    var currentStateSlot = 0
    private var romBaseName: String = ""

    // === Cheat System ===
    data class CheatEntry(var name: String, var code: String, var enabled: Boolean = true)
    val cheats = mutableListOf<CheatEntry>()

    private fun getCheatsFile(): java.io.File {
        val dir = java.io.File(filesDir, "cheats")
        if (!dir.exists()) dir.mkdirs()
        return java.io.File(dir, "${romBaseName}.json")
    }

    fun loadCheats() {
        cheats.clear()
        val file = getCheatsFile()
        if (!file.exists()) return
        try {
            val json = org.json.JSONArray(file.readText())
            for (i in 0 until json.length()) {
                val obj = json.getJSONObject(i)
                cheats.add(CheatEntry(
                    name = obj.getString("name"),
                    code = obj.getString("code"),
                    enabled = obj.optBoolean("enabled", true)
                ))
            }
            android.util.Log.d("GameActivity", "Loaded ${cheats.size} cheats for $romBaseName")
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Failed to load cheats", e)
        }
    }

    fun saveCheats() {
        try {
            val json = org.json.JSONArray()
            for (c in cheats) {
                val obj = org.json.JSONObject()
                obj.put("name", c.name)
                obj.put("code", c.code)
                obj.put("enabled", c.enabled)
                json.put(obj)
            }
            getCheatsFile().writeText(json.toString(2))
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Failed to save cheats", e)
        }
    }

    fun applyCheats() {
        val rv = retroView ?: return
        for ((i, cheat) in cheats.withIndex()) {
            try {
                rv.setCheat(i, cheat.enabled, cheat.code)
                android.util.Log.d("GameActivity", "Cheat[$i] ${if (cheat.enabled) "ON" else "OFF"}: ${cheat.name}")
            } catch (e: Exception) {
                android.util.Log.e("GameActivity", "Failed to apply cheat[$i]: ${cheat.name}", e)
            }
        }
    }

    fun addCheat(name: String, code: String) {
        cheats.add(CheatEntry(name, code, true))
        saveCheats()
        applyCheats()
        runOnUiThread {
            android.widget.Toast.makeText(this, "Đã thêm: $name", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    fun toggleCheat(index: Int) {
        if (index !in cheats.indices) return
        cheats[index].enabled = !cheats[index].enabled
        saveCheats()
        applyCheats()
    }

    fun removeCheat(index: Int) {
        if (index !in cheats.indices) return
        val name = cheats[index].name
        cheats.removeAt(index)
        saveCheats()
        applyCheats()
        runOnUiThread {
            android.widget.Toast.makeText(this, "Đã xóa: $name", android.widget.Toast.LENGTH_SHORT).show()
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

        romBaseName = java.io.File(romPath).nameWithoutExtension

        android.util.Log.d("GameActivity", "=== Starting Game ===")
        android.util.Log.d("GameActivity", "Core: $corePath")
        android.util.Log.d("GameActivity", "ROM: $romPath")

        // Directories — chỉ tạo, KHÔNG can thiệp vào file saves
        val savesDir = java.io.File(filesDir, "saves")
        if (!savesDir.exists()) savesDir.mkdirs()
        val systemDir = java.io.File(filesDir, "system")
        if (!systemDir.exists()) systemDir.mkdirs()
        val statesDir = java.io.File(filesDir, "states")
        if (!statesDir.exists()) statesDir.mkdirs()

        android.util.Log.d("GameActivity", "Saves dir: ${savesDir.absolutePath}")

        // Log files at startup
        savesDir.listFiles()?.forEach { f ->
            android.util.Log.d("GameActivity", "  ${f.name} = ${f.length()} bytes")
        }

        val isNDS = corePath.contains("melonds", ignoreCase = true) ||
                    corePath.contains("desmume", ignoreCase = true)

        isMelonDS = corePath.contains("melonds", ignoreCase = true)
        if (!isMelonDS && corePath.contains("desmume", ignoreCase = true)) {
            screenLayouts = desmumeLayouts
            screenLayoutVar = "desmume_screens_layout"
        }

        is3DS = corePath.contains("citra", ignoreCase = true)
        if (is3DS) {
            screenLayouts = citraLayouts
            screenLayoutVar = "citra_layout_option"
        }

        isGBA = corePath.contains("mgba", ignoreCase = true) ||
                corePath.contains("vba", ignoreCase = true) ||
                corePath.contains("gpsp", ignoreCase = true)

        val hasDualScreen = isNDS || is3DS

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
                if (isMelonDS) {
                    variables = arrayOf(
                        Variable("melonds_screen_layout", screenLayouts[0]),
                        Variable("melonds_touch_mode", "Touch"),
                    )
                } else {
                    variables = arrayOf(
                        Variable("desmume_screens_layout", screenLayouts[0]),
                        Variable("desmume_pointer_type", "touch"),
                    )
                }
            }
            if (is3DS) {
                variables = arrayOf(
                    Variable("citra_layout_option", screenLayouts[0]),
                    Variable("citra_analog_function", "C-Stick and Touchscreen Pointer"),
                    Variable("citra_is_new_3ds", "New 3DS"),
                    Variable("citra_use_virtual_sd", "enabled"),
                    Variable("citra_touch_touchscreen", "enabled"),
                    Variable("citra_use_hw_shader", "disabled"),  // Fix crash on Android GPUs (Mario Kart 7 etc.)
                    Variable("citra_resolution_factor", "1"),     // Native res to prevent OOM
                )
            }
            if (isGBA) {
                variables = arrayOf(
                    Variable("mgba_solar_sensor_level", "0"),
                    Variable("mgba_sgb_borders", "OFF"),
                    Variable("mgba_color_correction", "Game Boy Advance"),
                )
            }
        }

        retroView = GLRetroView(this, viewData)

        // Load cheats from file
        loadCheats()

        retroView!!.getGLRetroEvents()
            .onEach { event ->
                if (event is GLRetroView.GLRetroEvents.SurfaceCreated) {
                    // Core is ready — apply saved settings + cheats
                    applyCheats()

                    // Restore saved speed & layout
                    val prefs = getSharedPreferences("alga_controls", MODE_PRIVATE)
                    val savedSpeed = prefs.getInt("speed", 1)
                    if (savedSpeed > 1) retroView?.frameSpeed = savedSpeed

                    val savedLayout = prefs.getInt("layout", 0)
                    if (savedLayout > 0 && hasDualScreen) {
                        currentLayoutIndex = savedLayout
                        applyScreenLayout(savedLayout)
                    }
                }
            }
            .catch { e -> android.util.Log.e("GameActivity", "Events flow exception", e) }
            .launchIn(lifecycleScope)

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

        val container = FrameLayout(this)
        container.addView(retroView, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        touchControls = TouchControlsOverlay(this)
        touchControls!!.retroView = retroView
        touchControls!!.gameActivity = this
        touchControls!!.isNDS = isNDS
        touchControls!!.is3DS = is3DS
        touchControls!!.isGBA = isGBA
        container.addView(touchControls, FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ))

        setContentView(container)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, container).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        lifecycle.addObserver(retroView!!)

        // === Gamepad detection ===
        inputManager = getSystemService(INPUT_SERVICE) as InputManager
        inputManager?.registerInputDeviceListener(this, null)
        updateGamepadState()
    }

    override fun onDestroy() {
        inputManager?.unregisterInputDeviceListener(this)
        retroView?.let {
            lifecycle.removeObserver(it)
            (it.parent as? android.view.ViewGroup)?.removeView(it)
        }
        retroView = null
        touchControls = null
        super.onDestroy()
        // Force kill :game process to fully clean native .so state
        android.os.Process.killProcess(android.os.Process.myPid())
    }

    // === Physical Gamepad Support ===
    override fun onInputDeviceAdded(deviceId: Int) { updateGamepadState() }
    override fun onInputDeviceRemoved(deviceId: Int) { updateGamepadState() }
    override fun onInputDeviceChanged(deviceId: Int) { updateGamepadState() }

    private fun updateGamepadState() {
        val connected = isGamepadConnected()
        android.util.Log.d("GameActivity", "Gamepad connected: $connected")
        touchControls?.gamepadConnected = connected
    }

    private fun isGamepadConnected(): Boolean {
        return InputDevice.getDeviceIds().any { id ->
            InputDevice.getDevice(id)?.let { device ->
                val sources = device.sources
                (sources and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD) ||
                (sources and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK)
            } ?: false
        }
    }

    override fun onGenericMotionEvent(event: MotionEvent): Boolean {
        val source = event.source
        if ((source and InputDevice.SOURCE_JOYSTICK == InputDevice.SOURCE_JOYSTICK ||
             source and InputDevice.SOURCE_GAMEPAD == InputDevice.SOURCE_GAMEPAD) &&
            event.action == MotionEvent.ACTION_MOVE) {
            return retroView?.onGenericMotionEvent(event) ?: super.onGenericMotionEvent(event)
        }
        return super.onGenericMotionEvent(event)
    }

    // === NDS screen layout ===
    fun toggleScreenLayout() {
        currentLayoutIndex = (currentLayoutIndex + 1) % screenLayouts.size
        applyScreenLayout(currentLayoutIndex)
    }

    fun applyScreenLayout(index: Int) {
        currentLayoutIndex = index.coerceIn(0, screenLayouts.size - 1)
        val layout = screenLayouts[currentLayoutIndex]
        android.util.Log.d("GameActivity", "Screen layout: $layout (var: $screenLayoutVar)")
        retroView?.updateVariables(Variable(screenLayoutVar, layout))
    }

    fun getCurrentLayoutName(): String = screenLayouts[currentLayoutIndex]

    // === Save State ===
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
                    android.widget.Toast.makeText(this, "Đã lưu Slot ${slot + 1}", android.widget.Toast.LENGTH_SHORT).show()
                }
            } else {
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Không thể lưu state", android.widget.Toast.LENGTH_SHORT).show()
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Save state failed", e)
        }
    }

    fun loadState(slot: Int) {
        try {
            val statesDir = java.io.File(filesDir, "states")
            val stateFile = java.io.File(statesDir, "${romBaseName}.slot${slot}.state")
            if (!stateFile.exists()) {
                runOnUiThread {
                    android.widget.Toast.makeText(this, "Slot ${slot + 1} trống", android.widget.Toast.LENGTH_SHORT).show()
                }
                return
            }
            val data = stateFile.readBytes()
            val success = retroView?.unserializeState(data) ?: false
            currentStateSlot = slot
            android.util.Log.d("GameActivity", "State loaded: ${stateFile.name} success=$success")
            runOnUiThread {
                android.widget.Toast.makeText(this, if (success) "Đã tải Slot ${slot + 1}" else "Lỗi tải state", android.widget.Toast.LENGTH_SHORT).show()
            }
        } catch (e: Exception) {
            android.util.Log.e("GameActivity", "Load state failed", e)
        }
    }

    fun hasState(slot: Int): Boolean {
        val statesDir = java.io.File(filesDir, "states")
        return java.io.File(statesDir, "${romBaseName}.slot${slot}.state").exists()
    }

    // === Lifecycle ===

    private var finishTriggered = false
    private var exitDialogShowing = false


    /**
     * Flow thoát game:
     *   Back → Alert "Thoát game?" → User ấn "Thoát"
     *   → Toast "Đang thoát..." → Poll chờ core flush save (tối đa 2s)
     *   → finish()
     *
     * Alert dialog vừa confirm, vừa cho core thời gian flush save bất đồng bộ.
     * Khi user ấn "Thoát", save đã có ~1-2s flush → poll 2s nữa = tổng ~3-4s.
     */
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (finishTriggered || exitDialogShowing) return true

            exitDialogShowing = true
            showExitConfirmDialog()
            return true
        }
        return retroView?.onKeyDown(keyCode, event) ?: super.onKeyDown(keyCode, event)
    }

    fun showExitConfirmDialog() {
        val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Thoát game")
            .setMessage("Bạn có muốn thoát game không?")
            .setPositiveButton("Thoát") { _, _ ->
                finishTriggered = true
                exitDialogShowing = false
                performSafeExit()
            }
            .setNegativeButton("Tiếp tục chơi") { dialog, _ ->
                exitDialogShowing = false
                dialog.dismiss()
            }
            .setCancelable(false)
            .create()

        // Style dialog cho đẹp hơn trên nền game tối
        dialog.window?.setBackgroundDrawableResource(android.R.color.background_dark)
        dialog.show()
    }

    private fun performSafeExit() {
        android.util.Log.d("GameActivity", "Exit confirmed — waiting for core to flush save...")
        android.widget.Toast.makeText(this, "Đang thoát...", android.widget.Toast.LENGTH_SHORT).show()

        // MelonDS core ghi save bất đồng bộ.
        // Poll chờ file .sav thay đổi (core đã flush) → finish.
        // Timeout 2s vì dialog đã cho core ~1-2s rồi.
        val savesDir = java.io.File(filesDir, "saves")
        val saveFile = java.io.File(savesDir, "${romBaseName}.sav")
        val initialModified = if (saveFile.exists()) saveFile.lastModified() else 0L
        val initialSize = if (saveFile.exists()) saveFile.length() else 0L

        val handler = android.os.Handler(android.os.Looper.getMainLooper())
        val startTime = System.currentTimeMillis()
        val maxWait = 2000L
        val pollInterval = 200L

        val pollRunnable = object : Runnable {
            override fun run() {
                val elapsed = System.currentTimeMillis() - startTime
                val currentModified = if (saveFile.exists()) saveFile.lastModified() else 0L
                val currentSize = if (saveFile.exists()) saveFile.length() else 0L
                val fileChanged = currentModified != initialModified || currentSize != initialSize

                if (fileChanged) {
                    android.util.Log.d("GameActivity", "Save flushed after ${elapsed}ms — exiting")
                    finish()
                } else if (elapsed >= maxWait) {
                    android.util.Log.d("GameActivity", "Timeout (${maxWait}ms) — exiting anyway")
                    finish()
                } else {
                    handler.postDelayed(this, pollInterval)
                }
            }
        }

        handler.postDelayed(pollRunnable, pollInterval)
    }

    fun restartGame() {
        val dialog = androidx.appcompat.app.AlertDialog.Builder(this)
            .setTitle("Chạy lại game")
            .setMessage("Game sẽ được khởi động lại. Tiến trình chưa lưu sẽ mất.")
            .setPositiveButton("Chạy lại") { _, _ ->
                val newIntent = android.content.Intent(this, GameActivity::class.java)
                newIntent.putExtra("CORE_PATH", intent.getStringExtra("CORE_PATH"))
                newIntent.putExtra("ROM_PATH", intent.getStringExtra("ROM_PATH"))
                newIntent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP)
                startActivity(newIntent)
                finish()
            }
            .setNegativeButton("Hủy") { d, _ -> d.dismiss() }
            .setCancelable(false)
            .create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.background_dark)
        dialog.show()
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        return retroView?.onKeyUp(keyCode, event) ?: super.onKeyUp(keyCode, event)
    }
}
