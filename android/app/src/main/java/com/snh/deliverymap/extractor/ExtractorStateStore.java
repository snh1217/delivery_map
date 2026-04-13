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

public class ExtractorStateStore {
    private static final String PREFS = "extractor_bridge";
    private static final String KEY_OVERLAY_RUNNING = "overlay_running";
    private static final String KEY_LAST_CAPTURE = "last_capture_path";
    private static final String KEY_OVERLAY_X = "overlay_x";
    private static final String KEY_OVERLAY_Y = "overlay_y";

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
}
