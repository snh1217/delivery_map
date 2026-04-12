package com.snh.deliverymap.extractor;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExtractorBridge")
public class ExtractorBridgePlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("overlayPermission", Settings.canDrawOverlays(getContext()));
        result.put("overlayRunning", ExtractorStateStore.isOverlayRunning(getContext()));
        result.put("hasPendingCapture", ExtractorStateStore.hasPendingCapture(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Settings.canDrawOverlays(getContext())) {
            call.resolve();
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void startOverlayBubble(PluginCall call) {
        if (!Settings.canDrawOverlays(getContext())) {
            call.reject("OVERLAY_PERMISSION_REQUIRED");
            return;
        }
        Intent intent = new Intent(getContext(), OverlayBubbleService.class);
        intent.setAction(OverlayBubbleService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopOverlayBubble(PluginCall call) {
        Intent intent = new Intent(getContext(), OverlayBubbleService.class);
        intent.setAction(OverlayBubbleService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void captureCurrentScreen(PluginCall call) {
        Intent intent = new Intent(getContext(), ScreenCaptureActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void consumeLastCapture(PluginCall call) {
        String dataUrl = ExtractorStateStore.consumeCaptureDataUrl(getContext());
        JSObject result = new JSObject();
        result.put("dataUrl", dataUrl);
        call.resolve(result);
    }
}