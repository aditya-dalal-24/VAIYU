# CycloVision Command

Absolutely. Below is the complete, consolidated Lovable prompt. You can paste this as one prompt.

It explicitly tells Lovable to use the COSMO image as the visual reference, preserve the existing backend/API, redesign only the frontend, keep the existing Leaflet functionality, reserve the center for the interactive 3D hurricane globe, and make every frontend feature functional.

CYCLOVISION — COMPLETE LOVABLE FRONTEND PROMPT

PROJECT OVERVIEW

Build CycloVision, an AI-powered Tropical Cyclone Intelligence & Early Warning Platform.

CycloVision combines:

Real-time cyclone monitoring

Satellite Vision AI

Cyclone classification

Trajectory prediction

Intensity prediction

Landfall risk assessment

Historical cyclone similarity

Historical track comparison

Explainable AI

AI-generated situation reports

Alerts

Interactive 2D cyclone mapping

Interactive 3D Earth/hurricane visualization

The existing CycloVision architecture and backend are the source of truth for the application's data and functionality. The frontend should present these capabilities as one cohesive intelligence command center rather than as disconnected dashboards.

⚠️ CRITICAL RULE — FRONTEND ONLY

DO NOT MODIFY THE BACKEND

This is a frontend redesign and frontend functionality task only.

The existing backend must remain completely untouched.

DO NOT:

Modify backend code

Create backend endpoints

Modify API endpoints

Rename API endpoints

Change API request formats

Change API response formats

Modify database schemas

Modify PostgreSQL/PostGIS

Modify Spring Boot

Modify FastAPI

Modify ML models

Modify prediction algorithms

Modify classification algorithms

Modify risk calculations

Modify authentication

Replace backend services

Move backend logic into React

Create a second backend

Change existing backend data structures

IMPORTANT:

Use the existing backend exactly as it is.

The frontend should:

EXISTING BACKEND
       ↓
EXISTING API
       ↓
FRONTEND API LAYER
       ↓
REACT STATE
       ↓
UI / MAP / GLOBE / CHARTS

If an existing API already provides a value, display that value.

Do not recalculate or replace backend results inside the frontend.

1. VISUAL REFERENCE

Use the attached COSMO dashboard screenshot as the primary visual reference.

The screenshot controls the:

Composition

Layout

Card placement

Spacing

Typography

Visual hierarchy

Border style

Corner radius

Floating panels

Central hero visualization

Data density

Minimal aesthetic

DO NOT copy the Mars/desert theme.

Instead, reinterpret the exact visual style for:

CycloVision — AI Tropical Cyclone Intelligence

The final interface should feel like:

COSMO × NASA Mission Control × Advanced Meteorological Intelligence

Do not create a generic:

SaaS dashboard

Admin panel

Bootstrap dashboard

Weather website

Analytics template

The interface should feel like a premium operational intelligence system.

2. OVERALL VISUAL STYLE

Use:

Warm ivory / off-white background

Charcoal / near-black typography

Deep brown accents

Muted orange / amber for important cyclone information

Restrained red for warnings

Very subtle transparency

Thin borders

Rounded cards

Minimal shadows

Elegant modern typography

Large thin headings

Small technical labels

Compact data

Generous whitespace

Avoid:

Neon cyberpunk styling

Blue/purple SaaS gradients

Excessive glow

Excessive shadows

Giant tables

Dense admin layouts

Conventional left sidebar

Excessive colors

The screenshot should influence the composition, not just the colors.

3. MAIN DASHBOARD COMPOSITION

Recreate the structure of the reference image.

Use a desktop layout around 1440 × 900.

Conceptually:

┌──────────────────────────────────────────────────────────────┐
│ CYCLOVISION       Overview  Live Map  AI  Prediction ...   │
│                                                              │
│ ┌────────────┐       ┌──────────────────────┐ ┌────────────┐│
│ │ WEATHER    │       │                      │ │ RISK       ││
│ │ METRICS    │       │                      │ │            ││
│ ├────────────┤       │                      │ ├────────────┤│
│ │ SATELLITE  │       │     3D EARTH         │ │ PREDICTION ││
│ │ AI         │       │                      │ │            ││
│ ├────────────┤       │      🌀 HURRICANE    │ ├────────────┤│
│ │ TRAJECTORY │       │                      │ │ HISTORICAL ││
│ └────────────┘       │                      │ └────────────┘│
│                      └──────────────────────┘               │
│                         [ 3D ] [ 2D ]                       │
└──────────────────────────────────────────────────────────────┘

Most important rule:

Reserve the center of the dashboard for the interactive 3D Earth/hurricane globe.

Do not fill the center with cards.

Do not replace it with charts.

Do not turn it into a generic map.

The center should be the main visual focus.

4. TOP NAVIGATION

Create a minimal top navigation similar to the reference.

Left

Logo:

CYCLOVISION

Create a minimal cyclone-inspired geometric logo.

Center

Navigation:

Overview

Live Map

AI Analysis

Predictions

Historical

Alerts

Right

Display:

LIVE ●

Notification icon.

User/avatar icon.

Also include:

DEMO MODE

when demo mode is active.

Navigation must actually work using React Router.

5. TOP LEFT METRIC CARD

Create a compact card inspired by the reference.

Display:

140 KM/H
Wind Speed

960 HPA
Central Pressure

Also optionally show:

18.4°N
68.2°E
Current Position

The values must come from the selected cyclone/backend data.

The cyclone monitoring component is expected to expose wind speed, pressure, position, movement and intensity information.

6. TOP RIGHT METRIC CARD

Create another compact card.

Display:

74 / 100
Risk Score

78%
Prediction Confidence

Additional information:

Landfall Risk
HIGH

Coastal Risk
HIGH

Make the risk score visually prominent.

7. 🌍 CENTER — INTERACTIVE 3D EARTH / HURRICANE GLOBE

THIS IS THE SIGNATURE FEATURE.

Reserve approximately 50–60% of the main dashboard width for this.

Use:

Three.js

React Three Fiber

where appropriate.

The globe must:

Rotate slowly automatically

Stop rotating when manually controlled

Allow mouse drag

Allow zoom

Allow camera movement

Smoothly focus on selected cyclone

Display Earth

Display atmosphere

Display subtle clouds

Display latitude/longitude

Display active cyclone

Display cyclone eye

Display animated hurricane vortex

Display historical track

Display predicted track

Display forecast points

Display confidence corridor

Display coastal risk

Display potential landfall region

8. HURRICANE VISUALIZATION

The cyclone must NOT be represented only by a marker.

Create a visually impressive animated cyclone.

It should contain:

Spiral cloud structure

Visible eye

Rotating vortex

Particle/cloud movement

Pulsing center

Subtle atmospheric glow

Radar-style sweep

Current intensity indicator

The cyclone should look like a real tropical storm system viewed from space.

9. GLOBE CYCLONE MARKER

At the cyclone location display:

●
CYCLONE BIPARJOY
18.4°N 68.2°E
140 KM/H

Use:

Pulsing rings

Animated target marker

Small technical labels

Subtle radar effect

Clicking the cyclone should open detailed cyclone information.

10. HERO TITLE

Overlay the globe similarly to the reference.

Small pill:

LIVE CYCLONE

Large heading:

BIPARJOY /
ARABIAN SEA

Below:

VERY SEVERE CYCLONIC STORM

This should dynamically change based on the selected cyclone.

11. CYCLONE TRACK

Show the historical and forecast tracks on the globe.

Historical

Solid line.

Current

Animated cyclone marker.

Forecast

Dashed line.

Forecast points

+6H
+12H
+24H
+48H

Clicking a forecast point should show:

Latitude

Longitude

Forecast hour

Confidence radius

The existing CycloVision map already implements historical tracks, predicted tracks, forecast points and confidence data. Preserve this functionality.

12. CONFIDENCE CORRIDOR

Display a translucent forecast corridor around the predicted track.

It should widen with forecast horizon:

+6H    narrow
+12H   wider
+24H   wider
+48H   widest

Use the backend-provided confidence radius.

Do not invent a different calculation in the frontend.

The prediction data contains confidenceRadiusKm, which should drive this visualization.

13. 3D / 2D TOGGLE

At the bottom of the globe:

[ 3D GLOBE ] [ 2D MAP ]

3D GLOBE

Display the Three.js Earth.

2D MAP

Display the existing React Leaflet cyclone map.

Both modes must use the same selected cyclone and same backend data.

Switching between them must not reset the selected cyclone.

14. EXISTING 2D MAP — PRESERVE FUNCTIONALITY

Do not rebuild the existing map unnecessarily.

The existing map already supports:

Wind particle field

Prediction/trajectory toggle

Coastal risk zone toggle

Satellite/dark map switching

Historical track

Predicted track

Confidence corridor

Cyclone marker

Forecast markers

Forecast popups.

Restyle it to match the new COSMO-inspired interface.

15. LEFT PANEL — SATELLITE VISION

Create a large floating card.

Title:

Satellite Vision

Subtitle:

AI — LIVE ANALYSIS

Display:

Satellite image

Visible / Infrared / Water Vapor tabs

Cyclone detection

Eye formation

Structure score

AI confidence

Classification

Example:

CYCLONE DETECTED       ✓
EYE FORMED             ✓

87%
STRUCTURE

91%
CONFIDENCE

16. RUN AI ANALYSIS

Create:

RUN AI ANALYSIS

This button MUST work.

Flow:

RUN AI ANALYSIS
      ↓
ANALYZING...
      ↓
PROCESSING SATELLITE IMAGE...
      ↓
ANALYSIS COMPLETE

Then update the UI with the existing backend response.

Do not create a new AI model.

The documented satellite-analysis result contains cyclone detection, eye formation, structure score, classification, confidence and optional Grad-CAM output.

17. GRAD-CAM

If the existing backend returns Grad-CAM:

Display:

[ ORIGINAL ] [ AI HEATMAP ]

The heatmap should overlay the satellite image.

Show where the AI model focused when classifying the cyclone.

If Grad-CAM is unavailable, gracefully hide this feature rather than breaking the UI.

18. LEFT BOTTOM — TRAJECTORY

Create a floating card inspired by the 3D Projection panel in the reference.

Title:

Trajectory

Show a small trajectory visualization.

CURRENT → +6H → +12H → +24H → +48H

Display:

Direction

Distance traveled

Confidence

Forecast horizon

Button:

VIEW FORECAST

Clicking it should:

Activate prediction visualization

Focus the globe/map on the forecast

Show the confidence corridor

19. RIGHT PANEL — RISK ASSESSMENT

Create a large floating card.

Title:

Risk

Large:

HIGH

Then:

74 / 100
RISK SCORE

Additional:

LANDfall PROBABILITY
62%

PREDICTION CONFIDENCE
78%

COASTAL RISK
HIGH

Risk levels:

LOW

MODERATE

HIGH

CRITICAL

20. RISK INTERACTION

Clicking the Risk card should open a detailed risk panel.

Show:

Risk score

Risk level

Landfall probability

Distance to coast

Forecast confidence

Affected regions

Risk explanation

The risk display must use the backend risk result.

Do not create an independent frontend risk algorithm.

21. RIGHT PANEL — PREDICTION

Create:

Prediction

Tabs:

TRAJECTORY
INTENSITY

Trajectory

Display:

+6H

+12H

+24H

+48H

Coordinates

Confidence radius

Intensity

Display:

CURRENT
VERY SEVERE

+24H
INTENSIFY ↑

+48H
STABLE →

The documented MVP predicts both trajectory and intensity over these forecast horizons.

22. PREDICTION INTERACTION

Button:

PREDICT

Flow:

PREDICT
   ↓
GENERATING FORECAST...
   ↓
+6H
   ↓
+12H
   ↓
+24H
   ↓
+48H

Animate the trajectory progressively onto the globe/map.

Do not fake a new prediction calculation.

Use the existing backend prediction response.

23. RIGHT BOTTOM — HISTORICAL SIMILARITY

Create:

Historical Similarity

Large:

91%
SIMILARITY

Example:

CYCLONE FANI
2019

EXTREMELY SEVERE
ODISHA, INDIA

Show Top 3 historical matches.

Each should contain:

Similarity score

Cyclone name

Year

Intensity

Landfall

Impact summary

The historical module is designed around KNN/cosine similarity and returns the top three matches.

24. COMPARE BUTTON

Add:

COMPARE

When clicked:

CURRENT CYCLONE
        VS
HISTORICAL CYCLONE

Show:

Track overlay

Similarity score

Wind comparison

Pressure comparison

Intensity comparison

Landfall comparison

Impact

Historical and current tracks should appear together on the globe/map.

25. HISTORICAL TIME MACHINE

Add a timeline:

2018 ─── 2020 ─── 2022 ─── 2024 ─── 2026
                             ●
                           CURRENT

Allow:

Drag timeline

Play

Pause

Replay historical storm

Track animation

Change historical date

Display historical wind

Display historical pressure

This is one of the recommended WOW features.

26. EXPLAINABLE AI

Create an Explainability panel.

Show:

CLASSIFICATION
91%

TRAJECTORY
78%

INTENSITY
82%

RISK
74 / 100

Then:

Feature Importance

PRESSURE TREND
██████████ 42%

WIND SPEED
████████ 31%

SST
█████ 18%

STRUCTURE
███ 9%

Use backend-provided feature importance where available.

27. AI SITUATION REPORT

Create:

GENERATE SITUATION REPORT

When clicked:

GENERATING REPORT...

Then display a professional report panel containing:

Cyclone status

Current intensity

Current wind

Pressure

AI classification

Prediction

Intensity trend

Risk

Landfall possibility

Historical analog

Affected region

Key warning

Buttons:

REGENERATE
COPY REPORT
CLOSE

All buttons must work.

The AI report must only narrate structured backend outputs and must not invent scientific information.

28. ALERT SYSTEM

Create:

ACTIVE ALERTS

Display:

WARNING
High landfall risk detected.

WATCH
Rapid intensification conditions detected.

INFO
New satellite observation available.

Severity:

INFO

WATCH

WARNING

CRITICAL

Clicking an alert should open its details.

Allow filtering by severity.

29. LIVE WEATHER TELEMETRY

Display:

Wind speed

Pressure

Sea Surface Temperature

Humidity

Temperature

Movement direction

Movement speed

Coordinates

Use compact metric cards and subtle sparklines.

30. ACTIVE CYCLONES

Create a compact active-cyclone selector.

Example:

ACTIVE CYCLONES · 03

BIPARJOY
Arabian Sea
140 KM/H
HIGH

MOCHA
Bay of Bengal
118 KM/H
MODERATE

DEMO CYCLONE
Bay of Bengal
95 KM/H
LOW

Clicking a cyclone must:

Change selected cyclone.

Update globe.

Update map.

Update metrics.

Update satellite.

Update prediction.

Update risk.

Update historical similarity.

Update charts.

Update alerts.

Everything must remain synchronized.

31. MAP LAYER CONTROLS

In 2D map mode create:

LAYERS

☑ Wind Particles
☑ Historical Track
☑ Prediction
☑ Confidence Corridor
☑ Risk Zones
☐ Satellite

Every toggle must work.

The current map already implements these states and should retain them.

32. WIND PARTICLE FIELD

The existing frontend contains a WindParticleCanvas.

Preserve it.

Toggle:

WIND PARTICLE FIELD

ON

Particles visible.

OFF

Particles hidden.

Do not remove or replace the existing functionality.

33. SATELLITE MAP MODE

Existing map functionality allows switching between dark base and satellite imagery.

Keep this behavior.

Button:

SATELLITE VIEW

must switch:

Dark Base ↔ Satellite

34. FORECAST MARKERS

Forecast markers must remain interactive.

Clicking:

+24H

should display:

+24 HOURS

19.4°N
69.8°E

CONFIDENCE
±140 KM

The existing implementation already provides forecast marker popups.

35. CHARTS

Create interactive charts for:

Wind Speed

Line chart.

Pressure

Line chart.

Intensity

Forecast chart.

Distance to Coast

Line chart.

Prediction Confidence

Confidence chart.

Historical Comparison

Comparison chart.

Every chart must support:

Hover

Tooltip

Actual values

Time labels

Current position

Forecast position

Do not use static chart images.

36. WHAT-IF SIMULATION

If time permits, add:

WHAT-IF

Allow users to adjust:

SST

Wind

Pressure

Show model sensitivity results.

Clearly label:

MODEL SENSITIVITY ANALYSIS

Do not present this as a physics simulation.

This is an advanced/stretch feature in the project scope.

37. DATA SOURCES

Create a small status indicator:

DATA SOURCES · 06

● IBTrACS
● NOAA
● INSAT
● IMD
● Copernicus
● OpenWeather

Show whether the application is using:

LIVE

or:

DEMO

The documented architecture uses these sources across historical, satellite and weather components.

38. DEMO MODE

Do not modify the backend to implement demo mode.

If a frontend demo/fallback mechanism already exists, use it.

If frontend fallback is necessary, implement it only in the frontend.

Demo mode should allow the application to function if the backend or external data source is temporarily unavailable.

Use realistic cyclone scenarios with different:

Locations

Wind speeds

Pressure

Intensities

Tracks

Predictions

Risks

Historical analogs

Alerts

Satellite results

The documented architecture requires a demo-safe fallback because external data dependencies can fail during a presentation.

39. NO FAKE DATA RELATIONSHIPS

All displayed information must belong to the selected cyclone.

Use a frontend state structure conceptually like:

Selected Cyclone
│
├── Current Observation
├── Satellite Analysis
├── Classification
├── Prediction
├── Intensity Prediction
├── Risk
├── Historical Matches
├── Alerts
└── Report

When the selected cyclone changes, everything must update.

Do not display Cyclone A's location with Cyclone B's risk.

40. FRONTEND API LAYER

Create or preserve a clean frontend API layer:

src/
├── api/
│   ├── cycloneApi.ts
│   ├── predictionApi.ts
│   ├── satelliteApi.ts
│   ├── riskApi.ts
│   ├── historicalApi.ts
│   └── alertApi.ts

These modules must only consume existing backend APIs.

Do not create new backend endpoints to support these files.

Do not move business logic into them.

41. FRONTEND COMPONENT STRUCTURE

Use reusable components:

src/
├── api/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── dashboard/
│   ├── globe/
│   ├── map/
│   ├── cyclone/
│   ├── satellite/
│   ├── prediction/
│   ├── risk/
│   ├── historical/
│   ├── charts/
│   ├── alerts/
│   └── report/
├── pages/
├── hooks/
├── types/
├── utils/
├── constants/
└── routes/

42. TECH STACK

Use frontend technologies:

React

TypeScript

Vite

Tailwind CSS

React Router

Axios

TanStack Query

Three.js

React Three Fiber

React Leaflet

Recharts

Lucide Icons

Do not introduce a new backend technology.

43. LOADING STATES

Every backend-dependent frontend operation must have a polished loading state.

Examples:

LOADING CYCLONE...

ANALYZING SATELLITE...

GENERATING PREDICTION...

CALCULATING RISK...

FINDING HISTORICAL ANALOGS...

GENERATING SITUATION REPORT...

Use animations consistent with the COSMO visual style.

44. ERROR STATES

If an API request fails:

Do NOT destroy the interface.

Show:

DATA TEMPORARILY UNAVAILABLE

and use an existing frontend fallback/demo mechanism where available.

Never modify the backend to handle frontend errors.

45. BUTTONS MUST ACTUALLY WORK

This is NON-NEGOTIABLE.

No decorative buttons.

Required:

UI ElementRequired BehaviorSelect CycloneChanges active cyclone3D GlobeShows 3D Earth2D MapShows Leaflet mapRun AI AnalysisCalls existing API / frontend demo flowOriginal / HeatmapSwitches satellite visualizationPredictShows backend predictionTrajectorySwitches prediction viewIntensitySwitches intensity viewView ForecastFocuses forecastRiskOpens risk detailsHistoricalOpens historical analysisCompareOverlays historical stormPlayReplays historical stormPauseStops replayGenerate ReportGenerates/displays reportRegenerateRegenerates reportCopy ReportCopies reportAlertsOpens alert interfaceWind ParticlesToggles particlesPrediction ConeToggles confidence corridorRisk ZoneToggles risk polygonSatellite ViewSwitches map layerNavigationChanges pages

46. NO DEAD UI

Every visible button, tab, toggle, navigation item, card interaction, chart, map control and modal must have a working frontend behavior.

Do not leave:

TODO

Coming Soon

Fake buttons

Non-functional toggles

Static navigation

Placeholder interactions

If the backend isn't available for a specific action, use the existing frontend demo/fallback mechanism rather than making the UI non-functional.

47. RESPONSIVE DESIGN

Desktop is the primary experience.

Desktop

Use the complete COSMO-inspired composition.

Tablet

Rearrange panels around the globe.

Mobile

Use:

HEADER
↓
3D GLOBE
↓
CYCLONE STATUS
↓
RISK
↓
PREDICTION
↓
SATELLITE AI
↓
HISTORICAL
↓
ALERTS
↓
AI REPORT

Keep the globe as the primary visual.

48. CORE USER FLOW

The entire frontend should revolve around this flow:

SELECT CYCLONE
      ↓
VIEW 3D GLOBE
      ↓
ANALYZE SATELLITE
      ↓
CLASSIFY CYCLONE
      ↓
PREDICT TRAJECTORY
      ↓
PREDICT INTENSITY
      ↓
ASSESS LANDfall RISK
      ↓
FIND HISTORICAL ANALOGS
      ↓
COMPARE TRACKS
      ↓
EXPLAIN AI RESULTS
      ↓
GENERATE SITUATION REPORT
      ↓
VIEW ALERTS

Everything should be connected to the selected cyclone.

49. FINAL VISUAL HIERARCHY

Prioritize the UI in this exact order:

1. 🌍 3D Earth + Hurricane

2. 🌀 Current cyclone

3. ⚠️ Risk

4. 📈 Forecast trajectory

5. 🛰️ Satellite AI

6. 🔍 Historical similarity

7. 🔬 Explainable AI

8. 🤖 AI situation report

9. 🚨 Alerts

10. 📊 Supporting charts

50. HACKATHON WOW MOMENTS

Make these especially polished.

WOW #1 — Hurricane Globe

Earth rotates → user selects cyclone → camera smoothly moves to cyclone → hurricane vortex animates → forecast trajectory appears.

WOW #2 — Satellite AI

User clicks:

RUN AI ANALYSIS

Satellite image → loading → cyclone detection → classification → confidence → Grad-CAM.

WOW #3 — Forecast Reveal

User clicks:

PREDICT

The 6h → 12h → 24h → 48h trajectory progressively appears on the globe.

Confidence corridor expands with time.

WOW #4 — Historical Time Machine

User selects historical cyclone → track animates → overlay appears against current cyclone.

WOW #5 — AI Report

User clicks:

GENERATE SITUATION REPORT

Structured backend results become a clean decision-maker-friendly report.

These align with the documented WOW-feature priorities.

51. FRONTEND ACCEPTANCE TEST

Before considering the frontend complete, test this exact sequence:

1. Open Dashboard
        ↓
2. Select Cyclone
        ↓
3. Globe focuses on cyclone
        ↓
4. Rotate Globe
        ↓
5. Zoom Globe
        ↓
6. Switch 3D → 2D
        ↓
7. Switch 2D → 3D
        ↓
8. Toggle Wind Particles
        ↓
9. Toggle Prediction
        ↓
10. Toggle Risk Zone
        ↓
11. Switch Satellite View
        ↓
12. Run AI Analysis
        ↓
13. View AI Classification
        ↓
14. View Grad-CAM if available
        ↓
15. Run Prediction
        ↓
16. View +6H
        ↓
17. View +12H
        ↓
18. View +24H
        ↓
19. View +48H
        ↓
20. Click Forecast Point
        ↓
21. Open Risk
        ↓
22. Open Historical
        ↓
23. Click Compare
        ↓
24. Play Historical Track
        ↓
25. Generate Situation Report
        ↓
26. Copy Report
        ↓
27. Open Alerts
        ↓
28. Change Cyclone
        ↓
29. Verify ALL data updates

Every step must work without a full page reload.

52. FINAL NON-NEGOTIABLE INSTRUCTIONS

THIS IS A FRONTEND-ONLY TASK.

DO NOT MODIFY THE BACKEND IN ANY WAY.

DO NOT CHANGE API CONTRACTS.

DO NOT CREATE NEW BACKEND ENDPOINTS.

DO NOT CHANGE DATABASES OR ML MODELS.

DO NOT MOVE BACKEND LOGIC INTO THE FRONTEND.

Use the existing backend as the source of truth.

Use the attached COSMO image as the primary visual reference.

Recreate its composition and visual hierarchy for CycloVision.

Reserve the large central area for the interactive 3D Earth and hurricane.

Preserve the existing React Leaflet functionality.

Make the 3D globe and 2D map share the same selected cyclone and data.

Every button, toggle, tab, chart, map control, navigation item and interaction must work on the frontend.

If backend data is temporarily unavailable, use the existing frontend demo/fallback mechanism without modifying the backend.

Do not create fake functionality just for visual appearance.

The finished result must be a polished, functional CycloVision frontend that feels like a real tropical cyclone intelligence command center.

The signature interaction should be:

SELECT STORM → GLOBE → SATELLITE AI → CLASSIFY → PREDICT → RISK → HISTORICAL → EXPLAIN → REPORT.

Most important implementation priority

If there is a conflict between adding more features and making the existing features work properly, prioritize functional frontend behavior.

The priority should be:

1. Existing backend compatibility
2. Working 2D map
3. Working 3D globe area
4. Cyclone selection/state synchronization
5. Prediction/risk/satellite interactions
6. Historical comparison
7. AI report
8. Visual polish

Do not sacrifice backend compatibility to achieve the visual design.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cycloview-globe.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d4615d6f-5e0d-4059-b461-d42521d9556d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
