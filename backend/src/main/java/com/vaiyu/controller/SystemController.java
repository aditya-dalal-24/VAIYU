package com.vaiyu.controller;

import com.vaiyu.dto.SystemStatusDto;
import com.vaiyu.service.SystemStatusService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** What the system can do right now: model availability and data coverage. */
@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    private final SystemStatusService status;

    public SystemController(SystemStatusService status) {
        this.status = status;
    }

    @GetMapping("/status")
    public SystemStatusDto status() {
        return status.status();
    }
}
