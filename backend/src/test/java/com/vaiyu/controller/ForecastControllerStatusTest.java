package com.vaiyu.controller;

import com.vaiyu.exception.GlobalExceptionHandler;
import com.vaiyu.exception.ResourceNotFoundException;
import com.vaiyu.service.PredictionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What each status code means on the forecast endpoints.
 *
 * <p>These distinctions are the whole reason the frontend can tell an empty
 * screen from a broken one, so they are pinned here rather than left to the
 * reading of whoever next edits the controller.
 */
@WebMvcTest(controllers = ForecastController.class)
@Import(GlobalExceptionHandler.class)
class ForecastControllerStatusTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private PredictionService predictions;

    @Test
    @DisplayName("a storm with no run yet is 204, not an error")
    void noRunYetIsNoContent() throws Exception {
        given(predictions.latest(any())).willReturn(Optional.empty());

        mvc.perform(get("/api/v1/cyclones/{id}/forecast/latest", UUID.randomUUID()))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("an unknown storm id is 404")
    void unknownStormIsNotFound() throws Exception {
        given(predictions.latest(any()))
                .willThrow(new ResourceNotFoundException("No cyclone with id x"));

        mvc.perform(get("/api/v1/cyclones/{id}/forecast/latest", UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode").value("NOT_FOUND"));
    }

    @Test
    @DisplayName("a malformed id is 400, not 500")
    void malformedIdIsBadRequest() throws Exception {
        mvc.perform(get("/api/v1/cyclones/not-a-uuid/forecast/latest"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a path with no endpoint is 404, not 500")
    void unmappedPathIsNotFound() throws Exception {
        mvc.perform(get("/api/cyclones"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("the wrong method on a real endpoint is 405, not 500")
    void wrongMethodIsMethodNotAllowed() throws Exception {
        mvc.perform(get("/api/v1/cyclones/{id}/forecast", UUID.randomUUID()))
                .andExpect(status().isMethodNotAllowed());
    }
}
