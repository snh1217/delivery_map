package com.snh.deliverymap.extractor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;

import com.snh.deliveryextractor.R;

public class OverlayBubbleService extends Service {
    public static final String ACTION_START = "com.snh.deliverymap.extractor.START";
    public static final String ACTION_STOP = "com.snh.deliverymap.extractor.STOP";
    private static final String CHANNEL_ID = "extractor_overlay";
    private static final int NOTIFICATION_ID = 41011;

    private WindowManager windowManager;
    private View bubbleView;
    private WindowManager.LayoutParams bubbleParams;
    private static final long LONG_PRESS_STOP_MS = 700L;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        try {
            startForeground(NOTIFICATION_ID, buildNotification());
            showBubble();
            ExtractorStateStore.setOverlayRunning(this, true);
        } catch (Exception error) {
            ExtractorStateStore.setOverlayRunning(this, false);
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (windowManager != null && bubbleView != null) {
            windowManager.removeView(bubbleView);
            bubbleView = null;
        }
        ExtractorStateStore.setOverlayRunning(this, false);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification buildNotification() {
        createChannel();
        Intent stopIntent = new Intent(this, OverlayBubbleService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            1002,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("구역 추출기 실행 중")
            .setContentText("떠있는 버튼으로 현재 화면을 캡처해 OCR을 시작할 수 있습니다.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .addAction(0, "중지", stopPendingIntent)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "구역 추출기",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("OCR용 떠있는 버튼을 유지하는 알림입니다.");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }

    private void showBubble() {
        if (bubbleView != null) {
            return;
        }
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
        TextView bubble = new TextView(this);
        bubble.setText("OCR");
        bubble.setTextColor(0xFFFFFFFF);
        bubble.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        bubble.setGravity(Gravity.CENTER);
        bubble.setBackgroundResource(android.R.drawable.btn_default_small);
        int size = (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            ExtractorStateStore.getOverlaySizeDp(this),
            getResources().getDisplayMetrics()
        );
        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        bubbleParams = new WindowManager.LayoutParams(
            size,
            size,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        bubbleParams.x = ExtractorStateStore.getOverlayX(this, 24);
        bubbleParams.y = ExtractorStateStore.getOverlayY(this, 0);
        bubble.setAlpha(ExtractorStateStore.getOverlayOpacity(this));

        final int[] initialX = new int[1];
        final int[] initialY = new int[1];
        final float[] touchX = new float[1];
        final float[] touchY = new float[1];
        final long[] downTime = new long[1];

        bubble.setOnTouchListener((v, event) -> {
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    initialX[0] = bubbleParams.x;
                    initialY[0] = bubbleParams.y;
                    touchX[0] = event.getRawX();
                    touchY[0] = event.getRawY();
                    downTime[0] = System.currentTimeMillis();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (ExtractorStateStore.isOverlayLocked(OverlayBubbleService.this)) {
                        return true;
                    }
                    bubbleParams.x = initialX[0] - (int) (event.getRawX() - touchX[0]);
                    bubbleParams.y = initialY[0] + (int) (event.getRawY() - touchY[0]);
                    if (windowManager != null) {
                        windowManager.updateViewLayout(bubble, bubbleParams);
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    long elapsed = System.currentTimeMillis() - downTime[0];
                    float dx = Math.abs(event.getRawX() - touchX[0]);
                    float dy = Math.abs(event.getRawY() - touchY[0]);
                    ExtractorStateStore.saveOverlayPosition(OverlayBubbleService.this, bubbleParams.x, bubbleParams.y);
                    if (elapsed >= LONG_PRESS_STOP_MS && dx < 12 && dy < 12) {
                        stopSelf();
                    } else if (elapsed < 220 && dx < 12 && dy < 12) {
                        launchCapture();
                    }
                    return true;
                default:
                    return false;
            }
        });

        bubbleView = bubble;
        if (windowManager != null) {
            try {
                windowManager.addView(bubbleView, bubbleParams);
            } catch (Exception error) {
                bubbleView = null;
                stopSelf();
            }
        }
    }

    private void launchCapture() {
        Intent intent = new Intent(this, ScreenCaptureActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        startActivity(intent);
    }
}
