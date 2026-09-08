package com.cyclovision;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CycloneApiTests {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void testGetEmptyCyclones() {
        ResponseEntity<List> response = restTemplate.getForEntity("/api/cyclones", List.class);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
    }

    @Test
    void testGetActiveCyclones() {
        ResponseEntity<List> response = restTemplate.getForEntity("/api/cyclones/active", List.class);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
    }

    @Test
    void testGetCycloneByIdNotFound() {
        UUID randomId = UUID.randomUUID();
        ResponseEntity<Map> response = restTemplate.getForEntity("/api/cyclones/" + randomId, Map.class);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("Not Found", response.getBody().get("error"));
    }

    @Test
    void testGetCycloneObservationsNotFound() {
        UUID randomId = UUID.randomUUID();
        ResponseEntity<Map> response = restTemplate.getForEntity("/api/cyclones/" + randomId + "/observations", Map.class);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
    }
}
