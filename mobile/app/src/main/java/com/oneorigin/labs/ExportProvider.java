package com.oneorigin.labs;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.Locale;

/**
 * Read-only content provider for exports written to the app cache.
 * Used by the Android share sheet without adding a FileProvider dependency.
 */
public class ExportProvider extends ContentProvider {
    public static final String AUTHORITY = "com.oneorigin.labs.exports";

    private File exportsDir() {
        return new File(getContext().getCacheDir(), "exports");
    }

    private File resolve(Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null) return null;
        name = Uri.decode(name);
        if (!name.matches("[A-Za-z0-9._-]{1,120}")) return null;
        try {
            File dir = exportsDir().getCanonicalFile();
            File file = new File(dir, name).getCanonicalFile();
            if (!dir.equals(file.getParentFile())) return null;
            return file;
        } catch (Exception error) {
            return null;
        }
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(
        Uri uri,
        String[] projection,
        String selection,
        String[] selectionArgs,
        String sortOrder
    ) {
        File file = resolve(uri);
        if (file == null || !file.isFile()) return null;
        MatrixCursor cursor = new MatrixCursor(
            new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }
        );
        cursor.addRow(new Object[] { file.getName(), file.length() });
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        File file = resolve(uri);
        if (file == null) return "application/octet-stream";
        String name = file.getName();
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return "application/octet-stream";
        String extension = name.substring(dot + 1).toLowerCase(Locale.US);
        String type = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        return type == null ? "application/octet-stream" : type;
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Exports are created by OriginHost");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = resolve(uri);
        if (file == null || !file.isFile()) {
            throw new FileNotFoundException("Unknown export");
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }
}
