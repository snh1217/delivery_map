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
    private static final Pattern ONLY_NOISE_PATTERN = Pattern.compile("^(길안내|길 안내|위치보기|위치 보기|지도|내비|네비|경로|복사|공유|확인|취소|닫기|전화|검색)$");
    private static final Pattern NOT_ADDRESS_TEXT_PATTERN = Pattern.compile("(알림|버튼|누르면|권한|허용|설정|업데이트|로그인|회원|설치|실행|오류|안내|도움말|전체동의|서비스)");
    private static final Pattern ADDRESS_HINT_PATTERN = Pattern.compile("(구|동|읍|면|리|로|길|대로|번길|번지)");
    private static final Pattern ADDRESS_START_PATTERN = Pattern.compile("(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[^,]{4,}");
    private static final Pattern DESTINATION_LABEL_PATTERN = Pattern.compile("(도착지|도착|목적지|하차지|배달지|배송지)");
    private static final Pattern ORIGIN_LABEL_PATTERN = Pattern.compile("(출발지|출발|상차지|픽업지|내 위치|내위치|현재 위치|현위치)");
    private static final Pattern NAVIGATION_TRIGGER_PATTERN = Pattern.compile("(길안내|길 안내|길찾기|위치보기|위치 보기|지도|내비|네비|경로)");
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
        if (!isLikelyAddress(best.normalizedText)) {
            return null;
        }
        return new ExtractionResult(best.normalizedText, best.rawText, best.score);
    }

    public static ExtractionResult extractBestDestinationAddressFromAccessibilityTree(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource) {
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
        collectOrderedDestinationCandidates(root, clickedSource, candidates, seen);

        Candidate best = null;
        for (Candidate candidate : candidates) {
            if (!containsDestinationLabel(candidate.rawText) || !isLikelyAddress(candidate.normalizedText)) {
                continue;
            }
            if (best == null || candidate.score > best.score) {
                best = candidate;
            }
        }

        if (best == null || best.score < 6) {
            return null;
        }
        return new ExtractionResult(best.normalizedText, best.rawText, best.score);
    }

    public static ExtractionResult extractBestSourceAppDestinationAddressFromAccessibilityTree(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource) {
        ExtractionResult labeledResult = extractBestDestinationAddressFromAccessibilityTree(root, clickedSource);
        if (labeledResult != null) {
            return labeledResult;
        }

        IndexedCandidate fallback = extractLastLikelyOrderedAddress(root, clickedSource);
        if (fallback == null || fallback.score < 5) {
            return null;
        }
        return new ExtractionResult(fallback.normalizedText, "도착지 단일 추정 " + fallback.rawText, fallback.score);
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
            addAddressSegmentCandidates(nodeText, clickedContext, out, seen);
            addDestinationLabeledCandidates(nodeText, clickedContext, out, seen);

            String merged = collectDescendantText(node, 16);
            addCandidate(merged, clickedContext, out, seen);
            addAddressSegmentCandidates(merged, clickedContext, out, seen);
            addDestinationLabeledCandidates(merged, clickedContext, out, seen);

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
        int score = scoreCandidate(normalized, raw, clickedContext);
        out.add(new Candidate(raw, normalized, score));
    }

    private static void addAddressSegmentCandidates(String raw, boolean clickedContext, List<Candidate> out, Set<String> seen) {
        if (TextUtils.isEmpty(raw)) {
            return;
        }
        String text = raw.replace('\n', ' ').replace('\r', ' ');
        text = PHONE_PATTERN.matcher(text).replaceAll(" ");
        text = text.replaceAll("\\s+", " ").trim();
        String split = SIDO_PATTERN.matcher(text).replaceAll("\n$1");
        String[] parts = split.split("\\n");
        for (String part : parts) {
            String segment = part.trim();
            if (segment.length() >= 6) {
                addCandidate(segment, clickedContext, out, seen);
            }
        }
    }

    private static void addDestinationLabeledCandidates(String raw, boolean clickedContext, List<Candidate> out, Set<String> seen) {
        if (TextUtils.isEmpty(raw)) {
            return;
        }
        String text = raw.replace('\n', ' ').replace('\r', ' ');
        Matcher matcher = DESTINATION_LABEL_PATTERN.matcher(text);
        int start = -1;
        while (matcher.find()) {
            start = matcher.end();
        }
        if (start < 0 || start >= text.length()) {
            return;
        }
        String tail = text.substring(start).replaceAll("\\s+", " ").trim();
        if (tail.length() < 6) {
            return;
        }
        addCandidate("도착지 " + tail, true, out, seen);
        addAddressSegmentCandidates("도착지 " + tail, true, out, seen);
    }

    private static void collectOrderedDestinationCandidates(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource, List<Candidate> out, Set<String> seen) {
        List<TextNode> nodes = collectTextNodes(root, 260);
        if (nodes.isEmpty()) {
            return;
        }

        int clickedIndex = findClickedIndex(nodes, getNodeText(clickedSource));
        List<IndexedCandidate> fallbackCandidates = new ArrayList<>();
        boolean addedContextCandidate = false;

        for (int start = 0; start < nodes.size(); start += 1) {
            for (int end = start; end < Math.min(nodes.size(), start + 3); end += 1) {
                String rawCandidate = joinNodeText(nodes, start, end);
                if (TextUtils.isEmpty(rawCandidate) || NAVIGATION_TRIGGER_PATTERN.matcher(rawCandidate).matches()) {
                    continue;
                }

                String normalized = normalizeAddress(rawCandidate);
                if (!isLikelyAddress(normalized)) {
                    continue;
                }

                String context = joinNodeText(nodes, Math.max(0, start - 4), Math.min(nodes.size() - 1, end + 4));
                int contextScore = scoreDestinationContext(nodes, start, end, clickedIndex, context);
                int baseScore = scoreCandidate(normalized, rawCandidate, isNearClicked(start, end, clickedIndex));
                IndexedCandidate indexed = new IndexedCandidate(rawCandidate, normalized, start, end, baseScore + contextScore);
                fallbackCandidates.add(indexed);

                if (contextScore < 5) {
                    continue;
                }

                addedContextCandidate = true;
                addCandidateWithNormalized(
                    "도착지 주변 " + context + " / 후보 " + rawCandidate,
                    normalized,
                    indexed.score,
                    out,
                    seen
                );
            }
        }

        if (!addedContextCandidate && fallbackCandidates.size() >= 2) {
            IndexedCandidate best = null;
            for (IndexedCandidate candidate : fallbackCandidates) {
                if (ORIGIN_LABEL_PATTERN.matcher(candidate.rawText).find()) {
                    continue;
                }
                int score = candidate.score + Math.min(candidate.startIndex, 40) / 4;
                if (best == null || score > best.score) {
                    best = new IndexedCandidate(candidate.rawText, candidate.normalizedText, candidate.startIndex, candidate.endIndex, score);
                }
            }
            if (best != null && best.score >= 4) {
                addCandidateWithNormalized(
                    "주소 순서 추정 " + best.rawText,
                    best.normalizedText,
                    best.score + 5,
                    out,
                    seen
                );
            }
        }
    }

    private static void addCandidateWithNormalized(String raw, String normalized, int score, List<Candidate> out, Set<String> seen) {
        if (TextUtils.isEmpty(normalized) || !isLikelyAddress(normalized)) {
            return;
        }
        String key = "dest:" + normalized;
        if (!seen.add(key)) {
            return;
        }
        out.add(new Candidate(raw, normalized, score));
    }

    private static IndexedCandidate extractLastLikelyOrderedAddress(AccessibilityNodeInfo root, AccessibilityNodeInfo clickedSource) {
        List<TextNode> nodes = collectTextNodes(root, 260);
        if (nodes.isEmpty()) {
            return null;
        }

        int clickedIndex = findClickedIndex(nodes, getNodeText(clickedSource));
        IndexedCandidate best = null;
        for (int start = 0; start < nodes.size(); start += 1) {
            for (int end = start; end < Math.min(nodes.size(), start + 3); end += 1) {
                String rawCandidate = joinNodeText(nodes, start, end);
                if (TextUtils.isEmpty(rawCandidate) || ORIGIN_LABEL_PATTERN.matcher(rawCandidate).find()) {
                    continue;
                }
                String context = joinNodeText(nodes, Math.max(0, start - 3), Math.min(nodes.size() - 1, end + 3));
                if (ORIGIN_LABEL_PATTERN.matcher(context).find() && !DESTINATION_LABEL_PATTERN.matcher(context).find()) {
                    continue;
                }
                String normalized = normalizeAddress(rawCandidate);
                if (!isLikelyAddress(normalized)) {
                    continue;
                }
                int score = scoreCandidate(normalized, rawCandidate, isNearClicked(start, end, clickedIndex))
                    + Math.min(start, 50) / 5;
                if (DESTINATION_LABEL_PATTERN.matcher(context).find()) {
                    score += 4;
                }
                if (best == null || score > best.score) {
                    best = new IndexedCandidate(rawCandidate, normalized, start, end, score);
                }
            }
        }
        return best;
    }

    private static List<TextNode> collectTextNodes(AccessibilityNodeInfo start, int maxNodes) {
        List<TextNode> nodes = new ArrayList<>();
        if (start == null) {
            return nodes;
        }
        Deque<AccessibilityNodeInfo> queue = new ArrayDeque<>();
        queue.add(start);
        int scanned = 0;
        while (!queue.isEmpty() && scanned < maxNodes) {
            AccessibilityNodeInfo node = queue.removeFirst();
            scanned += 1;
            String text = getNodeText(node).replace('\n', ' ').replace('\r', ' ').replaceAll("\\s+", " ").trim();
            if (!TextUtils.isEmpty(text)) {
                nodes.add(new TextNode(nodes.size(), text));
            }
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
        return nodes;
    }

    private static int findClickedIndex(List<TextNode> nodes, String clickedText) {
        if (TextUtils.isEmpty(clickedText)) {
            return -1;
        }
        String normalizedClicked = clickedText.replaceAll("\\s+", " ").trim();
        for (TextNode node : nodes) {
            if (node.rawText.equals(normalizedClicked) || normalizedClicked.contains(node.rawText) || node.rawText.contains(normalizedClicked)) {
                return node.index;
            }
        }
        return -1;
    }

    private static String joinNodeText(List<TextNode> nodes, int start, int end) {
        if (nodes.isEmpty() || start > end) {
            return "";
        }
        List<String> pieces = new ArrayList<>();
        for (int i = Math.max(0, start); i <= Math.min(nodes.size() - 1, end); i += 1) {
            pieces.add(nodes.get(i).rawText);
        }
        return TextUtils.join(" ", pieces).replaceAll("\\s+", " ").trim();
    }

    private static int scoreDestinationContext(List<TextNode> nodes, int start, int end, int clickedIndex, String context) {
        int score = 0;
        if (DESTINATION_LABEL_PATTERN.matcher(context).find()) {
            score += 7;
        }
        if (ORIGIN_LABEL_PATTERN.matcher(context).find()) {
            score -= 3;
        }

        int nearestDestination = nearestLabelDistance(nodes, start, end, DESTINATION_LABEL_PATTERN);
        int nearestOrigin = nearestLabelDistance(nodes, start, end, ORIGIN_LABEL_PATTERN);
        if (nearestDestination >= 0) {
            score += Math.max(3, 10 - nearestDestination);
        }
        if (nearestOrigin >= 0 && (nearestDestination < 0 || nearestOrigin < nearestDestination)) {
            score -= Math.max(5, 12 - nearestOrigin);
        }
        if (clickedIndex >= 0 && start <= clickedIndex + 2 && end >= clickedIndex - 4) {
            score += 2;
        }
        if (NAVIGATION_TRIGGER_PATTERN.matcher(context).find() && nearestDestination >= 0) {
            score += 2;
        }
        return score;
    }

    private static int nearestLabelDistance(List<TextNode> nodes, int start, int end, Pattern labelPattern) {
        int nearest = -1;
        int from = Math.max(0, start - 6);
        int to = Math.min(nodes.size() - 1, end + 4);
        for (int i = from; i <= to; i += 1) {
            if (!labelPattern.matcher(nodes.get(i).rawText).find()) {
                continue;
            }
            int distance = i < start ? start - i : i > end ? i - end : 0;
            if (nearest < 0 || distance < nearest) {
                nearest = distance;
            }
        }
        return nearest;
    }

    private static boolean isNearClicked(int start, int end, int clickedIndex) {
        return clickedIndex >= 0 && start <= clickedIndex + 3 && end >= clickedIndex - 3;
    }

    private static int scoreCandidate(String normalized, String raw, boolean clickedContext) {
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
        if (!isLikelyAddress(normalized)) {
            return -10;
        }

        String rawText = raw == null ? "" : raw;
        if (NOT_ADDRESS_TEXT_PATTERN.matcher(rawText).find()) {
            return -10;
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
        if (rawText.contains("도착") || rawText.contains("목적지") || rawText.contains("하차지") || rawText.contains("도착지")) score += 7;
        if (rawText.contains("출발") || rawText.contains("출발지") || rawText.contains("상차지")) score -= 7;
        if (rawText.contains("내 위치") || rawText.contains("현재 위치") || rawText.contains("현위치") || rawText.contains("내위치")) score -= 8;
        if (normalized.contains("내 위치") || normalized.contains("현재 위치") || normalized.contains("현위치") || normalized.contains("내위치")) score -= 8;
        return score;
    }

    public static boolean isLikelyAddress(String text) {
        if (TextUtils.isEmpty(text)) {
            return false;
        }
        String normalized = text.trim();
        if (normalized.length() < 7 || normalized.length() > 120) {
            return false;
        }
        String phoneStripped = PHONE_PATTERN.matcher(normalized).replaceAll("").trim();
        if (phoneStripped.length() < 7) {
            return false;
        }
        if (!NUMBER_PATTERN.matcher(normalized).find()) {
            return false;
        }
        if (NOT_ADDRESS_TEXT_PATTERN.matcher(normalized).find()) {
            return false;
        }
        return SIDO_PATTERN.matcher(normalized).find() || ADDRESS_HINT_PATTERN.matcher(normalized).find();
    }

    private static boolean containsDestinationLabel(String text) {
        return !TextUtils.isEmpty(text) && DESTINATION_LABEL_PATTERN.matcher(text).find();
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
        text = text.replaceAll("(출발지|도착지|상차지|하차지|출발|도착|목적지|내 위치|내위치|현재 위치|현위치|주소|길안내|길 안내|지도|내비|네비|카카오맵|카카오내비|네이버지도|입력)", " ");
        text = text.replaceAll("서울시", "서울");
        text = text.replaceAll("경기도", "경기");
        text = text.replaceAll("인천시", "인천");
        text = text.replaceAll("\\s+", " ").trim();

        Matcher matcher = ADDRESS_START_PATTERN.matcher(text);
        if (matcher.find()) {
            return matcher.group(0).replaceAll("입력$", "").replaceAll("\\s+", " ").trim();
        }
        return text.replaceAll("입력$", "").replaceAll("\\s+", " ").trim();
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

    private static final class TextNode {
        private final int index;
        private final String rawText;

        private TextNode(int index, String rawText) {
            this.index = index;
            this.rawText = rawText;
        }
    }

    private static final class IndexedCandidate {
        private final String rawText;
        private final String normalizedText;
        private final int startIndex;
        private final int endIndex;
        private final int score;

        private IndexedCandidate(String rawText, String normalizedText, int startIndex, int endIndex, int score) {
            this.rawText = rawText;
            this.normalizedText = normalizedText;
            this.startIndex = startIndex;
            this.endIndex = endIndex;
            this.score = score;
        }
    }
}
