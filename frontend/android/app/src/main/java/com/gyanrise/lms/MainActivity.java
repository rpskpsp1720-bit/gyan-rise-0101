package com.gyanrise.lms;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * GYAN RISE Android shell.
 *
 * Security hardening applied here:
 *   FLAG_SECURE — set on the Activity's window at the earliest possible
 *                 point in onCreate(), BEFORE super.onCreate() and BEFORE
 *                 setContentView(). This single flag blocks:
 *
 *                   1. Native screenshot (volume-down + power)
 *                   2. Screen recording (system + 3rd-party recorders)
 *                   3. Mirroring to external displays / Google Cast
 *                   4. Thumbnail preview in the Recent Apps switcher
 *                      (shows a black/blurred placeholder instead)
 *                   5. Assist actions (Google Assistant "What's on my screen")
 *
 * Coverage: applying FLAG_SECURE on the SINGLE BridgeActivity that hosts
 * the entire Capacitor WebView automatically protects EVERY screen of
 * the web app — login, signup, forgot-password, dashboards, batches,
 * subjects, videos, notes, tests, live classes, admin panel — because
 * they all render inside this same Activity's window.
 *
 * This flag cannot be bypassed by the user and persists through every
 * lifecycle transition (onResume, onPause, configuration changes).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Block screenshots, screen recording, recent-apps preview,
        // and mirroring on every screen rendered by the WebView.
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );
        super.onCreate(savedInstanceState);
    }

    /**
     * Defensive: re-apply FLAG_SECURE on every resume in case any
     * plugin or temporary dialog ever clears it.
     */
    @Override
    protected void onResume() {
        super.onResume();
        getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
        );
    }
}
