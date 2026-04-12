package com.snh.deliverymap.extractor;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import android.widget.Toast;

import androidx.annotation.Nullable;

import com.snh.deliverymap.MainActivity;

import java.nio.ByteBuffer;

public class ScreenCaptureActivity extends Activity {
    private static final int REQUEST_CAPTURE = 44021;

    private MediaProjectionManager mediaProjectionManager;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mediaProjectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mediaProjectionManager == null) {
            Toast.makeText(this, "Unable to start screen capture.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }
        startActivityForResult(mediaProjectionManager.createScreenCaptureIntent(), REQUEST_CAPTURE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_CAPTURE) {
            finish();
            return;
        }
        if (resultCode != RESULT_OK || data == null) {
            Toast.makeText(this, "Screen capture permission was cancelled.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        captureOnce(resultCode, data);
    }

    private void captureOnce(int resultCode, Intent data) {
        WindowManager windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getDisplay().getRealMetrics(metrics);
        } else if (windowManager != null && windowManager.getDefaultDisplay() != null) {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        }

        int width = metrics.widthPixels;
        int height = metrics.heightPixels;
        int density = metrics.densityDpi;

        ImageReader reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        MediaProjection projection = mediaProjectionManager.getMediaProjection(resultCode, data);
        VirtualDisplay virtualDisplay = projection.createVirtualDisplay(
            "extractor-capture",
            width,
            height,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader.getSurface(),
            null,
            null
        );

        Handler handler = new Handler(Looper.getMainLooper());
        handler.postDelayed(() -> {
            Image image = null;
            Bitmap bitmap = null;
            try {
                image = reader.acquireLatestImage();
                if (image == null) {
                    Toast.makeText(this, "Failed to capture the current screen.", Toast.LENGTH_SHORT).show();
                    return;
                }
                Image.Plane[] planes = image.getPlanes();
                ByteBuffer buffer = planes[0].getBuffer();
                int pixelStride = planes[0].getPixelStride();
                int rowStride = planes[0].getRowStride();
                int rowPadding = rowStride - pixelStride * width;
                bitmap = Bitmap.createBitmap(width + rowPadding / pixelStride, height, Bitmap.Config.ARGB_8888);
                bitmap.copyPixelsFromBuffer(buffer);
                Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height);
                ExtractorStateStore.saveCaptureBitmap(this, cropped);
                cropped.recycle();
                openExtractor();
            } catch (Exception e) {
                Toast.makeText(this, "Failed to save the captured screen.", Toast.LENGTH_SHORT).show();
            } finally {
                if (bitmap != null && !bitmap.isRecycled()) {
                    bitmap.recycle();
                }
                if (image != null) {
                    image.close();
                }
                reader.close();
                virtualDisplay.release();
                projection.stop();
                finish();
            }
        }, 350);
    }

    private void openExtractor() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openExtractor", true);
        startActivity(intent);
    }
}