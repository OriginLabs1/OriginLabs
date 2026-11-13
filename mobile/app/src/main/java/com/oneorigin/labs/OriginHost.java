package com.oneorigin.labs;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * The only bridge from the web surface to Android.
 *
 * It exposes save/share/copy/open-link. It deliberately exposes no file
 * reading, no network, no contacts and no arbitrary intents.
 */
public class OriginHost {
    private static final long MAX_EXPORT_BYTES = 64L * 1024L * 1024L;
    private static final Set<String> ALLOWED_HOSTS = new HashSet<>(Arrays.asList(
        "github.com",
        "www.github.com",
        "originlabs1.github.io",
        "apps.obtainium.imranr.dev"
    ));

    private final Activity activity;

    OriginHost(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String appVersion() {
        return "0.0.1";
    }

    @JavascriptInterface
    public String platform() {
        return "android-webview";
    }

    @JavascriptInterface
    public String saveExport(String name, String mime, String base64) {
        byte[] bytes = decode(base64);
        String safe = safeName(name);
        String type = safeMime(mime);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = activity.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
            values.put(MediaStore.MediaColumns.MIME_TYPE, type);
            values.put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                Environment.DIRECTORY_DOWNLOADS + "/OriginLabs"
            );
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("Could not create a Downloads entry");
            }
            try {
                OutputStream out = resolver.openOutputStream(uri);
                if (out == null) throw new IllegalStateException("Could not open the export");
                try {
                    out.write(bytes);
                } finally {
                    out.close();
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } catch (Exception error) {
                resolver.delete(uri, null, null);
                throw new IllegalStateException("Could not write the export: " + error.getMessage());
            }
            return "Downloads/OriginLabs/" + safe;
        }

        File dir = new File(activity.getExternalFilesDir(null), "exports");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Could not create the export directory");
        }
        File file = new File(dir, safe);
        try {
            FileOutputStream out = new FileOutputStream(file);
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
        } catch (Exception error) {
            throw new IllegalStateException("Could not write the export: " + error.getMessage());
        }
        return file.getAbsolutePath();
    }

    @JavascriptInterface
    public void shareExport(String name, String mime, String base64) {
        byte[] bytes = decode(base64);
        String safe = safeName(name);
        String type = safeMime(mime);

        File dir = new File(activity.getCacheDir(), "exports");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Could not create the share directory");
        }
        File file = new File(dir, safe);
        try {
            FileOutputStream out = new FileOutputStream(file);
            try {
                out.write(bytes);
            } finally {
                out.close();
            }
        } catch (Exception error) {
            throw new IllegalStateException("Could not prepare the share: " + error.getMessage());
        }

        final Uri uri = Uri.parse(
            "content://" + ExportProvider.AUTHORITY + "/" + Uri.encode(safe)
        );
        activity.runOnUiThread(() -> {
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(type);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share OriginLabs export");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(chooser);
        });
    }

    @JavascriptInterface
    public boolean openExternal(String url) {
        try {
            return openExternalUri(activity, Uri.parse(url));
        } catch (Exception error) {
            return false;
        }
    }

    static boolean openExternalUri(Activity activity, Uri uri) {
        if (uri == null) return false;
        if (!"https".equals(uri.getScheme())) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.US);
        if (!ALLOWED_HOSTS.contains(host)) return false;

        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(intent);
            return true;
        } catch (Exception error) {
            return false;
        }
    }

    @JavascriptInterface
    public void copy(String text) {
        final String value = text == null ? "" : text;
        activity.runOnUiThread(() -> {
            ClipboardManager manager =
                (ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
            if (manager != null) {
                manager.setPrimaryClip(ClipData.newPlainText("OriginLabs", value));
            }
        });
    }

    @JavascriptInterface
    public void toast(String message) {
        final String value = message == null ? "" : message;
        activity.runOnUiThread(() ->
            Toast.makeText(activity, value, Toast.LENGTH_SHORT).show()
        );
    }

    private static byte[] decode(String base64) {
        if (base64 == null || base64.isEmpty()) {
            throw new IllegalArgumentException("The export is empty");
        }
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        if (bytes.length > MAX_EXPORT_BYTES) {
            throw new IllegalArgumentException("The export is larger than 64 MB");
        }
        return bytes;
    }

    private static String safeName(String name) {
        String base = name == null || name.trim().isEmpty() ? "originlabs-export.json" : name.trim();
        base = base.replaceAll("[^A-Za-z0-9._-]", "_");
        if (base.startsWith(".")) base = "_" + base;
        if (base.length() > 120) {
            String tail = base.substring(base.length() - 110);
            base = "originlabs-" + tail;
        }
        return base;
    }

    private static String safeMime(String mime) {
        if (mime == null || mime.trim().isEmpty()) return "application/octet-stream";
        String value = mime.trim().toLowerCase(Locale.US);
        if (!value.matches("[a-z0-9.+-]+/[a-z0-9.+-]+")) return "application/octet-stream";
        return value;
    }
}
