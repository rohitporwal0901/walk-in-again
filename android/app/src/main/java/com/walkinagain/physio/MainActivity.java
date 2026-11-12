package com.walkinagain.physio;

import android.os.Bundle;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private long backPressedTime = 0;
    private Toast exitToast;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Intercept Android hardware & gesture back navigation
        OnBackPressedCallback callback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = (getBridge() != null) ? getBridge().getWebView() : null;

                if (webView != null) {
                    // For Capacitor/Angular SPA: webView.canGoBack() is always false (SPA routing).
                    // Use JS history.length to determine if there is app history to go back through.
                    webView.evaluateJavascript(
                        "(function(){ return window.history.length; })()",
                        result -> {
                            int histLen = 1;
                            try { histLen = Integer.parseInt(result.trim()); } catch (Exception ignored) {}

                            if (histLen > 1) {
                                // Navigate back inside the app via JS history
                                webView.evaluateJavascript("window.history.back();", null);
                                // Reset double-back timer since we navigated within the app
                                backPressedTime = 0;
                            } else {
                                // At root screen — require double-back to exit
                                handleExitOnBack(this);
                            }
                        }
                    );
                } else {
                    handleExitOnBack(this);
                }
            }
        };

        getOnBackPressedDispatcher().addCallback(this, callback);
    }

    private void handleExitOnBack(OnBackPressedCallback callback) {
        if (backPressedTime + 2000 > System.currentTimeMillis()) {
            if (exitToast != null) exitToast.cancel();
            // Disable our callback so the system default (finish activity) runs
            callback.setEnabled(false);
            getOnBackPressedDispatcher().onBackPressed();
            callback.setEnabled(true); // Re-enable in case the user returns
        } else {
            exitToast = Toast.makeText(MainActivity.this, "Press back again to exit", Toast.LENGTH_SHORT);
            exitToast.show();
            backPressedTime = System.currentTimeMillis();
        }
    }
}
