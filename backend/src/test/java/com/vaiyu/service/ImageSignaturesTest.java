package com.vaiyu.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/** A declared image type is a claim; the leading bytes are the evidence. */
class ImageSignaturesTest {

    private static byte[] bytes(int... values) {
        byte[] out = new byte[12];
        for (int i = 0; i < values.length; i++) {
            out[i] = (byte) values[i];
        }
        return out;
    }

    @Test
    @DisplayName("real headers of each allowed format are accepted")
    void acceptsRealImages() {
        assertThat(ImageSignatures.matches("image/png",
                bytes(0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'))).isTrue();
        assertThat(ImageSignatures.matches("image/jpeg", bytes(0xFF, 0xD8, 0xFF, 0xE0))).isTrue();
        assertThat(ImageSignatures.matches("image/tiff", bytes('I', 'I', 0x2A, 0x00))).isTrue();
        assertThat(ImageSignatures.matches("image/tiff", bytes('M', 'M', 0x00, 0x2A))).isTrue();
        assertThat(ImageSignatures.matches("image/webp",
                bytes('R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P'))).isTrue();
    }

    @Test
    @DisplayName("an HTML page labelled as an image is refused")
    void refusesDisguisedHtml() {
        byte[] html = "<html><body>".getBytes(StandardCharsets.US_ASCII);

        assertThat(ImageSignatures.matches("image/png", html)).isFalse();
        assertThat(ImageSignatures.matches("image/jpeg", html)).isFalse();
    }

    @Test
    @DisplayName("a real image under the wrong label is refused")
    void refusesMislabelled() {
        assertThat(ImageSignatures.matches("image/png", bytes(0xFF, 0xD8, 0xFF, 0xE0))).isFalse();
    }

    @Test
    @DisplayName("a file too short to carry a signature is refused")
    void refusesTruncated() {
        assertThat(ImageSignatures.matches("image/png", new byte[]{(byte) 0x89, 'P'})).isFalse();
    }
}
