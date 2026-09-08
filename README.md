# CycloVision - Tropical Cyclone Intelligence & Early Warning Platform

![CycloVision Platform](https://img.shields.io/badge/System-Active-emerald?style=for-the-badge)
![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203.2.4-6DB33F?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/AI%20Service-FastAPI-009688?style=for-the-badge)

CycloVision is a multi-modal AI platform for tropical cyclone detection, intensity classification, spatial trajectory forecasting, risk assessment, and disaster decision support.

---

## Key Features

1. **Interactive Earth Wind Particle Visualizer Canvas**: Inspired by [earth.nullschool.net](https://earth.nullschool.net/), real-time HTML5 vector particle animation overlay simulating wind velocity streams.

2. **AI Vision & Grad-CAM Heatmaps**: PyTorch ResNet-34 transfer learning model detecting cyclone formation, eye center cluster, and class activation maps.

3. **Trajectory & Intensity Forecasting Engine**: Hybrid Kalman Filter + historical state interpolation (6h-12h) + XGBoost regression model (24h-48h) with visual uncertainty cones.

4. **KNN Historical Storm Similarity Engine**: Nearest Neighbors matching against 10,000+ IBTrACS cyclone track embeddings to provide analog storm comparisons.

5. **Rule-Based Coastal Risk Scoring**: Spatial risk formula calculating threat levels based on landfall proximity, central pressure deficit, and sustained wind speed.

6. **Automated AI Situation Reports**: Emergency operational briefs outlining hazards, evacuation zones, and response actions.

---

## System Architecture

```text
React Frontend (Vite + TS + Tailwind + Leaflet + Wind Canvas)
                        |
                        v
                  REST APIs
                        |
                        v
Spring Boot Backend (Java 17, JPA, Risk Engine, Fallback Data Seeder)
                        |
                        v
FastAPI AI Service (PyTorch ResNet, XGBoost, Kalman Filter, KNN Engine)