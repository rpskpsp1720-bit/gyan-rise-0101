# GYAN RISE — ProGuard rules
# Keep Capacitor + WebView bridge classes that may be referenced via reflection.

-keep class com.getcapacitor.** { *; }
-keep class com.gyanrise.lms.** { *; }
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Remove all logging from release builds (defense-in-depth)
-assumenosideeffects class android.util.Log {
    public static *** v(...);
    public static *** d(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}
