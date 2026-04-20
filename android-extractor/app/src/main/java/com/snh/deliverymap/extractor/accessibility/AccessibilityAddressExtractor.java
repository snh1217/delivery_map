package com.snh.deliverymap.extractor.accessibility;

import android.os.Build;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Deque;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class AccessibilityAddressExtractor {
    private static final Pattern PHONE_PATTERN = Pattern.compile("01[0-9]-?\\d{3,4}-?\\d{4}");
    private static final Pattern SIDO_PATTERN = Pattern.compile("(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)");
    private static final Pattern ROAD_PATTERN = Pattern.compile("(구|동|읍|면|리|로|길|대로|번길)");
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d");
    private static final Pattern BUILDING_PATTERN = Pattern.compile("(층|호|빌딩|아파트|상가|센터|타워|오피스텔)");
    private static final Pattern ONLY_NOISE_PATTERN = Pattern.compile("^(길안내|길 안내|지도|내비|네비|경로|복사|공유|확인|취소|닫기|전화|검색)$");
    private static final Pattern ADDRESS_START_PATTERN = Pattern.compile("(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^,]{4,}");
    private static final Set<String> CONTEXT_KEYWORDS = new HashSet<>(Arrays.asList(
        "출발지", "도착지", "상차지", "하차지", "주소", "길안내", "길 안내", "지도", "내비", "네비", "카카오", "네이버", "목적지", "위치"
    ));

    private AccessibilityAddressExtractor() {
    }

    public static ExtractionResult extractBestAddressFromAccessibilityTree(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource) {
        if (root == null) {
            return null;
        }

        List<Candidate> candidates = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        collectCandidates(root, false, candidates, seen);

        if (clickedSource != null) {
            AccessibilityNodeInfo contextRoot = clickedSource;
            int depth = 0;
            while (contextRoot != null && depth < 4) {
                collectCandidates(contextRoot, true, candidates, seen);
                AccessibilityNodeInfo parent = contextRoot.getParent();
                if (contextRoot != clickedSource) {
                    contextRoot.recycle();
                }
                contextRoot = parent;
                depth += 1;
            }
            if (contextRoot != null) {
                contextRoot.recycle();
            }
        }

        Candidate best = null;
        for (Candidate candidate : candidates) {
            if (best == null || candidate.score > best.score) {
                best = candidate;
            }
        }

        if (best == null || best.score < 4) {
            return null;
        }
        return new ExtractionResult(best.normalizedText, best.rawText, best.score);
    }

    public static String buildContextText(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource, int maxNodes) {
        String sourceText = getNodeText(clickedSource);
        String rootText = collectDescendantText(root, maxNodes);
        return normalizeAddress(sourceText + " " + rootText);
    }

    private static void collectCandidates(AccessibilityNodeInfo start, boolean clickedContext, List<Candidate> out, Set<String> seen) {
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(start);
        int guard = 0;
        while (!queue.isEmpty() && guard < 320) {
            guard += 1;
            AccessibilityNodeInfo node = queue.removeFirst();
            String nodeText = getNodeText(node);
            addCandidate(nodeText, clickedContext, out, seen);

            String merged = collectDescendantText(node, 16);
            addCandidate(merged, clickedContext, out, seen);

            for (int i = 0; i < node.getChildCount(); i += 1) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    queue.addLast(child);
                }
            }

            if (node != start) {
                node.recycle();
            }
        }
    }

    private static void addCandidate(String raw, boolean clickedContext, List<Candidate> out, Set<String> seen) {
        if (TextUtils.isEmpty(raw)) {
            return;
        }
        String normalized = normalizeAddress(raw);
        if (normalized.isEmpty()) {
            return;
        }
        if (!seen.add((clickedContext ? "ctx:" : "all:") + normalized)) {
            return;
        }
        int score = scoreCandidate(normalized, clickedContext);
        out.add(new Candidate(raw, normalized, score));
    }

    private static int scoreCandidate(String normalized, boolean clickedContext) {
        if (normalized.length() < 6) {
            return -4;
        }
        String phoneStripped = PHONE_PATTERN.matcher(normalized).replaceAll("").trim();
        if (phoneStripped.length() < 6) {
            return -6;
        }
        if (ONLY_NOISE_PATTERN.matcher(normalized).matches()) {
            return -6;
        }

        int score = 0;
        if (SIDO_PATTERN.matcher(normalized).find()) score += 3;
        if (normalized.contains("구")) score += 2;
        if (ROAD_PATTERN.matcher(normalized).find()) score += 2;
        if (NUMBER_PATTERN.matcher(normalized).find()) score += 1;
        if (BUILDING_PATTERN.matcher(normalized).find()) score += 1;
        if (clickedContext) score += 3;
        if (normalized.length() >= 10) score += 1;
        if (normalized.length() > 90) score -= 2;
        if (countKeywords(normalized) >= 2) score += 2;
        if (normalized.contains("출발") || normalized.contains("도착") || normalized.contains("길안내")) score -= 1;
        return score;
    }

    private static int countKeywords(String text) {
        int count = 0;
        for (String keyword : CONTEXT_KEYWORDS) {
            if (text.contains(keyword)) {
                count += 1;
            }
        }
        return count;
    }

    private static String getNodeText(AccessibilityNodeInfo node) {
        if (node == null) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        if (!TextUtils.isEmpty(node.getText())) {
            parts.add(node.getText().toString());
        }
        if (!TextUtils.isEmpty(node.getContentDescription())) {
            parts.add(node.getContentDescription().toString());
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !TextUtils.isEmpty(node.getHintText())) {
            parts.add(String.valueOf(node.getHintText()));
        }
        return TextUtils.join(" ", parts);
    }

    private static String collectDescendantText(AccessibilityNodeInfo node, int maxNodes) {
        if (node == null) {
            return "";
        }
        List<String> pieces = new ArrayList<>();
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(node);
        int scanned = 0;
        while (!queue.isEmpty() && scanned < maxNodes) {
            AccessibilityNodeInfo current = queue.removeFirst();
            scanned += 1;
            String text = getNodeText(current);
            if (!TextUtils.isEmpty(text)) {
                pieces.add(text);
            }
            for (int i = 0; i < current.getChildCount(); i += 1) {
                AccessibilityNodeInfo child = current.getChild(i);
                if (child != null) {
                    queue.addLast(child);
                }
            }
            if (current != node) {
                current.recycle();
            }
        }
        return TextUtils.join(" ", pieces);
    }

    public static String normalizeAddress(String raw) {
        if (raw == null) {
            return "";
        }
        String text = raw.replace('\n', ' ').replace('\r', ' ');
        text = PHONE_PATTERN.matcher(text).replaceAll(" ");
        text = text.replaceAll("[\\[\\]{}<>|]", " ");
        text = text.replaceAll("[:;]", " ");
        text = text.replaceAll("(출발지|도착지|상차지|하차지|주소|길안내|길 안내|지도|내비|네비|카카오맵|카카오내비|네이버지도)", " ");
        text = text.replaceAll("서울시", "서울");
        text = text.replaceAll("경기도", "경기");
        text = text.replaceAll("인천시", "인천");
        text = text.replaceAll("\\s+", " ").trim();

        Matcher matcher = ADDRESS_START_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(0).replaceAll("\\s+", " ").trim();
        }
        return text;
    }

    public static String detectProviderHint(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource) {
        String context = normalizeAddress(getNodeText(clickedSource) + " " + collectDescendantText(root, 18)).toLowerCase(Locale.ROOT);
        if (context.contains("카카오내비") || context.contains("kimgisa")) {
            return "kakaonavi";
        }
        if (context.contains("카카오") || context.contains("kakao")) {
            return "kakao";
        }
        if (context.contains("네이버") || context.contains("naver")) {
            return "naver";
        }
        return null;
    }

    public static final class ExtractionResult {
        public final String normalizedAddress;
        public final String rawText;
        public final int score;

        public ExtractionResult(String normalizedAddress, String rawText, int score) {
            this.normalizedAddress = normalizedAddress;
            this.rawText = rawText;
            this.score = score;
        }
    }

    private static final class Candidate {
        private final String rawText;
        private final String normalizedText;
        private final int score;

        private Candidate(String rawText, String normalizedText, int score) {
            this.rawText = rawText;
            this.normalizedText = normalizedText;
            this.score = score;
        }
    }
}
