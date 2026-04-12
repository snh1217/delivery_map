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
        intent.removeExtra("openExtractor");
        bridge.getWebView().post(() -> bridge.getWebView().loadUrl("https://deliverymap.vercel.app/extractor?captured=1"));
    }
}
