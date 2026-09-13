package com.vaiyu.controller;

import com.vaiyu.ingestion.IbtracsImporter;
import com.vaiyu.security.AdminTokenGuard;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Loading the best-track archive into the database.
 *
 * <p>Protected, not merely named "internal": ingestion rewrites the archive
 * and reads a file from disk, so a caller must present the admin token (see
 * {@link AdminTokenGuard}). Re-running it is safe — the import inserts only
 * what is missing and fills columns added since a fix was first stored.
 *
 * <p>The table is always the one configured in
 * {@code vaiyu.ingest.observations-path}. An earlier version accepted a
 * {@code path} parameter, which let any caller make the server open any file
 * it could read and echoed the absolute path back in the error; the location
 * of a data file is a deployment decision, not a request parameter.
 */
@RestController
@RequestMapping("/api/internal/ingest")
public class IngestionController {

    private final IbtracsImporter importer;
    private final AdminTokenGuard admin;

    public IngestionController(IbtracsImporter importer, AdminTokenGuard admin) {
        this.importer = importer;
        this.admin = admin;
    }

    @PostMapping("/ibtracs")
    public IbtracsImporter.Summary ingest(
            @RequestHeader(value = AdminTokenGuard.HEADER, required = false) String token) {
        admin.require(token);
        return importer.importFrom(null);
    }
}
