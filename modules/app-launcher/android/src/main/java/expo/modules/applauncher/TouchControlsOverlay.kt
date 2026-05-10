package expo.modules.applauncher

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import com.swordfish.libretrodroid.GLRetroView

class TouchControlsOverlay @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : View(context, attrs) {

    var retroView: GLRetroView? = null
    var gameActivity: GameActivity? = null
    var isNDS: Boolean = false
    var is3DS: Boolean = false
    var isGBA: Boolean = false
    var isPSP: Boolean = false

    private val prefs: SharedPreferences = context.getSharedPreferences("alga_controls", Context.MODE_PRIVATE)
    private var buttonScale: Float = prefs.getFloat("button_scale", 1.0f)
    private var currentSpeed: Int = prefs.getInt("speed", 1)
    private var savedLayoutIndex: Int = prefs.getInt("layout", 0)
    private var menuOpen: Boolean = false

    // === Physical Gamepad auto-hide ===
    var gamepadConnected: Boolean = false
        set(value) {
            if (field != value) {
                field = value
                post {
                    android.widget.Toast.makeText(
                        context,
                        if (value) "🎮 Tay cầm đã kết nối" else "🎮 Tay cầm đã ngắt",
                        android.widget.Toast.LENGTH_SHORT
                    ).show()
                }
                invalidate()
            }
        }

    // === 3DS Joystick ===
    data class VJoystick(
        var cx: Float = 0f, var cy: Float = 0f,
        var outerR: Float = 0f, var thumbR: Float = 0f,
        var nx: Float = 0f, var ny: Float = 0f,
        var pointerId: Int = -1, val motionSource: Int
    )
    private val circlePad = VJoystick(motionSource = GLRetroView.MOTION_SOURCE_ANALOG_LEFT)
    private val cStick = VJoystick(motionSource = GLRetroView.MOTION_SOURCE_ANALOG_RIGHT)

    // === Paint ===
    private val btnFillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(110, 0, 0, 0); style = Paint.Style.FILL
    }
    private val btnPressedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(170, 50, 140, 220); style = Paint.Style.FILL
    }
    private val btnStrokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(160, 255, 255, 255); style = Paint.Style.STROKE; strokeWidth = 2f
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(230, 255, 255, 255); textAlign = Paint.Align.CENTER
        isFakeBoldText = true; setShadowLayer(4f, 1f, 1f, Color.argb(200, 0, 0, 0))
    }
    private val menuDimPaint = Paint().apply { color = Color.argb(100, 0, 0, 0) }
    private val menuBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(240, 20, 20, 30); style = Paint.Style.FILL
    }
    private val menuBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(50, 255, 255, 255); style = Paint.Style.STROKE; strokeWidth = 1f
    }
    private val menuItemPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(45, 255, 255, 255); style = Paint.Style.FILL
    }
    private val menuActivePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(180, 45, 120, 210); style = Paint.Style.FILL
    }
    private val menuTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(245, 255, 255, 255); textAlign = Paint.Align.CENTER
    }
    private val menuLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(120, 160, 170, 200); textAlign = Paint.Align.LEFT
    }
    private val menuHintPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.argb(70, 160, 170, 200); textAlign = Paint.Align.CENTER
    }

    data class VButton(
        val id: String, val label: String, val keyCode: Int,
        var bounds: RectF = RectF(), var isPressed: Boolean = false
    )

    private val gameButtons = mutableListOf(
        VButton("du", "▲", KeyEvent.KEYCODE_DPAD_UP),
        VButton("dd", "▼", KeyEvent.KEYCODE_DPAD_DOWN),
        VButton("dl", "◀", KeyEvent.KEYCODE_DPAD_LEFT),
        VButton("dr", "▶", KeyEvent.KEYCODE_DPAD_RIGHT),
        VButton("a", "A", KeyEvent.KEYCODE_BUTTON_A),
        VButton("b", "B", KeyEvent.KEYCODE_BUTTON_B),
        VButton("x", "X", KeyEvent.KEYCODE_BUTTON_X),
        VButton("y", "Y", KeyEvent.KEYCODE_BUTTON_Y),
        VButton("l", "L", KeyEvent.KEYCODE_BUTTON_L1),
        VButton("r", "R", KeyEvent.KEYCODE_BUTTON_R1),
        VButton("start", "START", KeyEvent.KEYCODE_BUTTON_START),
        VButton("select", "SELECT", KeyEvent.KEYCODE_BUTTON_SELECT),
    )

    // 3DS extra buttons (added dynamically)
    private val zlButton = VButton("zl", "ZL", KeyEvent.KEYCODE_BUTTON_L2)
    private val zrButton = VButton("zr", "ZR", KeyEvent.KEYCODE_BUTTON_R2)

    private val menuButton = VButton("menu", "⚙", -1)

    // Update button labels based on platform
    private fun updateButtonLabels() {
        if (isPSP) {
            // PSP: △ ○ ✕ □
            gameButtons.find { it.id == "y" }?.label = "△"  // Triangle (top)
            gameButtons.find { it.id == "a" }?.label = "○"  // Circle (right)
            gameButtons.find { it.id == "b" }?.label = "✕"  // Cross (bottom)
            gameButtons.find { it.id == "x" }?.label = "□"  // Square (left)
        } else {
            // Default: A B X Y
            gameButtons.find { it.id == "a" }?.label = "A"
            gameButtons.find { it.id == "b" }?.label = "B"
            gameButtons.find { it.id == "x" }?.label = "X"
            gameButtons.find { it.id == "y" }?.label = "Y"
        }
    }

    data class MenuItem(val id: String, var label: String, var bounds: RectF = RectF())

    private val speedItems = listOf(MenuItem("s1", "1×"), MenuItem("s2", "2×"), MenuItem("s4", "4×"))
    private val scaleItems = listOf(MenuItem("sd", "Thu nhỏ"), MenuItem("su", "Phóng to"))
    private val saveStateItems = listOf(MenuItem("ss0", "Lưu 1"), MenuItem("ss1", "Lưu 2"), MenuItem("ss2", "Lưu 3"))
    private val loadStateItems = listOf(MenuItem("ls0", "Tải 1"), MenuItem("ls1", "Tải 2"), MenuItem("ls2", "Tải 3"))
    private val layoutItems = listOf(
        MenuItem("l0", "Trái / Phải"), MenuItem("l1", "Trên / Dưới"),
        MenuItem("l2", "Chỉ màn trên"), MenuItem("l3", "Chỉ màn dưới"), MenuItem("l4", "Kết hợp"),
    )
    private val layout3dsItems = listOf(
        MenuItem("l0", "Trên / Dưới"), MenuItem("l1", "Chỉ 1 màn"),
        MenuItem("l2", "Lớn / Nhỏ"), MenuItem("l3", "Cạnh nhau"),
    )
    private val exitMenuItem = MenuItem("exit_game", "Thoát")


    private var menuPanelRect = RectF()
    private val pointerButtons = mutableMapOf<Int, MutableSet<String>>()
    // Pointers forwarded to GLRetroView for screen touch
    private val screenPointers = mutableSetOf<Int>()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        layoutButtons(w.toFloat(), h.toFloat())
    }

    private fun layoutButtons(w: Float, h: Float) {
        val u = minOf(w, h) * 0.075f * buttonScale
        // Margin lớn hơn để nút KHÔNG bị lẹm ra ngoài
        val safeMargin = u * 1.5f

        textPaint.textSize = u * 0.5f

        // === D-PAD ===
        val dR = u * 0.9f
        val dGap = dR * 0.15f
        val dStep = dR * 2f + dGap
        // Center D-pad sao cho nút ngoài cùng cách viền = safeMargin
        val dCX = safeMargin + dStep
        val dCY = h - safeMargin - dStep

        setCircle(gameButtons[0], dCX, dCY - dStep, dR)
        setCircle(gameButtons[1], dCX, dCY + dStep, dR)
        setCircle(gameButtons[2], dCX - dStep, dCY, dR)
        setCircle(gameButtons[3], dCX + dStep, dCY, dR)

        // === ABXY ===
        val fR = u * 0.85f
        val fGap = fR * 0.2f
        val fStep = fR * 2f + fGap
        val fCX = w - safeMargin - fStep
        val fCY = h - safeMargin - fStep

        setCircle(gameButtons[4], fCX + fStep, fCY, fR)  // A
        setCircle(gameButtons[5], fCX, fCY + fStep, fR)  // B
        setCircle(gameButtons[6], fCX, fCY - fStep, fR)  // X
        setCircle(gameButtons[7], fCX - fStep, fCY, fR)  // Y

        // === L / R (nhỏ hơn, thụt vào) ===
        val lrW = u * 2.2f; val lrH = u * 0.85f
        val topM = u * 1.2f
        gameButtons[8].bounds.set(topM, topM, topM + lrW, topM + lrH)
        gameButtons[9].bounds.set(w - topM - lrW, topM, w - topM, topM + lrH)

        // === START / SELECT ===
        val sW = u * 1.7f; val sH = u * 0.65f
        val sY = h - u * 0.6f - sH
        val sGap = u * 1.0f  // Khoảng cách giữa SELECT - START (chừa chỗ cho ⚙)
        gameButtons[10].bounds.set(w * 0.5f + sGap, sY, w * 0.5f + sGap + sW, sY + sH)   // START
        gameButtons[11].bounds.set(w * 0.5f - sGap - sW, sY, w * 0.5f - sGap, sY + sH)   // SELECT

        // === ⚙ GIỮA SELECT VÀ START (không che game) ===
        val gearS = u * 0.5f
        menuButton.bounds.set(
            w * 0.5f - gearS, sY,
            w * 0.5f + gearS, sY + sH
        )

        // === 3DS: ZL/ZR below L/R, Circle Pad, C-Stick, D-pad repositioned ===
        if (is3DS) {
            // ZL/ZR: below L/R with clear gap (1.2u from bottom of L/R)
            val zlzrH = u * 0.65f
            val zlzrY = topM + lrH + u * 1.2f
            zlButton.bounds.set(topM, zlzrY, topM + lrW, zlzrY + zlzrH)
            zrButton.bounds.set(w - topM - lrW, zlzrY, w - topM, zlzrY + zlzrH)

            // Circle Pad = joystick, positioned lower (closer to bottom)
            circlePad.outerR = u * 1.8f
            circlePad.thumbR = u * 0.6f
            val cpCY = h * 0.52f
            circlePad.cx = dCX
            circlePad.cy = cpCY

            // D-pad: smaller, positioned BELOW Circle Pad with tighter gap
            val smallDR = dR * 0.5f
            val smallDStep = smallDR * 2f + dGap * 0.3f
            val smallDCY = cpCY + circlePad.outerR + smallDStep + u * 0.6f
            // Clamp D-pad so it stays inside screen with small margin
            val clampedDCY = minOf(smallDCY, h - u * 0.8f - smallDStep - smallDR)
            setCircle(gameButtons[0], dCX, clampedDCY - smallDStep, smallDR) // Up
            setCircle(gameButtons[1], dCX, clampedDCY + smallDStep, smallDR) // Down
            setCircle(gameButtons[2], dCX - smallDStep, clampedDCY, smallDR) // Left
            setCircle(gameButtons[3], dCX + smallDStep, clampedDCY, smallDR) // Right

            // C-Stick = small joystick ABOVE ABXY (not overlapping game screen)
            cStick.outerR = u * 0.8f
            cStick.thumbR = u * 0.3f
            cStick.cx = fCX - fStep - u * 0.5f
            cStick.cy = fCY - fStep - u * 1.2f
        }

        // === GBA: simpler layout — no X/Y, no joystick, larger A/B buttons ===
        if (isGBA) {
            // Larger A/B buttons for GBA (only 2 face buttons)
            val gbaR = u * 1.1f
            val gbaGap = gbaR * 0.25f
            val gbaStep = gbaR * 2f + gbaGap
            val gbaCX = w - safeMargin - gbaStep * 0.6f
            val gbaCY = h - safeMargin - gbaStep * 0.8f

            // A = right, B = left-below (classic GBA diamond)
            setCircle(gameButtons[4], gbaCX + gbaStep * 0.5f, gbaCY - gbaStep * 0.25f, gbaR)  // A
            setCircle(gameButtons[5], gbaCX - gbaStep * 0.5f, gbaCY + gbaStep * 0.25f, gbaR)  // B

            // Hide X/Y by moving them offscreen
            setCircle(gameButtons[6], -100f, -100f, 0f)  // X hidden
            setCircle(gameButtons[7], -100f, -100f, 0f)  // Y hidden
        }

        layoutMenuPanel(w, h)
    }

    private fun layoutMenuPanel(w: Float, h: Float) {
        val panelW = minOf(w * 0.65f, 720f)
        val itemH = minOf(h * 0.09f, 62f)
        val gap = 5f
        val sectionLabelH = itemH * 0.55f
        val sectionGap = 10f
        val titleH = itemH * 1.1f
        val padY = 14f
        val padX = panelW * 0.05f
        val hasDualScreen = isNDS || is3DS
        val isSimpleConsole = isGBA
        val activeLayoutItems = if (is3DS) layout3dsItems else layoutItems

        // Đếm nội dung: speed + scale + save/load state + layout(NDS) + cheats
        var contentH = titleH + padY
        contentH += sectionLabelH + sectionGap + itemH + gap  // Speed
        contentH += sectionLabelH + sectionGap + itemH + gap  // Scale
        contentH += sectionLabelH + sectionGap + itemH + gap  // Save state (3 cols)
        contentH += sectionLabelH + sectionGap + itemH + gap  // Load state (3 cols)
        if (hasDualScreen) {
            contentH += sectionLabelH + sectionGap + activeLayoutItems.size * (itemH + gap)
        }
        // Cheats button (single item)
        contentH += sectionLabelH + sectionGap + itemH + gap
        // Exit / Restart
        contentH += sectionLabelH + sectionGap + itemH + gap
        contentH += padY + sectionLabelH  // Hint

        val panelX = (w - panelW) * 0.5f
        val panelY = (h - contentH) * 0.5f
        menuPanelRect.set(panelX, panelY, panelX + panelW, panelY + contentH)

        var curY = panelY + titleH + padY

        // Speed: 3 columns
        curY += sectionLabelH + sectionGap
        val colW3 = (panelW - padX * 2f - gap * 2f) / 3f
        for ((i, item) in speedItems.withIndex()) {
            val x = panelX + padX + i * (colW3 + gap)
            item.bounds.set(x, curY, x + colW3, curY + itemH)
        }
        curY += itemH + gap

        // Scale: 2 columns
        curY += sectionLabelH + sectionGap
        val colW2 = (panelW - padX * 2f - gap) / 2f
        for ((i, item) in scaleItems.withIndex()) {
            val x = panelX + padX + i * (colW2 + gap)
            item.bounds.set(x, curY, x + colW2, curY + itemH)
        }
        curY += itemH + gap

        // Save State: 3 columns
        curY += sectionLabelH + sectionGap
        for ((i, item) in saveStateItems.withIndex()) {
            val x = panelX + padX + i * (colW3 + gap)
            item.bounds.set(x, curY, x + colW3, curY + itemH)
        }
        curY += itemH + gap

        // Load State: 3 columns
        curY += sectionLabelH + sectionGap
        for ((i, item) in loadStateItems.withIndex()) {
            val x = panelX + padX + i * (colW3 + gap)
            item.bounds.set(x, curY, x + colW3, curY + itemH)
        }
        curY += itemH + gap

        // Layout (NDS or 3DS)
        if (hasDualScreen && activeLayoutItems.isNotEmpty()) {
            curY += sectionLabelH + sectionGap
            for (item in activeLayoutItems) {
                item.bounds.set(panelX + padX, curY, panelX + panelW - padX, curY + itemH)
                curY += itemH + gap
            }
        }

        // Cheats button
        curY += sectionLabelH + sectionGap
        val cheatsCount = gameActivity?.cheats?.size ?: 0
        cheatsMenuItem.label = if (cheatsCount > 0) "Cheats ($cheatsCount)" else "Cheats"
        cheatsMenuItem.bounds.set(panelX + padX, curY, panelX + panelW - padX, curY + itemH)
        curY += itemH + gap

        // Exit: full width
        curY += sectionLabelH + sectionGap
        exitMenuItem.bounds.set(panelX + padX, curY, panelX + panelW - padX, curY + itemH)
        curY += itemH + gap
    }

    private val cheatsMenuItem = MenuItem("cheats_open", "Cheats")

    private fun getActiveMenuItems(): List<MenuItem> {
        val base = speedItems + scaleItems + saveStateItems + loadStateItems
        val activeLayoutItems = if (is3DS) layout3dsItems else layoutItems
        val hasDualScreen = isNDS || is3DS
        val withLayout = if (hasDualScreen) base + activeLayoutItems else base
        return withLayout + cheatsMenuItem + exitMenuItem
    }

    private fun setCircle(btn: VButton, cx: Float, cy: Float, r: Float) {
        btn.bounds.set(cx - r, cy - r, cx + r, cy + r)
    }

    // === Drawing ===

    override fun onDraw(canvas: Canvas) {
        // When physical gamepad connected → hide virtual controls, show only ⚙ menu
        if (!gamepadConnected) {
            if (is3DS) {
                drawJoystick(canvas, circlePad, "Circle")
                drawJoystick(canvas, cStick, "C")
                drawGameButton(canvas, zlButton)
                drawGameButton(canvas, zrButton)
                for (btn in gameButtons) drawGameButton(canvas, btn)
            } else if (isGBA) {
                // GBA: only draw D-pad, A, B, L, R, Start, Select (skip X/Y)
                for (btn in gameButtons) {
                    if (btn.id == "x" || btn.id == "y") continue
                    drawGameButton(canvas, btn)
                }
            } else {
                for (btn in gameButtons) drawGameButton(canvas, btn)
            }
        }
        // Always draw ⚙ menu button
        drawGearButton(canvas)

        if (menuOpen) {
            canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), menuDimPaint)
            drawMenuPanel(canvas)
        }
    }

    private fun drawJoystick(canvas: Canvas, js: VJoystick, label: String) {
        // Outer ring
        canvas.drawCircle(js.cx, js.cy, js.outerR, btnFillPaint)
        canvas.drawCircle(js.cx, js.cy, js.outerR, btnStrokePaint)
        // Label
        val saved = textPaint.textSize
        textPaint.textSize = js.thumbR * 0.5f
        val labelPaint = Paint(textPaint).apply { color = Color.argb(50, 255, 255, 255) }
        canvas.drawText(label, js.cx, js.cy + js.outerR - js.thumbR * 0.5f, labelPaint)
        textPaint.textSize = saved
        // Thumb at current position
        val tx = js.cx + js.nx * (js.outerR - js.thumbR)
        val ty = js.cy + js.ny * (js.outerR - js.thumbR)
        val fill = if (js.pointerId >= 0) btnPressedPaint else btnFillPaint
        canvas.drawCircle(tx, ty, js.thumbR, fill)
        canvas.drawCircle(tx, ty, js.thumbR, btnStrokePaint)
    }

    private fun drawGameButton(canvas: Canvas, btn: VButton) {
        val fill = if (btn.isPressed) btnPressedPaint else btnFillPaint
        val isCircle = btn.label.length <= 1 || btn.label in listOf("▲", "▼", "◀", "▶")
        if (isCircle) {
            val cx = btn.bounds.centerX(); val cy = btn.bounds.centerY()
            val r = btn.bounds.width() * 0.5f
            canvas.drawCircle(cx, cy, r, fill)
            canvas.drawCircle(cx, cy, r, btnStrokePaint)
            canvas.drawText(btn.label, cx, cy + textPaint.textSize * 0.35f, textPaint)
        } else {
            val cr = btn.bounds.height() * 0.4f
            canvas.drawRoundRect(btn.bounds, cr, cr, fill)
            canvas.drawRoundRect(btn.bounds, cr, cr, btnStrokePaint)
            val s = textPaint.textSize * 0.75f; val saved = textPaint.textSize
            textPaint.textSize = s
            canvas.drawText(btn.label, btn.bounds.centerX(), btn.bounds.centerY() + s * 0.35f, textPaint)
            textPaint.textSize = saved
        }
    }

    private fun drawGearButton(canvas: Canvas) {
        val fill = if (menuButton.isPressed) btnPressedPaint else btnFillPaint
        val cr = menuButton.bounds.height() * 0.35f
        canvas.drawRoundRect(menuButton.bounds, cr, cr, fill)
        canvas.drawRoundRect(menuButton.bounds, cr, cr, btnStrokePaint)
        val s = menuButton.bounds.height() * 0.45f; val saved = textPaint.textSize
        textPaint.textSize = s
        canvas.drawText("⚙", menuButton.bounds.centerX(), menuButton.bounds.centerY() + s * 0.3f, textPaint)
        textPaint.textSize = saved
    }

    private fun drawMenuPanel(canvas: Canvas) {
        val cr = 16f
        canvas.drawRoundRect(menuPanelRect, cr, cr, menuBgPaint)
        canvas.drawRoundRect(menuPanelRect, cr, cr, menuBorderPaint)

        val titleSize = menuPanelRect.width() * 0.055f
        val labelSize = titleSize * 0.55f
        val itemTextSize = titleSize * 0.65f
        val padX = menuPanelRect.left + menuPanelRect.width() * 0.05f

        menuTextPaint.textSize = titleSize; menuTextPaint.isFakeBoldText = true
        canvas.drawText("Cài đặt", menuPanelRect.centerX(), menuPanelRect.top + titleSize * 1.3f, menuTextPaint)
        menuTextPaint.isFakeBoldText = false; menuTextPaint.textSize = itemTextSize
        menuLabelPaint.textSize = labelSize

        // Speed
        canvas.drawText("Tốc độ", padX, speedItems[0].bounds.top - labelSize * 0.3f, menuLabelPaint)
        for (item in speedItems) {
            val a = (item.id == "s1" && currentSpeed == 1) || (item.id == "s2" && currentSpeed == 2) || (item.id == "s4" && currentSpeed == 4)
            drawMenuItem(canvas, item, a)
        }

        // Scale
        canvas.drawText("Kích cỡ nút", padX, scaleItems[0].bounds.top - labelSize * 0.3f, menuLabelPaint)
        for (item in scaleItems) drawMenuItem(canvas, item, false)

        // Save State
        canvas.drawText("Lưu nhanh", padX, saveStateItems[0].bounds.top - labelSize * 0.3f, menuLabelPaint)
        for ((i, item) in saveStateItems.withIndex()) {
            val hasData = gameActivity?.hasState(i) ?: false
            drawMenuItem(canvas, item, hasData)
        }

        // Load State
        canvas.drawText("Tải nhanh", padX, loadStateItems[0].bounds.top - labelSize * 0.3f, menuLabelPaint)
        for ((i, item) in loadStateItems.withIndex()) {
            val hasData = gameActivity?.hasState(i) ?: false
            drawMenuItem(canvas, item, hasData)
        }

        // Layout (NDS or 3DS)
        val hasDualScreen = isNDS || is3DS
        val activeLayoutItems = if (is3DS) layout3dsItems else layoutItems
        if (hasDualScreen && activeLayoutItems.isNotEmpty()) {
            canvas.drawText("Bố cục màn hình", padX, activeLayoutItems[0].bounds.top - labelSize * 0.3f, menuLabelPaint)
            for ((i, item) in activeLayoutItems.withIndex())
                drawMenuItem(canvas, item, gameActivity?.currentLayoutIndex == i)
        }

        // Cheats button
        canvas.drawText("Cheats", padX, cheatsMenuItem.bounds.top - labelSize * 0.3f, menuLabelPaint)
        val cheatsCount = gameActivity?.cheats?.size ?: 0
        drawMenuItem(canvas, cheatsMenuItem, cheatsCount > 0)

        // Exit
        drawMenuItem(canvas, exitMenuItem, false)

        // Hint
        menuHintPaint.textSize = labelSize
        canvas.drawText("Chạm ngoài để đóng", menuPanelRect.centerX(), menuPanelRect.bottom - labelSize * 0.3f, menuHintPaint)
    }

    private fun drawMenuItem(canvas: Canvas, item: MenuItem, active: Boolean) {
        val cr = item.bounds.height() * 0.25f
        canvas.drawRoundRect(item.bounds, cr, cr, if (active) menuActivePaint else menuItemPaint)
        canvas.drawRoundRect(item.bounds, cr, cr, menuBorderPaint)
        canvas.drawText(item.label, item.bounds.centerX(), item.bounds.centerY() + menuTextPaint.textSize * 0.35f, menuTextPaint)
    }

    // === Touch ===

    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (menuOpen) return handleMenuTouch(event)

        // When gamepad connected: only handle menu button + forward screen touch
        if (gamepadConnected) {
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    val x = event.x; val y = event.y
                    if (menuButton.bounds.contains(x, y)) { openMenu(); return true }
                    // Forward all touches to game screen (for touchscreen games)
                    forwardTouchToRetroView(MotionEvent.ACTION_DOWN, x, y)
                }
                MotionEvent.ACTION_MOVE -> {
                    forwardTouchToRetroView(MotionEvent.ACTION_MOVE, event.x, event.y)
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    forwardTouchToRetroView(MotionEvent.ACTION_UP, 0f, 0f)
                }
            }
            return true
        }

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val ai = event.actionIndex
                val x = event.getX(ai); val y = event.getY(ai)
                val pid = event.getPointerId(ai)
                if (menuButton.bounds.contains(x, y)) { openMenu(); return true }
                if (is3DS) {
                    if (tryJoystickGrab(circlePad, pid, x, y)) return true
                    if (tryJoystickGrab(cStick, pid, x, y)) return true
                }
                val allBtns = if (is3DS) gameButtons + listOf(zlButton, zrButton)
                              else if (isGBA) gameButtons.filter { it.id != "x" && it.id != "y" }
                              else gameButtons
                if (!allBtns.any { it.bounds.contains(x, y) }) {
                    // Touch on game screen → forward synthetic event to GLRetroView
                    screenPointers.add(pid)
                    forwardTouchToRetroView(MotionEvent.ACTION_DOWN, x, y)
                    return true
                }
                handlePress(pid, x, y)
            }
            MotionEvent.ACTION_POINTER_DOWN -> {
                val ai = event.actionIndex
                val x = event.getX(ai); val y = event.getY(ai)
                val pid = event.getPointerId(ai)
                if (is3DS) {
                    if (tryJoystickGrab(circlePad, pid, x, y)) return true
                    if (tryJoystickGrab(cStick, pid, x, y)) return true
                }
                val allBtns = if (is3DS) gameButtons + listOf(zlButton, zrButton)
                              else if (isGBA) gameButtons.filter { it.id != "x" && it.id != "y" }
                              else gameButtons
                if (!allBtns.any { it.bounds.contains(x, y) }) {
                    screenPointers.add(pid)
                    forwardTouchToRetroView(MotionEvent.ACTION_DOWN, x, y)
                    return true
                }
                handlePress(pid, x, y)
            }
            MotionEvent.ACTION_MOVE -> {
                // Forward screen pointer's coordinates to GLRetroView
                for (i in 0 until event.pointerCount) {
                    val pid = event.getPointerId(i)
                    val x = event.getX(i); val y = event.getY(i)
                    if (screenPointers.contains(pid)) {
                        forwardTouchToRetroView(MotionEvent.ACTION_MOVE, x, y)
                        continue
                    }
                    if (is3DS && updateJoystick(circlePad, pid, x, y)) continue
                    if (is3DS && updateJoystick(cStick, pid, x, y)) continue
                    handleMove(pid, x, y)
                }
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                val pid = event.getPointerId(event.actionIndex)
                if (screenPointers.remove(pid)) {
                    forwardTouchToRetroView(MotionEvent.ACTION_UP, 0f, 0f)
                } else if (is3DS && releaseJoystick(circlePad, pid)) { /* ok */ }
                else if (is3DS && releaseJoystick(cStick, pid)) { /* ok */ }
                else handleRelease(pid)
            }
            MotionEvent.ACTION_CANCEL -> {
                releaseAll(); releaseAllJoysticks()
                if (screenPointers.isNotEmpty()) {
                    forwardTouchToRetroView(MotionEvent.ACTION_UP, 0f, 0f)
                }
                screenPointers.clear()
            }
        }
        return true
    }

    /** Create a simple single-pointer MotionEvent and dispatch to GLRetroView.
     *  GLRetroView.onTouchEvent normalizes event.x/y to [-1,1] and calls LibretroDroid.onTouchEvent. */
    private fun forwardTouchToRetroView(action: Int, x: Float, y: Float) {
        val now = android.os.SystemClock.uptimeMillis()
        val me = MotionEvent.obtain(now, now, action, x, y, 0)
        retroView?.onTouchEvent(me)
        me.recycle()
    }

    // === Joystick helpers ===
    private fun tryJoystickGrab(js: VJoystick, pid: Int, x: Float, y: Float): Boolean {
        if (js.pointerId >= 0) return false
        val dx = x - js.cx; val dy = y - js.cy
        if (dx * dx + dy * dy > js.outerR * js.outerR) return false
        js.pointerId = pid
        updateJoystickValues(js, x, y)
        return true
    }
    private fun updateJoystick(js: VJoystick, pid: Int, x: Float, y: Float): Boolean {
        if (js.pointerId != pid) return false
        updateJoystickValues(js, x, y)
        return true
    }
    private fun updateJoystickValues(js: VJoystick, x: Float, y: Float) {
        val dx = x - js.cx; val dy = y - js.cy
        val maxD = js.outerR - js.thumbR
        js.nx = (dx / maxD).coerceIn(-1f, 1f)
        js.ny = (dy / maxD).coerceIn(-1f, 1f)
        retroView?.sendMotionEvent(js.motionSource, js.nx, js.ny, 0)
        invalidate()
    }
    private fun releaseJoystick(js: VJoystick, pid: Int): Boolean {
        if (js.pointerId != pid) return false
        js.pointerId = -1; js.nx = 0f; js.ny = 0f
        retroView?.sendMotionEvent(js.motionSource, 0f, 0f, 0)
        invalidate()
        return true
    }
    private fun releaseAllJoysticks() {
        listOf(circlePad, cStick).forEach { js ->
            if (js.pointerId >= 0) {
                js.pointerId = -1; js.nx = 0f; js.ny = 0f
                retroView?.sendMotionEvent(js.motionSource, 0f, 0f, 0)
            }
        }
    }

    private fun handleMenuTouch(event: MotionEvent): Boolean {
        if (event.actionMasked == MotionEvent.ACTION_DOWN) {
            val x = event.x; val y = event.y

            // Normal tap for all items
            for (item in getActiveMenuItems()) {
                if (item.bounds.contains(x, y)) { handleMenuAction(item.id); return true }
            }
            if (!menuPanelRect.contains(x, y)) closeMenu()
        }
        return true
    }

    private fun openMenu() {
        layoutMenuPanel(width.toFloat(), height.toFloat())
        menuOpen = true; releaseAll(); invalidate()
    }
    private fun closeMenu() { menuOpen = false; invalidate() }

    private fun handlePress(pid: Int, x: Float, y: Float) {
        val pressed = mutableSetOf<String>()
        val allBtns = if (is3DS) gameButtons + listOf(zlButton, zrButton) else gameButtons
        for (btn in allBtns) {
            if (btn.bounds.contains(x, y) && !btn.isPressed) {
                btn.isPressed = true; retroView?.sendKeyEvent(KeyEvent.ACTION_DOWN, btn.keyCode, 0); pressed.add(btn.id)
            }
        }
        pointerButtons[pid] = pressed; invalidate()
    }

    private fun handleMove(pid: Int, x: Float, y: Float) {
        val prev = pointerButtons[pid] ?: mutableSetOf()
        val now = mutableSetOf<String>()
        val allBtns = if (is3DS) gameButtons + listOf(zlButton, zrButton) else gameButtons
        for (btn in allBtns) { if (btn.bounds.contains(x, y)) now.add(btn.id) }
        for (id in now - prev) {
            val btn = allBtns.find { it.id == id } ?: continue
            if (!btn.isPressed) { btn.isPressed = true; retroView?.sendKeyEvent(KeyEvent.ACTION_DOWN, btn.keyCode, 0) }
        }
        for (id in prev - now) {
            val btn = allBtns.find { it.id == id } ?: continue
            if (!pointerButtons.any { (p, s) -> p != pid && id in s }) {
                btn.isPressed = false; retroView?.sendKeyEvent(KeyEvent.ACTION_UP, btn.keyCode, 0)
            }
        }
        pointerButtons[pid] = now; invalidate()
    }

    private fun handleRelease(pid: Int) {
        val pressed = pointerButtons.remove(pid) ?: return
        val allBtns = if (is3DS) gameButtons + listOf(zlButton, zrButton) else gameButtons
        for (id in pressed) {
            val btn = allBtns.find { it.id == id } ?: continue
            if (!pointerButtons.any { (_, s) -> id in s }) {
                btn.isPressed = false; retroView?.sendKeyEvent(KeyEvent.ACTION_UP, btn.keyCode, 0)
            }
        }
        invalidate()
    }

    private fun releaseAll() {
        for (btn in gameButtons) {
            if (btn.isPressed) { btn.isPressed = false; retroView?.sendKeyEvent(KeyEvent.ACTION_UP, btn.keyCode, 0) }
        }
        if (is3DS) {
            for (btn in listOf(zlButton, zrButton)) {
                if (btn.isPressed) { btn.isPressed = false; retroView?.sendKeyEvent(KeyEvent.ACTION_UP, btn.keyCode, 0) }
            }
        }
        pointerButtons.clear(); invalidate()
    }

    private fun handleMenuAction(id: String) {
        when (id) {
            "s1" -> setSpeed(1)
            "s2" -> setSpeed(2)
            "s4" -> setSpeed(4)
            "su" -> adjustScale(0.15f)
            "sd" -> adjustScale(-0.15f)
            "ss0" -> { gameActivity?.saveState(0); closeMenu() }
            "ss1" -> { gameActivity?.saveState(1); closeMenu() }
            "ss2" -> { gameActivity?.saveState(2); closeMenu() }
            "ls0" -> { gameActivity?.loadState(0); closeMenu() }
            "ls1" -> { gameActivity?.loadState(1); closeMenu() }
            "ls2" -> { gameActivity?.loadState(2); closeMenu() }
            "l0" -> setLayout(0); "l1" -> setLayout(1)
            "l2" -> setLayout(2); "l3" -> setLayout(3); "l4" -> setLayout(4)
            "cheats_open" -> { closeMenu(); showCheatsDialog() }
            "exit_game" -> { closeMenu(); gameActivity?.showExitConfirmDialog() }
        }
        invalidate()
    }

    private fun adjustScale(d: Float) {
        buttonScale = (buttonScale + d).coerceIn(0.5f, 1.8f)
        prefs.edit().putFloat("button_scale", buttonScale).apply()
        layoutButtons(width.toFloat(), height.toFloat())
    }

    private fun setSpeed(s: Int) {
        currentSpeed = s
        retroView?.frameSpeed = s
        prefs.edit().putInt("speed", s).apply()
    }

    private fun setLayout(i: Int) {
        gameActivity?.let { it.currentLayoutIndex = i; it.applyScreenLayout(i) }
        prefs.edit().putInt("layout", i).apply()
    }

    private fun showCheatsDialog() {
        val activity = gameActivity ?: return

        fun buildCheatListView(): android.widget.LinearLayout {
            val cheats = activity.cheats
            val listLayout = android.widget.LinearLayout(activity).apply {
                orientation = android.widget.LinearLayout.VERTICAL
                setPadding(32, 16, 32, 16)
            }

            if (cheats.isEmpty()) {
                val emptyText = android.widget.TextView(activity).apply {
                    text = "Chưa có cheat nào.\nẤn \"Thêm Cheat\" để bắt đầu."
                    setTextColor(Color.argb(150, 200, 200, 210))
                    textSize = 14f
                    setPadding(0, 32, 0, 32)
                    gravity = android.view.Gravity.CENTER
                }
                listLayout.addView(emptyText)
            }

            for ((i, cheat) in cheats.withIndex()) {
                val row = android.widget.LinearLayout(activity).apply {
                    orientation = android.widget.LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setPadding(8, 12, 8, 12)
                    setBackgroundColor(Color.argb(30, 255, 255, 255))
                    val params = android.widget.LinearLayout.LayoutParams(
                        android.widget.LinearLayout.LayoutParams.MATCH_PARENT,
                        android.widget.LinearLayout.LayoutParams.WRAP_CONTENT
                    )
                    params.bottomMargin = 8
                    layoutParams = params
                }

                // Toggle status indicator
                val statusText = android.widget.TextView(activity).apply {
                    text = if (cheat.enabled) "✓" else "✗"
                    setTextColor(if (cheat.enabled) Color.argb(255, 80, 200, 120) else Color.argb(255, 200, 80, 80))
                    textSize = 18f
                    setPadding(8, 0, 16, 0)
                }
                row.addView(statusText)

                // Name + code preview
                val infoLayout = android.widget.LinearLayout(activity).apply {
                    orientation = android.widget.LinearLayout.VERTICAL
                    layoutParams = android.widget.LinearLayout.LayoutParams(0, android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                val nameText = android.widget.TextView(activity).apply {
                    text = cheat.name
                    setTextColor(Color.WHITE)
                    textSize = 15f
                    isSingleLine = true
                }
                infoLayout.addView(nameText)
                val codePreview = android.widget.TextView(activity).apply {
                    text = cheat.code.replace("+", " ").take(30) + if (cheat.code.length > 30) "..." else ""
                    setTextColor(Color.argb(120, 180, 180, 200))
                    textSize = 11f
                    isSingleLine = true
                }
                infoLayout.addView(codePreview)
                row.addView(infoLayout)

                // "⋮" action button
                val actionBtn = android.widget.TextView(activity).apply {
                    text = "⋮"
                    setTextColor(Color.argb(200, 200, 200, 220))
                    textSize = 22f
                    setPadding(24, 0, 8, 0)
                    gravity = android.view.Gravity.CENTER
                }
                row.addView(actionBtn)

                // Tap row = toggle
                val cheatIndex = i
                row.setOnClickListener {
                    activity.toggleCheat(cheatIndex)
                    statusText.text = if (cheats[cheatIndex].enabled) "✓" else "✗"
                    statusText.setTextColor(
                        if (cheats[cheatIndex].enabled) Color.argb(255, 80, 200, 120)
                        else Color.argb(255, 200, 80, 80)
                    )
                }

                // Tap ⋮ = edit/delete menu
                actionBtn.setOnClickListener {
                    val items = arrayOf("Sửa", "Xóa")
                    androidx.appcompat.app.AlertDialog.Builder(activity)
                        .setTitle(cheat.name)
                        .setItems(items) { _, which ->
                            when (which) {
                                0 -> showCheatFormDialog(cheatIndex)
                                1 -> {
                                    activity.removeCheat(cheatIndex)
                                    // Reopen to refresh
                                    showCheatsDialog()
                                }
                            }
                        }
                        .setNegativeButton("Huỷ", null)
                        .show()
                }

                listLayout.addView(row)
            }

            return listLayout
        }

        val scrollView = android.widget.ScrollView(activity).apply {
            setPadding(0, 0, 0, 0)
            addView(buildCheatListView())
        }

        val dialog = androidx.appcompat.app.AlertDialog.Builder(activity)
            .setTitle("Cheats (${activity.cheats.size})")
            .setView(scrollView)
            .setPositiveButton("Thêm Cheat") { _, _ ->
                showCheatFormDialog(null)
            }
            .setNegativeButton("Đóng", null)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.background_dark)
        dialog.show()
    }

    /** @param editIndex null = thêm mới, non-null = sửa cheat tại index */
    private fun showCheatFormDialog(editIndex: Int?) {
        val activity = gameActivity ?: return
        val existing = if (editIndex != null) activity.cheats.getOrNull(editIndex) else null
        val isEdit = existing != null

        val layout = android.widget.LinearLayout(activity).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            setPadding(48, 24, 48, 8)
        }

        val nameInput = android.widget.EditText(activity).apply {
            hint = "Tên cheat (VD: Infinite Money)"
            if (isEdit) setText(existing!!.name)
            setSingleLine(true)
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        layout.addView(nameInput)

        val codeInput = android.widget.EditText(activity).apply {
            hint = "Code (VD: DEADBEEF 0000FFFF)"
            if (isEdit) setText(existing!!.code.replace("+", "\n"))
            minLines = 3
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
        }
        layout.addView(codeInput)

        val dialog = androidx.appcompat.app.AlertDialog.Builder(activity)
            .setTitle(if (isEdit) "Sửa Cheat" else "Thêm Cheat")
            .setView(layout)
            .setPositiveButton(if (isEdit) "Lưu" else "Thêm") { _, _ ->
                val name = nameInput.text.toString().trim()
                val code = codeInput.text.toString().trim()
                if (name.isNotEmpty() && code.isNotEmpty()) {
                    val formattedCode = code.lines().map { it.trim() }.filter { it.isNotEmpty() }.joinToString("+")
                    if (isEdit && existing != null) {
                        existing.name = name
                        existing.code = formattedCode
                        activity.saveCheats()
                        activity.applyCheats()
                    } else {
                        activity.addCheat(name, formattedCode)
                    }
                }
                // Reopen cheats list
                showCheatsDialog()
            }
            .setNegativeButton("Huỷ", null)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.background_dark)
        dialog.show()
    }
}
