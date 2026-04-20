package com.snh.deliverymap.extractor;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class ExtractorStateStore {
    private static final String PREFS = "extractor_bridge";
    private static final String KEY_OVERLAY_RUNNING = "overlay_running";
    private static final String KEY_LAST_CAPTURE = "last_capture_path";
    private static final String KEY_OVERLAY_X = "overlay_x";
    private static final String KEY_OVERLAY_Y = "overlay_y";
    private static final String KEY_OVERLAY_SIZE_DP = "overlay_size_dp";
    private static final String KEY_OVERLAY_OPACITY = "overlay_opacity";
    private static final String KEY_OVERLAY_LOCKED = "overlay_locked";
    private static final String KEY_PENDING_ACCESSIBILITY_ADDRESS = "pending_accessibility_address";
    private static final String KEY_PENDING_ACCESSIBILITY_RAW_TEXT = "pending_accessibility_raw_text";
    private static final String KEY_PENDING_ACCESSIBILITY_PROVIDER = "pending_accessibility_provider";
    private static final String KEY_PENDING_ACCESSIBILITY_SOURCE_PACKAGE = "pending_accessibility_source_package";
    private static final String KEY_PENDING_ACCESSIBILITY_DETECTED_AT = "pending_accessibility_detected_at";
    private static final String KEY_LAST_ACCESSIBILITY_ADDRESS = "last_accessibility_address";
    private static final String KEY_LAST_ACCESSIBILITY_DISPATCH_AT = "last_accessibility_dispatch_at";
    private static final String KEY_LAST_OBSERVED_ACCESSIBILITY_PACKAGE = "last_observed_accessibility_package";
    private static final String KEY_CUSTOM_ACCESSIBILITY_TARGET_PACKAGES = "custom_accessibility_target_packages";
    private static final int DEFAULT_OVERLAY_SIZE_DP = 64;
    private static final float DEFAULT_OVERLAY_OPACITY = 0.94f;

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    public static void setOverlayRunning(Context context, boolean running) {
        prefs(context).edit().putBoolean(KEY_OVERLAY_RUNNING, running).apply();
    }

    public static boolean isOverlayRunning(Context context) {
        return prefs(context).getBoolean(KEY_OVERLAY_RUNNING, false);
    }

    public static void saveOverlayPosition(Context context, int x, int y) {
        prefs(context).edit().putInt(KEY_OVERLAY_X, x).putInt(KEY_OVERLAY_Y, y).apply();
    }

    public static int getOverlayX(Context context, int fallback) {
        return prefs(context).getInt(KEY_OVERLAY_X, fallback);
    }

    public static int getOverlayY(Context context, int fallback) {
        return prefs(context).getInt(KEY_OVERLAY_Y, fallback);
    }

    public static void saveOverlaySizeDp(Context context, int sizeDp) {
        prefs(context).edit().putInt(KEY_OVERLAY_SIZE_DP, sizeDp).apply();
    }

    public static int getOverlaySizeDp(Context context) {
        return prefs(context).getInt(KEY_OVERLAY_SIZE_DP, DEFAULT_OVERLAY_SIZE_DP);
    }

    public static void saveOverlayOpacity(Context context, float opacity) {
        prefs(context).edit().putFloat(KEY_OVERLAY_OPACITY, opacity).apply();
    }

    public static float getOverlayOpacity(Context context) {
        return prefs(context).getFloat(KEY_OVERLAY_OPACITY, DEFAULT_OVERLAY_OPACITY);
    }

    public static void setOverlayLocked(Context context, boolean locked) {
        prefs(context).edit().putBoolean(KEY_OVERLAY_LOCKED, locked).apply();
    }

    public static boolean isOverlayLocked(Context context) {
        return prefs(context).getBoolean(KEY_OVERLAY_LOCKED, false);
    }

    public static File getCaptureFile(Context context) {
        return new File(context.getCacheDir(), "extractor-last-capture.png");
    }

    public static void saveCaptureBitmap(Context context, Bitmap bitmap) throws IOException {
        File file = getCaptureFile(context);
        try (FileOutputStream outputStream = new FileOutputStream(file)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
            outputStream.flush();
        }
        prefs(context).edit().putString(KEY_LAST_CAPTURE, file.getAbsolutePath()).apply();
    }

    public static boolean hasPendingCapture(Context context) {
        String path = prefs(context).getString(KEY_LAST_CAPTURE, null);
        return path != null && new File(path).exists();
    }

    public static String consumeCaptureDataUrl(Context context) {
        String path = prefs(context).getString(KEY_LAST_CAPTURE, null);
        if (path == null) {
            return null;
        }
        File file = new File(path);
        if (!file.exists()) {
            prefs(context).edit().remove(KEY_LAST_CAPTURE).apply();
            return null;
        }
        Bitmap bitmap = BitmapFactory.decodeFile(file.getAbsolutePath());
        if (bitmap == null) {
            file.delete();
            prefs(context).edit().remove(KEY_LAST_CAPTURE).apply();
            return null;
        }
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, outputStream);
        String base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP);
        bitmap.recycle();
        file.delete();
        prefs(context).edit().remove(KEY_LAST_CAPTURE).apply();
        return "data:image/png;base64," + base64;
    }

    public static void savePendingAccessibilityTransfer(
        Context context,
        String address,
        String rawText,
        String providerHint,
        String sourcePackage,
        long detectedAt
    ) {
        prefs(context)
            .edit()
            .putString(KEY_PENDING_ACCESSIBILITY_ADDRESS, address)
            .putString(KEY_PENDING_ACCESSIBILITY_RAW_TEXT, rawText)
            .putString(KEY_PENDING_ACCESSIBILITY_PROVIDER, providerHint)
            .putString(KEY_PENDING_ACCESSIBILITY_SOURCE_PACKAGE, sourcePackage)
            .putLong(KEY_PENDING_ACCESSIBILITY_DETECTED_AT, detectedAt)
            .putString(KEY_LAST_ACCESSIBILITY_ADDRESS, address)
            .putLong(KEY_LAST_ACCESSIBILITY_DISPATCH_AT, detectedAt)
            .apply();
    }

    public static boolean hasPendingAccessibilityTransfer(Context context) {
        String address = prefs(context).getString(KEY_PENDING_ACCESSIBILITY_ADDRESS, null);
        return address != null && !address.trim().isEmpty();
    }

    public static PendingAccessibilityTransfer consumePendingAccessibilityTransfer(Context context) {
        SharedPreferences preferences = prefs(context);
        PendingAccessibilityTransfer transfer = new PendingAccessibilityTransfer(
            preferences.getString(KEY_PENDING_ACCESSIBILITY_ADDRESS, null),
            preferences.getString(KEY_PENDING_ACCESSIBILITY_RAW_TEXT, null),
            preferences.getString(KEY_PENDING_ACCESSIBILITY_PROVIDER, null),
            preferences.getString(KEY_PENDING_ACCESSIBILITY_SOURCE_PACKAGE, null),
            preferences.contains(KEY_PENDING_ACCESSIBILITY_DETECTED_AT)
                ? preferences.getLong(KEY_PENDING_ACCESSIBILITY_DETECTED_AT, 0L)
                : null
        );

        preferences.edit()
            .remove(KEY_PENDING_ACCESSIBILITY_ADDRESS)
            .remove(KEY_PENDING_ACCESSIBILITY_RAW_TEXT)
            .remove(KEY_PENDING_ACCESSIBILITY_PROVIDER)
            .remove(KEY_PENDING_ACCESSIBILITY_SOURCE_PACKAGE)
            .remove(KEY_PENDING_ACCESSIBILITY_DETECTED_AT)
            .apply();
        return transfer;
    }

    public static boolean shouldSuppressAccessibilityDispatch(Context context, String address, long detectedAt, long windowMs) {
        SharedPreferences preferences = prefs(context);
        String lastAddress = preferences.getString(KEY_LAST_ACCESSIBILITY_ADDRESS, null);
        long lastAt = preferences.getLong(KEY_LAST_ACCESSIBILITY_DISPATCH_AT, 0L);
        if (lastAddress == null || address == null) {
            return false;
        }
        return lastAddress.equals(address) && detectedAt - lastAt < windowMs;
    }

    public static String getLastObservedAccessibilityPackage(Context context) {
        return prefs(context).getString(KEY_LAST_OBSERVED_ACCESSIBILITY_PACKAGE, null);
    }

    public static List<String> getCustomAccessibilityTargetPackages(Context context) {
        return new ArrayList<>(parsePackageSet(prefs(context).getString(KEY_CUSTOM_ACCESSIBILITY_TARGET_PACKAGES, "")));
    }

    public static void addAccessibilityTargetPackage(Context context, String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) {
            return;
        }
        Set<String> packages = parsePackageSet(prefs(context).getString(KEY_CUSTOM_ACCESSIBILITY_TARGET_PACKAGES, ""));
        packages.add(packageName.trim());
        savePackageSet(context, packages);
    }

    public static void removeAccessibilityTargetPackage(Context context, String packageName) {
        if (packageName == null || packageName.trim().isEmpty()) {
            return;
        }
        Set<String> packages = parsePackageSet(prefs(context).getString(KEY_CUSTOM_ACCESSIBILITY_TARGET_PACKAGES, ""));
        packages.remove(packageName.trim());
        savePackageSet(context, packages);
    }

    private static Set<String> parsePackageSet(String raw) {
        Set<String> packages = new LinkedHashSet<>();
        if (raw == null || raw.trim().isEmpty()) {
            return packages;
        }
        String[] parts = raw.split(",");
        for (String part : parts) {
            String normalized = part == null ? "" : part.trim();
            if (!normalized.isEmpty()) {
                packages.add(normalized);
            }
        }
        return packages;
    }

    private static void savePackageSet(Context context, Set<String> packages) {
        StringBuilder builder = new StringBuilder();
        for (String packageName : packages) {
            if (builder.length() > 0) {
                builder.append(",");
            }
            builder.append(packageName);
        }
        prefs(context).edit().putString(KEY_CUSTOM_ACCESSIBILITY_TARGET_PACKAGES, builder.toString()).apply();
    }

    public static class PendingAccessibilityTransfer {
        public final String address;
        public final String rawText;
        public final String providerHint;
        public final String sourcePackage;
        public final Long detectedAt;

        PendingAccessibilityTransfer(String address, String rawText, String providerHint, String sourcePackage, Long detectedAt) {
            this.address = address;
            this.rawText = rawText;
            this.providerHint = providerHint;
            this.sourcePackage = sourcePackage;
            this.detectedAt = detectedAt;
        }
    }
}
