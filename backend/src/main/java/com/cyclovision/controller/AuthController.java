package com.cyclovision.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @PostMapping("/oauth/{provider}")
    public ResponseEntity<Map<String, Object>> loginWithOAuth(
            @PathVariable String provider,
            @RequestBody(required = false) Map<String, Object> body) {
        
        Map<String, Object> user = new HashMap<>();
        if ("google".equalsIgnoreCase(provider)) {
            user.put("id", "usr-google-889");
            user.put("name", "Dr. Alkesh Sharma (Google SSO)");
            user.put("email", "alkesh.sharma@gmail.com");
            user.put("avatarUrl", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80");
            user.put("role", "METEOROLOGIST");
            user.put("title", "Lead Meteorological Officer");
            user.put("organization", "IMD Earth Command Hub");
            user.put("authProvider", "google");
        } else if ("github".equalsIgnoreCase(provider)) {
            user.put("id", "usr-github-2502");
            user.put("name", "Jay Gajjar (GitHub OAuth)");
            user.put("email", "jay.gajjar@github.com");
            user.put("avatarUrl", "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80");
            user.put("role", "ADMIN");
            user.put("title", "Principal AI Researcher & Engineer");
            user.put("organization", "Cyclone Detection Labs");
            user.put("authProvider", "github");
        } else {
            user.put("id", "usr-imd-001");
            user.put("name", "Dr. Alkesh Sharma");
            user.put("email", "alkesh.sharma@imd.gov.in");
            user.put("avatarUrl", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80");
            user.put("role", "METEOROLOGIST");
            user.put("title", "Lead Meteorological Officer");
            user.put("organization", "IMD Earth Command Hub");
            user.put("authProvider", "imd_sso");
        }

        Map<String, Object> response = new HashMap<>();
        response.put("token", "jwt-oauth-" + provider + "-" + System.currentTimeMillis());
        response.put("user", user);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser() {
        Map<String, Object> user = new HashMap<>();
        user.put("id", "usr-imd-001");
        user.put("name", "Dr. Alkesh Sharma");
        user.put("email", "alkesh.sharma@imd.gov.in");
        user.put("avatarUrl", "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80");
        user.put("role", "METEOROLOGIST");
        user.put("title", "Lead Meteorological Officer");
        user.put("organization", "IMD Earth Command Hub");
        user.put("authProvider", "imd_sso");

        return ResponseEntity.ok(user);
    }
}
