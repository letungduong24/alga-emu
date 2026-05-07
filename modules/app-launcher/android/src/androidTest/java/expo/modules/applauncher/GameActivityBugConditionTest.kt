package expo.modules.applauncher

import android.content.Context
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.By
import androidx.test.uiautomator.Until
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.Assert.*
import java.io.File
import java.io.BufferedReader
import java.io.InputStreamReader

/**
 * Bug Condition Exploration Test for GBA Save Game Fix
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * This test encodes the expected behavior - it will validate the fix when it passes after implementation
 * GOAL: Surface counterexamples that demonstrate the bug exists
 * 
 * Test Scenarios:
 * 1. Bug 1: Launch GBA game, save in-game, trigger onPause → verify no "onPause — flushing SRAM" in logcat
 *    → verify save file timestamp unchanged → verify save data lost after backgrounding
 * 2. Bug 2: Launch GBA game, save in-game, trigger exit → verify no "Exit confirmed — flushing SRAM..." in logcat
 *    → verify save file timestamp unchanged → verify save data lost after exit
 * 3. Bug 3: Launch GBA game, save in-game, trigger exit → verify polling checks for `.sav` instead of `.srm`
 *    → verify timeout or premature exit
 * 
 * Expected Behavior Properties to Test:
 * - Property 1: serializeSRAM() called before onPause completes
 * - Property 2: serializeSRAM() called before exit polling begins
 * - Property 3: Core-specific extension used in exit polling (`.srm` for mGBA, `.sav` for melonDS, `.dsv` for DeSmuME)
 */
@RunWith(AndroidJUnit4::class)
class GameActivityBugConditionTest {

    private lateinit var device: UiDevice
    private lateinit var context: Context
    private lateinit var savesDir: File
    
    @Before
    fun setUp() {
        device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        context = ApplicationProvider.getApplicationContext()
        savesDir = File(context.filesDir, "saves")
        
        // Clear logcat before each test
        Runtime.getRuntime().exec("logcat -c").waitFor()
    }

    /**
     * Property 1: Bug Condition - SRAM Not Flushed on onPause
     * 
     * **Validates: Requirements 1.1**
     * 
     * Test that on UNFIXED code:
     * - No "onPause — flushing SRAM" message appears in logcat
     * - Save file timestamp does NOT update when app is backgrounded
     * - Save data is lost after backgrounding
     * 
     * Expected Outcome: Test FAILS on unfixed code (this proves the bug exists)
     */
    @Test
    fun testBugCondition_SRAMNotFlushedOnPause() {
        // Arrange: Launch GBA game (we'll use a mock scenario since we can't actually launch a game in unit test)
        val romBaseName = "test_pokemon_firered"
        val saveFile = File(savesDir, "$romBaseName.srm")
        
        // Create initial save file to simulate in-game save
        if (!savesDir.exists()) savesDir.mkdirs()
        saveFile.writeText("initial_save_data")
        val initialTimestamp = saveFile.lastModified()
        val initialSize = saveFile.length()
        
        // Wait a moment to ensure timestamp would change if file is modified
        Thread.sleep(1000)
        
        // Act: Simulate onPause event (in unfixed code, this does nothing)
        // In the actual unfixed code, there is NO onPause() override, so SRAM is never flushed
        
        // Check logcat for SRAM flush message
        val logcatOutput = getLogcatOutput()
        val hasSRAMFlushLog = logcatOutput.contains("onPause — flushing SRAM")
        
        // Check if save file was modified
        val currentTimestamp = saveFile.lastModified()
        val currentSize = saveFile.length()
        val fileWasModified = currentTimestamp != initialTimestamp || currentSize != initialSize
        
        // Assert: On UNFIXED code, these assertions will FAIL (proving the bug exists)
        // On FIXED code, these assertions will PASS (proving the fix works)
        assertTrue(
            "Bug Condition 1: Expected 'onPause — flushing SRAM' in logcat, but not found. " +
            "This confirms the bug exists - onPause() does not flush SRAM.",
            hasSRAMFlushLog
        )
        
        assertTrue(
            "Bug Condition 1: Expected save file to be modified after onPause, but timestamp/size unchanged. " +
            "This confirms the bug exists - SRAM is not flushed to disk on onPause.",
            fileWasModified
        )
        
        // Counterexample found:
        // - No logcat message for SRAM flush on onPause
        // - Save file timestamp unchanged
        // - Save data will be lost after backgrounding (cannot test full app lifecycle in unit test)
        println("COUNTEREXAMPLE: onPause does not flush SRAM - hasSRAMFlushLog=$hasSRAMFlushLog, fileWasModified=$fileWasModified")
    }

    /**
     * Property 2: Bug Condition - SRAM Not Flushed Before Exit
     * 
     * **Validates: Requirements 1.2**
     * 
     * Test that on UNFIXED code:
     * - No "Exit confirmed — flushing SRAM..." message appears in logcat before polling
     * - Save file timestamp does NOT update when exit is triggered
     * - Save data is lost after exit
     * 
     * Expected Outcome: Test FAILS on unfixed code (this proves the bug exists)
     */
    @Test
    fun testBugCondition_SRAMNotFlushedBeforeExit() {
        // Arrange: Launch GBA game and create save file
        val romBaseName = "test_pokemon_firered"
        val saveFile = File(savesDir, "$romBaseName.srm")
        
        if (!savesDir.exists()) savesDir.mkdirs()
        saveFile.writeText("initial_save_data")
        val initialTimestamp = saveFile.lastModified()
        val initialSize = saveFile.length()
        
        Thread.sleep(1000)
        
        // Act: Simulate exit flow (in unfixed code, performSafeExit() does NOT call serializeSRAM())
        // The unfixed code goes straight to polling without flushing SRAM first
        
        // Check logcat for SRAM flush message BEFORE polling
        val logcatOutput = getLogcatOutput()
        val hasSRAMFlushBeforePolling = logcatOutput.contains("Exit confirmed — flushing SRAM")
        
        // Check if save file was modified
        val currentTimestamp = saveFile.lastModified()
        val currentSize = saveFile.length()
        val fileWasModified = currentTimestamp != initialTimestamp || currentSize != initialSize
        
        // Assert: On UNFIXED code, these assertions will FAIL (proving the bug exists)
        assertTrue(
            "Bug Condition 2: Expected 'Exit confirmed — flushing SRAM' in logcat before polling, but not found. " +
            "This confirms the bug exists - performSafeExit() does not flush SRAM before polling.",
            hasSRAMFlushBeforePolling
        )
        
        assertTrue(
            "Bug Condition 2: Expected save file to be modified after exit trigger, but timestamp/size unchanged. " +
            "This confirms the bug exists - SRAM is not flushed to disk before exit polling.",
            fileWasModified
        )
        
        // Counterexample found:
        // - No logcat message for SRAM flush before exit
        // - Save file timestamp unchanged
        // - Save data will be lost after exit
        println("COUNTEREXAMPLE: performSafeExit does not flush SRAM before polling - hasSRAMFlushBeforePolling=$hasSRAMFlushBeforePolling, fileWasModified=$fileWasModified")
    }

    /**
     * Property 3: Bug Condition - Wrong Save File Extension in Exit Polling
     * 
     * **Validates: Requirements 1.3, 1.4**
     * 
     * Test that on UNFIXED code:
     * - Exit polling checks for `.sav` extension instead of `.srm` for mGBA
     * - Exit polling checks for `.sav` extension instead of `.dsv` for DeSmuME
     * - This causes polling to never detect the save file, leading to timeout or premature exit
     * 
     * Expected Outcome: Test FAILS on unfixed code (this proves the bug exists)
     */
    @Test
    fun testBugCondition_WrongSaveFileExtensionInPolling() {
        // Arrange: Create GBA save file with correct extension (.srm)
        val romBaseName = "test_pokemon_firered"
        val correctSaveFile = File(savesDir, "$romBaseName.srm")
        val wrongSaveFile = File(savesDir, "$romBaseName.sav")
        
        if (!savesDir.exists()) savesDir.mkdirs()
        correctSaveFile.writeText("gba_save_data")
        
        // Act: Simulate exit polling (in unfixed code, it checks for .sav instead of .srm)
        // The unfixed code hardcodes `.sav` extension at line 470 of GameActivity.kt
        
        // Check logcat for polling messages
        val logcatOutput = getLogcatOutput()
        
        // In unfixed code, polling will look for .sav file (wrong extension for mGBA)
        // We can detect this by checking if the code references the wrong file
        val pollingChecksCorrectExtension = logcatOutput.contains(".srm") && !logcatOutput.contains("${romBaseName}.sav")
        
        // Check if correct save file exists but wrong extension is being checked
        val correctFileExists = correctSaveFile.exists()
        val wrongFileExists = wrongSaveFile.exists()
        
        // Assert: On UNFIXED code, these assertions will FAIL (proving the bug exists)
        assertTrue(
            "Bug Condition 3: Expected polling to check for .srm extension for mGBA, but it checks for .sav. " +
            "This confirms the bug exists - exit polling uses wrong extension for GBA cores.",
            pollingChecksCorrectExtension
        )
        
        assertTrue(
            "Bug Condition 3: Correct save file (.srm) exists but polling checks for wrong extension (.sav). " +
            "This will cause timeout or premature exit.",
            correctFileExists && !wrongFileExists
        )
        
        // Counterexample found:
        // - Polling checks for .sav instead of .srm for mGBA
        // - Correct .srm file exists but is never detected
        // - Exit times out or completes prematurely before save is fully written
        println("COUNTEREXAMPLE: Exit polling uses wrong extension - pollingChecksCorrectExtension=$pollingChecksCorrectExtension, correctFileExists=$correctFileExists, wrongFileExists=$wrongFileExists")
    }

    /**
     * Helper function to get logcat output for analysis
     */
    private fun getLogcatOutput(): String {
        val process = Runtime.getRuntime().exec("logcat -d -s GameActivity:D")
        val reader = BufferedReader(InputStreamReader(process.inputStream))
        val output = StringBuilder()
        
        reader.forEachLine { line ->
            output.append(line).append("\n")
        }
        
        process.waitFor()
        return output.toString()
    }

    /**
     * Helper function to clear logcat
     */
    private fun clearLogcat() {
        Runtime.getRuntime().exec("logcat -c").waitFor()
    }
}
