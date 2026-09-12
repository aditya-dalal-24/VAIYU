package com.vaiyu.service;

import com.vaiyu.dto.StormDnaDto;
import com.vaiyu.entity.Cyclone;
import com.vaiyu.entity.CycloneObservation;
import com.vaiyu.exception.ResourceNotFoundException;
import com.vaiyu.repository.CycloneObservationRepository;
import com.vaiyu.repository.CycloneRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

/**
 * Comparing storms to each other.
 *
 * <p>The properties pinned here are the ones that decide whether a neighbour
 * list can be trusted: a storm is never its own neighbour, a storm with too
 * little measured about it is left out rather than ranked on thin evidence, and
 * the ordering actually follows the numbers.
 */
class StormDnaServiceTest {

    private static final Instant T0 = Instant.parse("2015-08-01T00:00:00Z");

    private CycloneRepository cyclones;
    private CycloneObservationRepository observations;
    private StormDnaService service;

    private final List<Cyclone> archive = new ArrayList<>();
    private final List<CycloneObservation> fixes = new ArrayList<>();

    @BeforeEach
    void setUp() {
        cyclones = mock(CycloneRepository.class);
        observations = mock(CycloneObservationRepository.class);
        service = new StormDnaService(cyclones, observations);

        given(cyclones.findAll()).willAnswer(invocation -> archive);
        given(observations.findAllForSignatures()).willAnswer(invocation -> fixes);
        given(observations.count()).willAnswer(invocation -> (long) fixes.size());
        given(cyclones.findById(any())).willAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            return archive.stream().filter(c -> c.getId().equals(id)).findFirst();
        });
        given(observations.findByCycloneIdOrderByObservedAtAsc(any())).willAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            return fixes.stream()
                    .filter(f -> f.getCyclone().getId().equals(id))
                    .toList();
        });
    }

    /**
     * Adds a storm of {@code fixCount} six-hourly fixes that strengthens at
     * {@code windStep} kph per fix while tracking north-west, which is enough
     * shape for every trait to be measurable.
     */
    private Cyclone addStorm(String name, int fixCount, double startWind, double windStep,
                             double startLat) {
        Cyclone cyclone = new Cyclone();
        cyclone.setId(UUID.randomUUID());
        cyclone.setName(name);
        cyclone.setExternalId(name + "-id");
        cyclone.setBasin("NI");
        cyclone.setSeasonYear(2015);
        archive.add(cyclone);

        for (int i = 0; i < fixCount; i++) {
            CycloneObservation observation = new CycloneObservation();
            observation.setId(UUID.randomUUID());
            observation.setCyclone(cyclone);
            observation.setObservedAt(T0.plus(Duration.ofHours(6L * i)));
            observation.setLatitude(startLat + i * 0.4);
            observation.setLongitude(88.0 - i * 0.25);
            observation.setWindSpeedKph(startWind + i * windStep);
            observation.setPressureHpa(1004.0 - i * windStep / 4);
            fixes.add(observation);
        }
        return cyclone;
    }

    @Test
    @DisplayName("an unknown storm id is a not-found, not an empty signature")
    void unknownStorm() {
        assertThatThrownBy(() -> service.dnaOf(UUID.randomUUID(), 5))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("a storm is never its own neighbour")
    void excludesItself() {
        Cyclone subject = addStorm("ALPHA", 20, 50, 6, 10.0);
        addStorm("BRAVO", 20, 52, 6, 11.0);

        StormDnaDto dna = service.dnaOf(subject.getId(), 10);

        assertThat(dna.neighbours()).isNotEmpty();
        assertThat(dna.neighbours())
                .noneSatisfy(n -> assertThat(n.cycloneId()).isEqualTo(subject.getId()));
    }

    @Test
    @DisplayName("the closest signature ranks first")
    void ordering() {
        Cyclone subject = addStorm("SUBJECT", 24, 50, 6, 10.0);
        Cyclone twin = addStorm("TWIN", 24, 51, 6, 10.2);
        Cyclone stranger = addStorm("STRANGER", 6, 120, -2, 24.0);

        StormDnaDto dna = service.dnaOf(subject.getId(), 5);

        assertThat(dna.neighbours()).isNotEmpty();
        assertThat(dna.neighbours().get(0).cycloneId()).isEqualTo(twin.getId());
        assertThat(dna.neighbours().get(0).distance())
                .isLessThan(dna.neighbours().get(dna.neighbours().size() - 1).distance());
        assertThat(dna.neighbours()).anySatisfy(
                n -> assertThat(n.name()).isIn("TWIN", "STRANGER"));
        assertThat(stranger.getId()).isNotNull();
    }

    @Test
    @DisplayName("every distance says how many traits it was computed from")
    void reportsTraitsCompared() {
        Cyclone subject = addStorm("ALPHA", 20, 50, 6, 10.0);
        addStorm("BRAVO", 20, 52, 6, 11.0);

        StormDnaDto dna = service.dnaOf(subject.getId(), 5);

        // These two synthetic storms share all nine traits but have identical
        // values for several of them, and a trait with no spread across the
        // archive carries no information. The count reports the traits the
        // distance actually came from, which is fewer than nine here and nine
        // in a real archive.
        assertThat(dna.neighbours()).allSatisfy(neighbour -> {
            assertThat(neighbour.traitsCompared()).isBetween(1, 9);
            assertThat(neighbour.distance()).isNotNaN().isNotNegative();
        });
        assertThat(dna.method()).contains("No model is involved");
    }

    @Test
    @DisplayName("a storm with too little measured about it is left out of the comparison")
    void thinStormsAreNotRanked() {
        Cyclone subject = addStorm("ALPHA", 20, 50, 6, 10.0);
        addStorm("BRAVO", 20, 52, 6, 11.0);

        // Two fixes at the same position and no wind at either: no peak, no
        // intensification rate, no peak timing and -- because it ended where it
        // began -- no crookedness. Five traits is below the floor, so it is
        // left out rather than ranked on what little it has. A two-fix track
        // that at least moved would clear the floor, and should.
        Cyclone sparse = new Cyclone();
        sparse.setId(UUID.randomUUID());
        sparse.setName("SPARSE");
        sparse.setExternalId("sparse-id");
        sparse.setBasin("NI");
        sparse.setSeasonYear(2015);
        archive.add(sparse);
        for (int i = 0; i < 2; i++) {
            CycloneObservation observation = new CycloneObservation();
            observation.setId(UUID.randomUUID());
            observation.setCyclone(sparse);
            observation.setObservedAt(T0.plus(Duration.ofHours(6L * i)));
            observation.setLatitude(9.0);
            observation.setLongitude(90.0);
            fixes.add(observation);
        }

        StormDnaDto dna = service.dnaOf(subject.getId(), 10);

        assertThat(dna.neighbours())
                .noneSatisfy(n -> assertThat(n.name()).isEqualTo("SPARSE"));
    }

    @Test
    @DisplayName("a storm too thin to place reports no neighbours rather than arbitrary ones")
    void thinSubjectGetsNoNeighbours() {
        addStorm("ALPHA", 20, 50, 6, 10.0);
        addStorm("BRAVO", 20, 52, 6, 11.0);

        Cyclone sparse = new Cyclone();
        sparse.setId(UUID.randomUUID());
        sparse.setName("SPARSE");
        sparse.setExternalId("sparse-id");
        sparse.setBasin("NI");
        sparse.setSeasonYear(2015);
        archive.add(sparse);
        CycloneObservation only = new CycloneObservation();
        only.setId(UUID.randomUUID());
        only.setCyclone(sparse);
        only.setObservedAt(T0);
        only.setLatitude(9.0);
        only.setLongitude(90.0);
        fixes.add(only);

        StormDnaDto dna = service.dnaOf(sparse.getId(), 5);

        assertThat(dna.neighbours()).isEmpty();
        assertThat(dna.comparedWith()).isZero();
        assertThat(dna.signature().limitations()).isNotEmpty();
    }

    @Test
    @DisplayName("the neighbour count is bounded whatever the caller asks for")
    void limitIsBounded() {
        Cyclone subject = addStorm("ALPHA", 20, 50, 6, 10.0);
        for (int i = 0; i < 8; i++) {
            addStorm("OTHER" + i, 20 + i, 48 + i, 6, 10.0 + i * 0.5);
        }

        assertThat(service.dnaOf(subject.getId(), 3).neighbours()).hasSize(3);
        assertThat(service.dnaOf(subject.getId(), 0).neighbours()).hasSize(1);
        assertThat(service.dnaOf(subject.getId(), 500).neighbours()).hasSize(8);
    }

    @Test
    @DisplayName("the index is rebuilt when the archive grows")
    void indexFollowsTheArchive() {
        Cyclone subject = addStorm("ALPHA", 20, 50, 6, 10.0);
        addStorm("BRAVO", 20, 52, 6, 11.0);

        assertThat(service.dnaOf(subject.getId(), 10).comparedWith()).isEqualTo(1);

        addStorm("CHARLIE", 22, 54, 5, 12.0);

        assertThat(service.dnaOf(subject.getId(), 10).comparedWith()).isEqualTo(2);
    }
}
