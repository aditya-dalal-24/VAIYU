package com.cyclovision.controller;

import com.cyclovision.entity.Alert;
import com.cyclovision.repository.AlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/alerts", "/api/alerts"})
@RequiredArgsConstructor
public class AlertController {

    private final AlertRepository alertRepository;

    @GetMapping
    public ResponseEntity<List<Alert>> getActiveAlerts() {
        return ResponseEntity.ok(alertRepository.findAllByOrderByIssuedAtDesc());
    }
}
