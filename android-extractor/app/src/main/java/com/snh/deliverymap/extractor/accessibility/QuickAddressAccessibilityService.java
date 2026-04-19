package com.snh.deliverymap.extractor.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.text.TextUtils;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.snh.deliverymap.MainActivity;
import com.snh.deliverymap.extractor.ExtractorStateStore;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

public class QuickAddressAccessibilityService extends AccessibilityService {
    private static final String TAG = "QuickAccessibility";
    private static final Set<String> TARGET_PACKAGES = new HashSet<>(Arrays.asList(
        "com.inseong.iscf",
        "com.inseong.quick",
        "com.inseong.mlogis"
    ));
    private static final Set<String> NAV_TRIGGER_KEYWORDS = new HashSet<>(Arrays.asList(
        "길안내", "길 안내", "길찾기", "경로", "지도", "내비", "카카오내비", "카카오맵", "네이버지도"
    ));
    private static final long FOLLOW_UP_WINDOW_MS = 1800L;
    private static final long DUPLICATE_WINDOW_MS = 4000L;

    private long lastTriggerAt = 0L;
    private String lastTriggerPackage = null;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = String.valueOf(event.getPackageName());
        if (packageName.equals(getPackageName()) || !isWatchedPackage(packageName)) {
            return;
        }

        int eventType = event.getEventType();
        boolean directTrigger = eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && containsNavigationKeyword(event, event.getSource());
        boolean followUpTrigger = lastTriggerPackage != null
            && lastTriggerPackage.equals(packageName)
            && (System.currentTimeMillis() - lastTriggerAt) < FOLLOW_UP_WINDOW_MS
            && (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED);

        if (!directTrigger && !followUpTrigger) {
            return;
        }

        if (directTrigger) {
            lastTriggerAt = System.currentTimeMillis();
            lastTriggerPackage = packageName;
            Log.d(TAG, "Navigation click detected in package=" + packageName);
        }

        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) {
            Log.d(TAG, "Active window root is null for package=" + packageName);
            return;
        }

        AccessibilityNodeInfo source = event.getSource();
        try {
            AccessibilityAddressExtractor.ExtractionResult result = AccessibilityAddressExtractor.extractBestAddressFromAccessibilityTree(root, source);
            if (result == null || TextUtils.isEmpty(result.normalizedAddress)) {
                Log.d(TAG, "No address candidate found for package=" + packageName);
                return;
            }

            long detectedAt = System.currentTimeMillis();
            if (ExtractorStateStore.shouldSuppressAccessibilityDispatch(this, result.normalizedAddress, detectedAt, DUPLICATE_WINDOW_MS)) {
                Log.d(TAG, "Duplicate accessibility address suppressed: " + result.normalizedAddress);
                return;
            }

            String providerHint = AccessibilityAddressExtractor.detectProviderHint(root, source);
            ExtractorStateStore.savePendingAccessibilityTransfer(
                this,
                result.normalizedAddress,
                result.rawText,
                providerHint,
                packageName,
                detectedAt
            );
            Log.d(TAG, "Accessibility address captured: " + result.normalizedAddress + " / provider=" + providerHint);
            openExtractorApp();
        } finally {
            if (source != null) {
                source.recycle();
            }
            root.recycle();
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "Accessibility service interrupted");
    }

    private boolean isWatchedPackage(String packageName) {
        if (TARGET_PACKAGES.contains(packageName)) {
            return true;
        }
        String lower = packageName.toLowerCase(Locale.ROOT);
        return lower.contains("inseong") || lower.contains("quick");
    }

    private boolean containsNavigationKeyword(AccessibilityEvent event, AccessibilityNodeInfo source) {
        StringBuilder builder = new StringBuilder();
        if (event.getText() != null) {
            for (CharSequence value : event.getText()) {
                if (value != null) {
                    builder.append(value).append(' ');
                }
            }
        }
        if (source != null) {
            CharSequence text = source.getText();
            CharSequence description = source.getContentDescription();
            if (text != null) {
                builder.append(text).append(' ');
            }
            if (description != null) {
                builder.append(description).append(' ');
            }
        }
        String haystack = builder.toString();
        for (String keyword : NAV_TRIGGER_KEYWORDS) {
            if (haystack.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private void openExtractorApp() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openExtractor", true);
        intent.putExtra("openExtractorReason", "accessibility");
        startActivity(intent);
    }
}
