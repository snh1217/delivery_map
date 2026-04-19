package com.snh.deliverymap.extractor;

import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityManager;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.snh.deliverymap.extractor.accessibility.QuickAddressAccessibilityService;

import java.util.List;

@CapacitorPlugin(name = "ExtractorBridge")
public class ExtractorBridgePlugin extends Plugin {
    private boolean isAccessibilityEnabled() {
        AccessibilityManager manager = (AccessibilityManager) getContext().getSystemService(android.content.Context.ACCESSIBILITY_SERVICE);
        if (manager == null) {
            return false;
        }
        List<android.accessibilityservice.AccessibilityServiceInfo> enabledServices = manager.getEnabledAccessibilityServiceList(android.accessibilityservice.AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
        ComponentName target = new ComponentName(getContext(), QuickAddressAccessibilityService.class);
        for (android.accessibilityservice.AccessibilityServiceInfo info : enabledServices) {
            if (info.getResolveInfo() != null && info.getResolveInfo().serviceInfo != null) {
                String enabledName = new ComponentName(
                    info.getResolveInfo().serviceInfo.packageName,
                    info.getResolveInfo().serviceInfo.name
                ).flattenToString();
                if (target.flattenToString().equals(enabledName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private JSObject buildStatus() {
        JSObject result = new JSObject();
        result.put("overlayPermission", Settings.canDrawOverlays(getContext()));
        result.put("overlayRunning", ExtractorStateStore.isOverlayRunning(getContext()));
        result.put("hasPendingCapture", ExtractorStateStore.hasPendingCapture(getContext()));
        result.put("hasPendingAccessibilityTransfer", ExtractorStateStore.hasPendingAccessibilityTransfer(getContext()));
        result.put("overlaySizeDp", ExtractorStateStore.getOverlaySizeDp(getContext()));
        result.put("overlayOpacity", ExtractorStateStore.getOverlayOpacity(getContext()));
        result.put("overlayLocked", ExtractorStateStore.isOverlayLocked(getContext()));
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("notificationsEnabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        result.put("accessibilityEnabled", isAccessibilityEnabled());
        return result;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
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

    @PluginMethod
    public void consumePendingAccessibilityTransfer(PluginCall call) {
        ExtractorStateStore.PendingAccessibilityTransfer transfer = ExtractorStateStore.consumePendingAccessibilityTransfer(getContext());
        JSObject result = new JSObject();
        result.put("address", transfer.address);
        result.put("rawText", transfer.rawText);
        result.put("providerHint", transfer.providerHint);
        result.put("transferType", "accessibility");
        result.put("sourcePackage", transfer.sourcePackage);
        if (transfer.detectedAt != null) {
            result.put("detectedAt", transfer.detectedAt);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void updateOverlayConfig(PluginCall call) {
        int sizeDp = Math.max(44, Math.min(96, call.getInt("sizeDp", ExtractorStateStore.getOverlaySizeDp(getContext()))));
        double opacityRaw = call.getDouble("opacity", (double) ExtractorStateStore.getOverlayOpacity(getContext()));
        float opacity = (float) Math.max(0.45d, Math.min(1.0d, opacityRaw));
        boolean locked = call.getBoolean("locked", ExtractorStateStore.isOverlayLocked(getContext()));

        ExtractorStateStore.saveOverlaySizeDp(getContext(), sizeDp);
        ExtractorStateStore.saveOverlayOpacity(getContext(), opacity);
        ExtractorStateStore.setOverlayLocked(getContext(), locked);
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openAppNotificationSettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }
}
