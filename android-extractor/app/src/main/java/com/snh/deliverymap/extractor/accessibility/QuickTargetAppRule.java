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
            Arrays.asList("길안내", "길 안내", "길찾기", "경로", "지도", "내비", "카카오내비", "카카오맵", "네이버지도"),
            Arrays.asList("출발지", "도착지", "상차지", "하차지", "주소", "배차지", "목적지")
        ),
        new QuickTargetAppRule(
            "inseong-quick",
            Arrays.asList("com.inseong.quick", "com.inseong.mlogis"),
            Arrays.asList("inseong", "mlogis", "quick"),
            Arrays.asList("길안내", "길 안내", "길찾기", "경로", "내비", "카카오내비", "카카오맵", "네이버지도"),
            Arrays.asList("출발지", "도착지", "주소", "상차지", "하차지", "배차")
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

    static QuickTargetAppRule resolve(String packageName) {
        for (QuickTargetAppRule rule : RULES) {
            if (rule.matchesPackage(packageName)) {
                return rule;
            }
        }
        return null;
    }
}
