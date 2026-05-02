C:\platform-tools>adb logcat --pid=4293
--------- beginning of system
05-02 08:28:30.030  4293  4293 V Configuration: Updating configuration, locales updated from [] to [vi_VN]
05-02 08:28:30.052  4293  4293 D ResourcesManagerExtImpl: applyConfigurationToAppResourcesLocked app.getDisplayId() return callback.displayId:-1
05-02 08:28:30.058  4293  4338 I DisplayManager: Choreographer implicitly registered for the refresh rate.
05-02 08:28:30.063  4293  4293 D ResourcesManagerExtImpl: applyConfigurationToAppResourcesLocked app.getDisplayId() return callback.displayId:0
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: init sDebug to false, init sDebugIme to false, init sAlwaysOn to false
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: updateDebugToClass InputMethodManager.DEBUG = false
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: updateDebugToClass ImeFocusController.DEBUG = false
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: updateDebugToClass OnBackInvokedDispatcher.DEBUG = false
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: updateDebugToClass InsetsController.DEBUG = false
05-02 08:28:30.079  4293  4293 D OplusInputMethodUtil: updateDebugToClass BaseInputConnection.DEBUG = false
05-02 08:28:30.128  4293  4293 D ActivityThread: ComponentInfo{com.retroarch.aarch64/com.retroarch.browser.retroactivity.RetroActivityFuture} checkFinished=false 2
05-02 08:28:30.128  4293  4293 D ResourcesManagerExtImpl: applyConfigurationToAppResourcesLocked app.getDisplayId() return callback.displayId:0
05-02 08:28:30.146  4293  4293 D InsetsController: Setting requestedVisibleTypes to -14 (was -9)
05-02 08:28:30.150  4293  4293 D ResourcesManagerExtImpl: applyConfigurationToAppResourcesLocked app.getDisplayId() return callback.displayId:0
05-02 08:28:30.161  4293  4293 D VRI[RetroActivityFuture]: relayoutWindow result, sizeChanged:true, surfaceControlChanged:true, transformHintChanged:false, mSurfaceSize:Point(1240, 2633), mLastSurfaceSize:Point(0, 0), mWidth:-1, mHeight:-1, requestedWidth:1240, requestedHeight:2633, transformHint:0, installOrientation:0, displayRotation:0, isSurfaceValid:true, attr.flag:25232768, tmpFrames:ClientWindowFrames{frame=[0,139][1240,2772] display=[0,139][1240,2772] parentFrame=[0,0][0,0]}, relayoutAsync:false, mSyncSeqId:0
05-02 08:28:30.161  4293  4293 W VRI[RetroActivityFuture]: updateBlastSurfaceIfNeeded, surfaceSize:Point(1240, 2633), lastSurfaceSize:Point(0, 0), format:-1, blastBufferQueue:null
05-02 08:28:30.216  4293  4293 W VRI[RetroActivityFuture]: handleResized, msg:, frameChanged:false, configChanged:false, displayChanged:false, attachedFrameChanged:false, compatScaleChanged:false, pendingDragResizing=false
05-02 08:28:30.256  4293  4293 W VRI[RetroActivityFuture]: handleResized, msg:, frameChanged:false, configChanged:false, displayChanged:false, attachedFrameChanged:false, compatScaleChanged:false, pendingDragResizing=false
05-02 08:28:30.564  4293  4293 D InsetsController: Setting requestedVisibleTypes to -16 (was -14)
05-02 08:28:30.574  4293  4293 D VRI[RetroActivityFuture]: relayoutWindow result, sizeChanged:false, surfaceControlChanged:false, transformHintChanged:false, mSurfaceSize:Point(1240, 2633), mLastSurfaceSize:Point(1240, 2633), mWidth:1240, mHeight:2633, requestedWidth:1240, requestedHeight:2633, transformHint:0, installOrientation:0, displayRotation:0, isSurfaceValid:true, attr.flag:25232768, tmpFrames:ClientWindowFrames{frame=[0,139][1240,2772] display=[0,139][1240,2772] parentFrame=[0,0][0,0]}, relayoutAsync:false, mSyncSeqId:0
05-02 08:28:30.574  4293  4293 W VRI[RetroActivityFuture]: updateBlastSurfaceIfNeeded, surfaceSize:Point(1240, 2633), lastSurfaceSize:Point(1240, 2633), format:-1, blastBufferQueue:android.graphics.BLASTBufferQueue@9217c27
05-02 08:28:30.575  4293  4293 W VRI[RetroActivityFuture]: handleResized abandoned!
05-02 08:28:52.185  4293  4293 W VRI[RetroActivityFuture]: handleResized abandoned!
--------- beginning of main
05-02 08:28:52.493  4293  4293 D InsetsController: setRequestedVisibleTypes, mRequestedVisibleTypes: systemGestures mandatorySystemGestures tappableElement displayCutout windowDecor systemOverlays, requestedVisibleTypes: navigationBars systemGestures mandatorySystemGestures tappableElement displayCutout windowDecor systemOverlays, visibleTypes: navigationBars, type: 2, call: android.view.InsetsController.controlAnimationUnchecked:1556 android.view.InsetsController.applyAnimation:2378 android.view.InsetsController.applyAnimation:2344 android.view.InsetsController.show:1360 android.view.InsetsController.show:1264 android.view.ViewRootImpl.controlInsetsForCompatibility:3854 android.view.ViewRootImpl.performTraversals:4420 android.view.ViewRootImpl.doTraversal:3593 android.view.ViewRootImpl$TraversalRunnable.run:12031 android.view.Choreographer$CallbackRecord.run:1852
05-02 08:28:52.493  4293  4293 D InsetsController: Setting requestedVisibleTypes to -14 (was -16)
05-02 08:28:52.494  4293  4293 D ViewRootImplExtImpl: wrapConfigInfoIntoFlags rotation=0, smallestScreenWidthDp=354, residentWS=false, scenario=0, bounds=Rect(0, 0 - 1240, 2772), relayoutAsync=false, flags=0, newFlags=1453337664, title=com.retroarch.aarch64/com.retroarch.browser.retroactivity.RetroActivityFuture
05-02 08:28:52.497  4293  4293 D VRI[RetroActivityFuture]: relayoutWindow result, sizeChanged:false, surfaceControlChanged:false, transformHintChanged:false, mSurfaceSize:Point(1240, 2633), mLastSurfaceSize:Point(1240, 2633), mWidth:1240, mHeight:2633, requestedWidth:1240, requestedHeight:2633, transformHint:0, installOrientation:0, displayRotation:0, isSurfaceValid:true, attr.flag:25232768, tmpFrames:ClientWindowFrames{frame=[0,139][1240,2772] display=[0,139][1240,2772] parentFrame=[0,0][0,0]}, relayoutAsync:false, mSyncSeqId:0
05-02 08:28:52.497  4293  4293 W VRI[RetroActivityFuture]: updateBlastSurfaceIfNeeded, surfaceSize:Point(1240, 2633), lastSurfaceSize:Point(1240, 2633), format:-1, blastBufferQueue:android.graphics.BLASTBufferQueue@9217c27
05-02 08:28:53.191  4293  4330 D OplusScrollToTopManager: com.retroarch.aarch64/com.retroarch.browser.retroactivity.RetroActivityFuture,This com.android.internal.policy.DecorView{d4180e5 V.E...... R.....ID 0,0-1240,2633 aid=0 alpha=1.0 viewInfo = }[RetroActivityFuture] change focus to false
