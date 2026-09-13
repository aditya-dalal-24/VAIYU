package com.vaiyu.service;

import java.util.Arrays;

/**
 * Magic bytes for the image formats uploads are allowed to be.
 *
 * <p>A client-declared content type is a claim, not evidence. Checking the
 * first bytes of the file is cheap and closes the case that matters: a non-image
 * file uploaded under an image label and then served from this API's origin.
 */
final class ImageSignatures {

    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};
    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF};
    private static final byte[] TIFF_LITTLE = {'I', 'I', 0x2A, 0x00};
    private static final byte[] TIFF_BIG = {'M', 'M', 0x00, 0x2A};
    private static final byte[] RIFF = {'R', 'I', 'F', 'F'};
    private static final byte[] WEBP = {'W', 'E', 'B', 'P'};

    private ImageSignatures() {
    }

    static boolean matches(String contentType, byte[] head) {
        if (contentType == null || head == null) {
            return false;
        }
        return switch (contentType) {
            case "image/png" -> startsWith(head, PNG, 0);
            case "image/jpeg", "image/jpg" -> startsWith(head, JPEG, 0);
            case "image/tiff" -> startsWith(head, TIFF_LITTLE, 0) || startsWith(head, TIFF_BIG, 0);
            // WEBP is a RIFF container: "RIFF", four size bytes, then "WEBP".
            case "image/webp" -> startsWith(head, RIFF, 0) && startsWith(head, WEBP, 8);
            default -> false;
        };
    }

    private static boolean startsWith(byte[] data, byte[] signature, int offset) {
        if (data.length < offset + signature.length) {
            return false;
        }
        return Arrays.equals(data, offset, offset + signature.length,
                signature, 0, signature.length);
    }
}
