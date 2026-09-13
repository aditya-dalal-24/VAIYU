package com.vaiyu.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * The gate in front of operations that change the archive.
 *
 * <p>Ingestion rewrites the storm archive and reads a file from disk, so it is
 * not something an anonymous caller may trigger. Before this existed the
 * endpoint was "internal" only by the name in its URL: anyone who could reach
 * the backend could run it, and could point it at any file the process could
 * read.
 *
 * <p>Secure by default. With no token configured the operation is refused
 * outright rather than left open, so a deployment that forgets to set one
 * fails closed. The comparison is constant-time, so the token cannot be
 * recovered a character at a time from response timing.
 */
@Component
public class AdminTokenGuard {

    /** The header a caller presents the token in. */
    public static final String HEADER = "X-Admin-Token";

    /**
     * Shorter tokens are refused at startup-time use rather than accepted,
     * because a four-character secret guarding a destructive endpoint is not a
     * secret.
     */
    static final int MINIMUM_TOKEN_LENGTH = 24;

    private final byte[] expected;

    public AdminTokenGuard(@Value("${vaiyu.admin.token:}") String token) {
        String trimmed = token == null ? "" : token.trim();
        this.expected = trimmed.length() >= MINIMUM_TOKEN_LENGTH
                ? trimmed.getBytes(StandardCharsets.UTF_8)
                : null;
    }

    /** Whether admin operations are available at all in this deployment. */
    public boolean enabled() {
        return expected != null;
    }

    /**
     * Throws unless {@code presented} matches the configured token.
     *
     * <p>Two different failures, deliberately distinguishable: 403 when the
     * deployment has no token and the operation is switched off, 401 when it
     * has one and the caller did not present it. An operator debugging a
     * refusal needs to know which of those they are looking at.
     */
    public void require(String presented) {
        if (expected == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Admin operations are disabled: set VAIYU_ADMIN_TOKEN (at least "
                            + MINIMUM_TOKEN_LENGTH + " characters) to enable them.");
        }
        byte[] candidate = presented == null
                ? new byte[0]
                : presented.trim().getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(expected, candidate)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "A valid " + HEADER + " header is required.");
        }
    }
}
