package com.vaiyu.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Stores uploaded satellite frames and serves them back over HTTP.
 *
 * <p>This exists because the AI service fetches imagery by URL rather than
 * accepting bytes in the analysis request — the contract keeps binaries out of
 * the JSON body. An uploaded file therefore has to be reachable at a URL before
 * it can be analysed, and that URL must be resolvable from the AI service,
 * which is what {@code vaiyu.public-base-url} is for.
 */
@Service
public class SatelliteImageStore {

    private static final Logger log = LoggerFactory.getLogger(SatelliteImageStore.class);

    /** Matches the AI service's own 12 MB ceiling on a fetched image. */
    public static final long MAX_BYTES = 12L * 1024 * 1024;

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", ".png",
            "image/jpeg", ".jpg",
            "image/jpg", ".jpg",
            "image/tiff", ".tif",
            "image/webp", ".webp");

    private final Path directory;
    private final String publicBaseUrl;

    public SatelliteImageStore(
            @Value("${vaiyu.satellite.storage-dir:./data/satellite-uploads}") String dir,
            @Value("${vaiyu.public-base-url:http://localhost:8081}") String publicBaseUrl) {
        this.directory = Path.of(dir).toAbsolutePath().normalize();
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    public record Stored(String id, String url, long bytes, String contentType) {
    }

    public Stored store(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("No image file was uploaded.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException(
                    "Image is larger than the 12 MB limit the AI service accepts.");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = EXTENSIONS.get(contentType);
        if (extension == null) {
            throw new IllegalArgumentException(
                    "Unsupported image type '" + contentType + "'. Supported: "
                            + String.join(", ", EXTENSIONS.keySet()));
        }

        // The declared content type comes from the client and proves nothing:
        // an HTML page labelled image/png would otherwise be stored and served
        // back from this API's own origin. The file's leading bytes must match
        // the format it claims to be.
        try (var in = file.getInputStream()) {
            byte[] head = in.readNBytes(12);
            if (!ImageSignatures.matches(contentType, head)) {
                throw new IllegalArgumentException(
                        "The file's contents are not a " + contentType + " image.");
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not read the uploaded image.", e);
        }

        String id = UUID.randomUUID() + extension;
        try {
            Files.createDirectories(directory);
            Path target = directory.resolve(id);
            file.transferTo(target);
            log.info("Stored satellite upload {} ({} bytes)", id, file.getSize());
        } catch (IOException e) {
            throw new IllegalStateException("Could not store the uploaded image.", e);
        }
        return new Stored(id, urlFor(id), file.getSize(), contentType);
    }

    public String urlFor(String id) {
        return publicBaseUrl + "/api/v1/satellite/images/" + id;
    }

    /**
     * Whether a URL points at an image this service stored and still holds.
     *
     * <p>This is what stops the analysis endpoint being a request-forgery
     * primitive. The AI service fetches whatever URL it is handed, from inside
     * the network, so an arbitrary caller-supplied URL would let anyone make it
     * fetch the database port, another internal service, or a cloud metadata
     * endpoint. Requiring the exact stored-image prefix and an id that resolves
     * to a real file in the upload directory closes that off.
     */
    public boolean isStoredImageUrl(String url) {
        if (url == null) {
            return false;
        }
        String prefix = publicBaseUrl + "/api/v1/satellite/images/";
        if (!url.startsWith(prefix)) {
            return false;
        }
        return load(url.substring(prefix.length())).isPresent();
    }

    public Optional<Resource> load(String id) {
        // Reject anything that could climb out of the upload directory.
        if (id == null || id.contains("/") || id.contains("\\") || id.contains("..")) {
            return Optional.empty();
        }
        Path path = directory.resolve(id).normalize();
        if (!path.startsWith(directory) || !Files.isReadable(path)) {
            return Optional.empty();
        }
        return Optional.of(new FileSystemResource(path));
    }
}
