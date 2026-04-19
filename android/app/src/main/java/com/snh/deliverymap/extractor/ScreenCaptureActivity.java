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
    private static final int MAX_CAPTURE_ATTEMPTS = 6;
    private static final long CAPTURE_RETRY_MS = 180L;

    private MediaProjectionManager mediaProjectionManager;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mediaProjectionManager = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mediaProjectionManager == null) {
            Toast.makeText(this, "화면 캡처를 시작할 수 없습니다.", Toast.LENGTH_SHORT).show();
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
            Toast.makeText(this, "화면 캡처 권한이 취소되었습니다.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        captureOnce(resultCode, data);
    }

    private void captureOnce(int resultCode, Intent data) {
        WindowManager windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics metrics = new DisplayMetrics();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (getDisplay() != null) {
                getDisplay().getRealMetrics(metrics);
            }
        } else if (windowManager != null && windowManager.getDefaultDisplay() != null) {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        }

        int width = metrics.widthPixels;
        int height = metrics.heightPixels;
        int density = metrics.densityDpi;
        if (width <= 0 || height <= 0) {
            Toast.makeText(this, "화면 정보를 읽지 못했습니다.", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        ImageReader reader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        MediaProjection projection = mediaProjectionManager.getMediaProjection(resultCode, data);
        if (projection == null) {
            Toast.makeText(this, "화면 캡처 세션을 만들지 못했습니다.", Toast.LENGTH_SHORT).show();
            reader.close();
            finish();
            return;
        }

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
        handler.postDelayed(() -> captureWithRetry(reader, virtualDisplay, projection, handler, width, height, 0), 350L);
    }

    private void captureWithRetry(
        ImageReader reader,
        VirtualDisplay virtualDisplay,
        MediaProjection projection,
        Handler handler,
        int width,
        int height,
        int attempt
    ) {
        Image image = null;
        Bitmap bitmap = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null) {
                if (attempt < MAX_CAPTURE_ATTEMPTS) {
                    handler.postDelayed(
                        () -> captureWithRetry(reader, virtualDisplay, projection, handler, width, height, attempt + 1),
                        CAPTURE_RETRY_MS
                    );
                    return;
                }
                Toast.makeText(this, "현재 화면을 캡처하지 못했습니다.", Toast.LENGTH_SHORT).show();
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
            openExtractor("capture");
        } catch (Exception ignored) {
            Toast.makeText(this, "캡처한 화면을 처리하지 못했습니다.", Toast.LENGTH_SHORT).show();
        } finally {
            if (bitmap != null && !bitmap.isRecycled()) {
                bitmap.recycle();
            }
            if (image != null) {
                image.close();
            }
            try {
                reader.close();
            } catch (Exception ignored) {
            }
            try {
                virtualDisplay.release();
            } catch (Exception ignored) {
            }
            try {
                projection.stop();
            } catch (Exception ignored) {
            }
            finish();
        }
    }

    private void openExtractor(String reason) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openExtractor", true);
        intent.putExtra("openExtractorReason", reason);
        startActivity(intent);
    }
}