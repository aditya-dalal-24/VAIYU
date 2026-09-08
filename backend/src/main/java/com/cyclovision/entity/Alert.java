package com.cyclovision.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Alert {

    @Id
    private String id;

    private String cycloneId;
    private String cycloneName;
    private String severity;

    @Column(length = 2000)
    private String message;

    private LocalDateTime issuedAt;

    @Column(length = 1000)
    private String affectedRegionsJson;
}
