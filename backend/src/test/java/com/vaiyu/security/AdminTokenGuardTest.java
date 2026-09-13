package com.vaiyu.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The gate in front of archive ingestion. It must fail closed. */
class AdminTokenGuardTest {

    private static final String TOKEN = "0123456789abcdef0123456789abcdef";

    @Test
    @DisplayName("with no token configured, admin operations are refused rather than open")
    void failsClosedWhenUnset() {
        AdminTokenGuard guard = new AdminTokenGuard("");

        assertThat(guard.enabled()).isFalse();
        assertThatThrownBy(() -> guard.require(""))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("a token too short to be a secret disables the operation instead of guarding it")
    void rejectsWeakTokens() {
        AdminTokenGuard guard = new AdminTokenGuard("admin");

        assertThat(guard.enabled()).isFalse();
        assertThatThrownBy(() -> guard.require("admin"))
                .isInstanceOfSatisfying(ResponseStatusException.class,
                        e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("a missing or wrong token is 401")
    void rejectsWrongToken() {
        AdminTokenGuard guard = new AdminTokenGuard(TOKEN);

        for (String presented : new String[]{null, "", TOKEN + "x", TOKEN.substring(1)}) {
            assertThatThrownBy(() -> guard.require(presented))
                    .isInstanceOfSatisfying(ResponseStatusException.class,
                            e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
        }
    }

    @Test
    @DisplayName("the configured token is accepted")
    void acceptsTheToken() {
        AdminTokenGuard guard = new AdminTokenGuard(TOKEN);

        assertThatCode(() -> guard.require(TOKEN)).doesNotThrowAnyException();
    }
}
