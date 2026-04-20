package com.snh.deliverymap.extractor.accessibility;

import android.text.TextUtils;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

final class QuickTargetAppRule {
    static final List<QuickTargetAppRule> RULES = Collections.unmodifiableList(Arrays.asList(
        new QuickTargetAppRule(
            "inseong-iscf",
            Arrays.asList("com.inseong.iscf"),
            Arrays.asList("inseong", "quick"),
            Arrays.asList("길안내", "길 안내", "길찾기", "위치보기", "위치 보기", "경로", "지도", "내비", "네비", "카카오맵", "카카오내비", "네이버지도"),
            Arrays.asList("출발지", "도착지", "상차지", "하차지", "주소", "배달지", "목적지", "위치")
        ),
        new QuickTargetAppRule(
            "inseong-quick",
            Arrays.asList("com.inseong.quick", "com.inseong.mlogis"),
            Arrays.asList("inseong", "mlogis", "quick"),
            Arrays.asList("길안내", "길 안내", "길찾기", "위치보기", "위치 보기", "경로", "지도", "내비", "네비", "카카오맵", "카카오내비", "네이버지도"),
            Arrays.asList("출발지", "도착지", "상차지", "하차지", "주소", "배달지", "목적지", "위치")
        ),
        new QuickTargetAppRule(
            "kakao-map",
            Arrays.asList("net.daum.android.map"),
            Arrays.asList("kakao", "daum", "map"),
            Arrays.asList("길안내", "길 안내", "위치보기", "위치 보기", "도착", "출발", "경로", "내비", "네비"),
            Arrays.asList("출발", "도착", "주소", "위치", "검색")
        ),
        new QuickTargetAppRule(
            "kakao-navi",
            Arrays.asList("com.locnall.KimGiSa", "com.kakao.navi"),
            Arrays.asList("kakao", "navi", "kimgisa"),
            Arrays.asList("길안내", "위치보기", "위치 보기", "안내", "도착", "출발", "경로"),
            Arrays.asList("출발", "도착", "주소", "위치")
        ),
        new QuickTargetAppRule(
            "naver-map",
            Arrays.asList("com.nhn.android.nmap"),
            Arrays.asList("naver", "nmap"),
            Arrays.asList("길안내", "길 안내", "위치보기", "위치 보기", "도착", "출발", "경로", "내비", "네비"),
            Arrays.asList("출발", "도착", "주소", "위치", "검색")
        )
    ));

    final String id;
    private final List<String> exactPackages;
    private final List<String> packageContains;
    private final List<String> triggerKeywords;
    private final List<String> addressKeywords;

    QuickTargetAppRule(
        String id,
        List<String> exactPackages,
        List<String> packageContains,
        List<String> triggerKeywords,
        List<String> addressKeywords
    ) {
        this.id = id;
        this.exactPackages = exactPackages;
        this.packageContains = packageContains;
        this.triggerKeywords = triggerKeywords;
        this.addressKeywords = addressKeywords;
    }

    static QuickTargetAppRule customTarget(String packageName) {
        return new QuickTargetAppRule(
            "custom:" + packageName,
            Collections.singletonList(packageName),
            Collections.emptyList(),
            Arrays.asList("길안내", "길 안내", "길찾기", "위치보기", "위치 보기", "경로", "지도", "내비", "네비", "카카오맵", "카카오내비", "네이버지도"),
            Arrays.asList("출발지", "도착지", "상차지", "하차지", "주소", "배달지", "목적지", "위치")
        );
    }

    boolean matchesPackage(String packageName) {
        if (TextUtils.isEmpty(packageName)) {
            return false;
        }
        if (exactPackages.contains(packageName)) {
            return true;
        }
        String lower = packageName.toLowerCase(Locale.ROOT);
        for (String token : packageContains) {
            if (lower.contains(token.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    boolean containsTrigger(String text) {
        if (TextUtils.isEmpty(text)) {
            return false;
        }
        for (String keyword : triggerKeywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    boolean containsAddressContext(String text) {
        if (TextUtils.isEmpty(text)) {
            return false;
        }
        for (String keyword : addressKeywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    boolean isNavigationProvider() {
        return id.equals("kakao-map") || id.equals("kakao-navi") || id.equals("naver-map");
    }

    static QuickTargetAppRule resolve(String packageName) {
        for (QuickTargetAppRule rule : RULES) {
            if (rule.matchesPackage(packageName)) {
                return rule;
            }
        }
        return null;
    }
}
