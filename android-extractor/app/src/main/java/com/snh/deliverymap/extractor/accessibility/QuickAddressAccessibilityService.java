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
    private static final long SOURCE_CACHE_WINDOW_MS = 20000L;
    private static final long DUPLICATE_WINDOW_MS = 4000L;
    private static final int FOLLOW_UP_MIN_SCORE = 5;

    private long lastTriggerAt = 0L;
    private String lastTriggerPackage = null;
    private long lastSourceCapturedAt = 0L;
    private String lastSourcePackage = null;
    private AccessibilityAddressExtractor.ExtractionResult lastSourceDestination = null;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) {
            return;
        }

        String packageName = String.valueOf(event.getPackageName());
        if (packageName.equals(getPackageName())) {
            return;
        }
        if (QuickTargetAppRule.isBlockedPackage(packageName)) {
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
        if (!rule.isNavigationProvider() && shouldCacheSourceScreen(eventType)) {
            root = getRootInActiveWindow();
            cacheSourceDestination(root, source, packageName);
        }

        boolean directTrigger = eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && containsNavigationKeyword(event, source, rule);
        if (!directTrigger && eventType == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            String clickedContext = AccessibilityAddressExtractor.buildClickedNeighborhoodText(source, 4, 32);
            directTrigger = rule.containsTrigger(clickedContext) && rule.containsAddressContext(clickedContext);
        }
        if (!directTrigger && eventType == AccessibilityEvent.TYPE_VIEW_CLICKED && !rule.isNavigationProvider()) {
            if (root == null) {
                root = getRootInActiveWindow();
            }
            if (root != null) {
                String rawScreenContext = AccessibilityAddressExtractor.buildRawContextText(root, source, 90);
                directTrigger = rule.containsTrigger(rawScreenContext)
                    && rule.containsAddressContext(rawScreenContext)
                    && hasRecentSourceDestination();
            }
        }
        boolean followUpTrigger = lastTriggerPackage != null
            && (System.currentTimeMillis() - lastTriggerAt) < FOLLOW_UP_WINDOW_MS
            && (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED)
            && (lastTriggerPackage.equals(packageName) || rule.isNavigationProvider());
        boolean cachedProviderTrigger = !directTrigger
            && !followUpTrigger
            && lastTriggerPackage != null
            && (System.currentTimeMillis() - lastTriggerAt) < FOLLOW_UP_WINDOW_MS
            && rule.isNavigationProvider()
            && hasRecentSourceDestination()
            && (eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
                || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
                || eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED);

        if (!directTrigger && !followUpTrigger && !cachedProviderTrigger) {
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
                cacheSourceDestination(root, source, packageName);
                AccessibilityAddressExtractor.ExtractionResult destinationResult =
                    AccessibilityAddressExtractor.extractBestSourceAppDestinationAddressFromAccessibilityTree(root, source);
                if ((destinationResult == null || TextUtils.isEmpty(destinationResult.normalizedAddress)) && hasRecentSourceDestination()) {
                    destinationResult = lastSourceDestination;
                }
                if (destinationResult != null && !TextUtils.isEmpty(destinationResult.normalizedAddress)) {
                    Log.d(TAG, "Destination address captured before provider launch: " + destinationResult.normalizedAddress);
                    dispatchAddress(root, source, destinationResult, rule, packageName, false, packageName);
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
            if (cachedProviderTrigger && lastSourceDestination != null && !TextUtils.isEmpty(lastSourcePackage)) {
                Log.d(TAG, "Using cached source destination after provider launch: " + lastSourceDestination.normalizedAddress + " / source=" + lastSourcePackage + " / provider=" + packageName);
                dispatchAddress(root, source, lastSourceDestination, rule, packageName, true, lastSourcePackage);
                return;
            }

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

            dispatchAddress(root, source, result, rule, packageName, followUpTrigger, null);
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
        boolean followUpTrigger,
        String sourcePackageOverride
    ) {
        long detectedAt = System.currentTimeMillis();
        if (ExtractorStateStore.shouldSuppressAccessibilityDispatch(this, result.normalizedAddress, detectedAt, DUPLICATE_WINDOW_MS)) {
            Log.d(TAG, "Duplicate accessibility address suppressed: " + result.normalizedAddress);
            return;
        }
        lastTriggerAt = 0L;

        String providerHint = AccessibilityAddressExtractor.detectProviderHint(root, source);
        String sourcePackage = !TextUtils.isEmpty(sourcePackageOverride)
            ? sourcePackageOverride
            : (followUpTrigger && lastTriggerPackage != null && !lastTriggerPackage.equals(packageName)
                ? lastTriggerPackage
                : packageName);
        ExtractorStateStore.savePendingAccessibilityTransfer(
            this,
            result.normalizedAddress,
            result.rawText,
            providerHint,
            sourcePackage,
            detectedAt
        );
        lastSourceDestination = null;
        lastSourcePackage = null;
        lastSourceCapturedAt = 0L;
        Log.d(TAG, "Accessibility address captured: " + result.normalizedAddress + " / provider=" + providerHint + " / rule=" + rule.id + " / source=" + sourcePackage);
        openExtractorAppOrWebFallback(result.normalizedAddress, result.rawText, providerHint);
    }

    private boolean shouldCacheSourceScreen(int eventType) {
        return eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            || eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            || eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED
            || eventType == AccessibilityEvent.TYPE_VIEW_CLICKED;
    }

    private boolean hasRecentSourceDestination() {
        return lastSourceDestination != null
            && !TextUtils.isEmpty(lastSourcePackage)
            && (System.currentTimeMillis() - lastSourceCapturedAt) < SOURCE_CACHE_WINDOW_MS;
    }

    private void cacheSourceDestination(AccessibilityNodeInfo root, AccessibilityNodeInfo source, String packageName) {
        if (root == null || TextUtils.isEmpty(packageName)) {
            return;
        }
        AccessibilityAddressExtractor.ExtractionResult result =
            AccessibilityAddressExtractor.extractBestDestinationAddressFromAccessibilityTree(root, source);
        if (result == null || TextUtils.isEmpty(result.normalizedAddress) || result.score < 8) {
            return;
        }
        lastSourceDestination = result;
        lastSourcePackage = packageName;
        lastSourceCapturedAt = System.currentTimeMillis();
        Log.d(TAG, "Cached source destination: " + result.normalizedAddress + " / source=" + packageName + " / score=" + result.score);
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
