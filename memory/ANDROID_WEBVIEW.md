# GYAN RISE RANA — Android WebView Integration Guide

This document covers the architecture and required Android-side configuration
for a future native WebView wrapper. **No native code is shipped yet.** The web
app is already prepared to play nicely with a `WebView`.

## 1. Web-side preparations already done
- All routes are SPA-friendly (React Router with `BrowserRouter`).
- Backend is fully API-driven over HTTPS with JWT, no host-only assumptions.
- Watermark overlay (`VideoWatermark`) renders student name/email/timestamp on
  every video page and live class page. The element is `pointer-events: none`
  so it does not interfere with native controls.
- `meta[name="apple-mobile-web-app-capable"]`, `mobile-web-app-capable`,
  `theme-color` set in `public/index.html`.
- `-webkit-touch-callout: none` and `user-select: none` applied to the body
  so long-press doesn't open the "save image" sheet on protected media.

## 2. Required `WebView` setup (Java / Kotlin)
```java
WebView wv = findViewById(R.id.webview);
WebSettings s = wv.getSettings();
s.setJavaScriptEnabled(true);
s.setDomStorageEnabled(true);
s.setMediaPlaybackRequiresUserGesture(false);   // YouTube embeds
s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
s.setUserAgentString(s.getUserAgentString() + " GyanRiseRanaApp/1.0");
CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);
wv.loadUrl("https://your-deployment.example.com");
```

## 3. Screenshot & Screen-recording protection — `FLAG_SECURE`
Add this **before** `setContentView` in every Activity that hosts the WebView:
```java
getWindow().setFlags(
    WindowManager.LayoutParams.FLAG_SECURE,
    WindowManager.LayoutParams.FLAG_SECURE
);
```
Effect:
- Blocks screenshots (`Power + Volume-Down` returns a black image).
- Blocks screen recording on most Android versions/OEMs.
- Hides the activity content from the Recent Apps preview.
- Blocks casting/mirroring to external displays for the protected window.

Note: `FLAG_SECURE` is the OS-level guarantee; combined with the JS watermark
this gives two layers of anti-piracy.

## 4. Optional — Detect rooted / casting environments
Use `SafetyNet` or Play Integrity API and refuse to load video routes if
attestation fails. The web app provides a `window.gyanRise` namespace hook
(future) where the native app can inject `setSecureContext(true)` to enable
additional UI like the corner "DRM watermark active" badge.

## 5. Build-time settings
- Target SDK >= 33
- `android:hardwareAccelerated="true"` in the manifest
- `android:configChanges="orientation|screenSize"` on the WebView Activity
- ProGuard rules: keep WebChromeClient / WebViewClient
