package com.snh.deliverymap.extractor.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.text.TextUtils;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.snh.deliverymap.MainActivity;
import com.snh.deliverymap.extractor.ExtractorStateStore;

public class QuickAddressAccessibilityService extends AccessibilityService {
    private static final String TAG = "QuickAccessibility";
    private static final long FOLLOW_UP_WINDOW_MS = 10000L;
    private static final long DUPLICATE_WINDOW_MS = 4000L;
    private static final int FOLLOW_UP_MIN_SCORE = 5;

    private long lastTriggerAt = 0L;
    private String lastTriggerPackage = null;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = String.valueOf(event.getPackageName());
        if (packageName.equals(getPackageName())) {
            return;
        }
        ExtractorStateStore.recordLastObservedAccessibilityPackage(this, packageName);

        QuickTargetAppRule rule = QuickTargetAppRule.resolve(packageName);
        if (rule == null && ExtractorStateStore.isAccessibilityTargetPackage(this, packageName)) {
            rule = QuickTargetAppRule.customTarget(packageName);
        }
        if (rule == null) {
            return;
        }

        int eventType = event.getEventType();
        AccessibilityNodeInfo source = event.getSource();
        AccessibilityNodeInfo root = null;
        boolean directTrigger = eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && containsNavigationKeyword(event, source, rule);
        if (!directTrigger && eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            root = getRootInActiveWindow();
            if (root != null) {
                String screenContext = AccessibilityAddressExtractor.buildContextText(root, source, 80);
                directTrigger = rule.containsTrigger(screenContext) && rule.containsAddressContext(screenContext);
            }
        }
        boolean followUpTrigger = lastTriggerPackage != null
            && (System.currentTimeMillis() - lastTriggerAt) < FOLLOW_UP_WINDOW_MS
            && (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED)
            && (lastTriggerPackage.equals(packageName) || rule.isNavigationProvider());

        if (!directTrigger && !followUpTrigger) {
            if (source != null) {
                source.recycle();
            }
            if (root != null) {
                root.recycle();
            }
            return;
        }

        if (directTrigger) {
            lastTriggerAt = System.currentTimeMillis();
            lastTriggerPackage = packageName;
            Log.d(TAG, "Navigation click detected in package=" + packageName + " rule=" + rule.id);
            if (!rule.isNavigationProvider()) {
                if (root == null) {
                    root = getRootInActiveWindow();
                }
                AccessibilityAddressExtractor.ExtractionResult destinationResult =
                    AccessibilityAddressExtractor.extractBestSourceAppDestinationAddressFromAccessibilityTree(root, source);
                if (destinationResult != null && !TextUtils.isEmpty(destinationResult.normalizedAddress)) {
                    Log.d(TAG, "Destination address captured before provider launch: " + destinationResult.normalizedAddress);
                    dispatchAddress(root, source, destinationResult, rule, packageName, false);
                    if (source != null) {
                        source.recycle();
                    }
                    if (root != null) {
                        root.recycle();
                    }
                    return;
                }
                Log.d(TAG, "Waiting for navigation provider screen before extraction. source=" + packageName);
                if (source != null) {
                    source.recycle();
                }
                if (root != null) {
                    root.recycle();
                }
                return;
            }
        }

        if (root == null) {
            root = getRootInActiveWindow();
        }
        if (root == null) {
            Log.d(TAG, "Active window root is null for package=" + packageName);
            if (source != null) {
                source.recycle();
            }
            return;
        }

        try {
            AccessibilityAddressExtractor.ExtractionResult result = AccessibilityAddressExtractor.extractBestDestinationAddressFromAccessibilityTree(root, source);
            if (result == null && !rule.isNavigationProvider()) {
                result = AccessibilityAddressExtractor.extractBestAddressFromAccessibilityTree(root, source);
            }
            if (result == null || TextUtils.isEmpty(result.normalizedAddress)) {
                Log.d(TAG, "No address candidate found for package=" + packageName);
                return;
            }
            if (!AccessibilityAddressExtractor.isLikelyAddress(result.normalizedAddress)) {
                Log.d(TAG, "Candidate rejected as non-address: " + result.normalizedAddress);
                return;
            }

            if (followUpTrigger && result.score < FOLLOW_UP_MIN_SCORE) {
                Log.d(TAG, "Follow-up candidate score too low for package=" + packageName + " score=" + result.score);
                return;
            }

            String nearbyContext = AccessibilityAddressExtractor.buildContextText(root, source, 18);
            if (followUpTrigger && !rule.containsAddressContext(nearbyContext) && result.score < FOLLOW_UP_MIN_SCORE + 1) {
                Log.d(TAG, "Follow-up candidate missing address context for package=" + packageName);
                return;
            }

            dispatchAddress(root, source, result, rule, packageName, followUpTrigger);
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

    private void dispatchAddress(
        AccessibilityNodeInfo root,
        AccessibilityNodeInfo source,
        AccessibilityAddressExtractor.ExtractionResult result,
        QuickTargetAppRule rule,
        String packageName,
        boolean followUpTrigger
    ) {
        long detectedAt = System.currentTimeMillis();
        if (ExtractorStateStore.shouldSuppressAccessibilityDispatch(this, result.normalizedAddress, detectedAt, DUPLICATE_WINDOW_MS)) {
            Log.d(TAG, "Duplicate accessibility address suppressed: " + result.normalizedAddress);
            return;
        }
        lastTriggerAt = 0L;

        String providerHint = AccessibilityAddressExtractor.detectProviderHint(root, source);
        String sourcePackage = followUpTrigger && lastTriggerPackage != null && !lastTriggerPackage.equals(packageName)
            ? lastTriggerPackage
            : packageName;
        ExtractorStateStore.savePendingAccessibilityTransfer(
            this,
            result.normalizedAddress,
            result.rawText,
            providerHint,
            sourcePackage,
            detectedAt
        );
        Log.d(TAG, "Accessibility address captured: " + result.normalizedAddress + " / provider=" + providerHint + " / rule=" + rule.id + " / source=" + sourcePackage);
        openExtractorAppOrWebFallback(result.normalizedAddress, result.rawText, providerHint);
    }

    private boolean containsNavigationKeyword(AccessibilityEvent event, AccessibilityNodeInfo source, QuickTargetAppRule rule) {
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
        return rule.containsTrigger(builder.toString());
    }

    private void openExtractorAppOrWebFallback(String address, String rawText, String providerHint) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("openExtractor", true);
        intent.putExtra("openExtractorReason", "accessibility");
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException error) {
            Log.w(TAG, "Extractor app launch failed. Falling back to web extractor.", error);
            Uri fallbackUri = Uri.parse("https://deliverymap.vercel.app/extractor")
                .buildUpon()
                .appendQueryParameter("incoming", "accessibility")
                .appendQueryParameter("transferType", "accessibility")
                .appendQueryParameter("address", address)
                .appendQueryParameter("rawText", rawText)
                .appendQueryParameter("providerHint", providerHint)
                .build();
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, fallbackUri);
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(browserIntent);
        }
    }
}
