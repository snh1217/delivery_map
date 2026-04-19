package com.snh.deliverymap;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.snh.deliverymap.extractor.ExtractorBridgePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExtractorBridgePlugin.class);
        super.onCreate(savedInstanceState);
        handleExtractorIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleExtractorIntent(intent);
    }

    private void handleExtractorIntent(Intent intent) {
        if (intent == null || !intent.getBooleanExtra("openExtractor", false) || bridge == null) {
            return;
        }
        String reason = intent.getStringExtra("openExtractorReason");
        intent.removeExtra("openExtractor");
        intent.removeExtra("openExtractorReason");

        String url = "https://deliverymap.vercel.app/extractor";
        if ("capture".equals(reason)) {
            url += "?captured=1";
        } else if ("accessibility".equals(reason)) {
            url += "?incoming=accessibility";
        }
        final String finalUrl = url;
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl(finalUrl));
    }
}
