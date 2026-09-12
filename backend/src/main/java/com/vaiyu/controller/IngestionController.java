package com.vaiyu.controller;

import com.vaiyu.ingestion.IbtracsImporter;
import org.springframework.web.bind.annotation.*;

/**
 * Loading the best-track archive into the database.
 *
 * <p>Internal on purpose: ingestion rewrites the archive, so it is not part of
 * the public surface. Re-running it is safe — the import inserts only what is
 * missing.
 */
@RestController
@RequestMapping("/api/internal/ingest")
public class IngestionController {

    private final IbtracsImporter importer;

    public IngestionController(IbtracsImporter importer) {
        this.importer = importer;
    }

    /**
     * @param path optional override of the observation table location; the
     *             default comes from vaiyu.ingest.observations-path
     */
    @PostMapping("/ibtracs")
    public IbtracsImporter.Summary ingest(@RequestParam(required = false) String path) {
        return importer.importFrom(path);
    }
}
