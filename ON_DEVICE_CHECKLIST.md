# On-Device Physical AR/VPS Checklist

This checklist is designed for physical field testing at the CIT campus. The simulated environment cannot account for real hardware compass drift, camera sensor jitter, or lighting conditions.

## 1. Environmental Tests

| Test Scenario | Expected Result | Pass/Fail | Notes |
|---|---|---|---|
| **Outdoors, Clear Sky** | GPS locks within 3-5 seconds; Anomaly placed accurately. | [ ] | Baseline test. |
| **Indoors (Corridor/Lab)** | GPS may drift; AR anchor should rely more heavily on gyro/compass to maintain position. | [ ] | Test near windows vs deep indoors. |
| **Low Light / Evening** | Camera feed may get grainy, but 3D model should remain clearly visible and tracking should not violently snap. | [ ] | AR tracking heavily depends on optical feature points. |
| **Dense Crowd (Canteen)** | Moving people in the camera frame should not cause the 3D model to teleport erratically. | [ ] | |

## 2. AR / VPS Mechanics

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| **A** | **Launch & Center:** Open AR mode while facing North. Tap an anomaly on the radar. | The 3D model appears in front of you. `ScrX` and `ScrY` hover around 50%. | [ ] |
| **B** | **Panning Inversion Check:** Keep the camera flat and rotate your body 90 degrees to the **Right** (facing East). | The anomaly should slide off to the **Left** of your screen. A "TURN LEFT" UI indicator appears. | [ ] |
| **C** | **Vertical Axis:** Tilt the phone camera downwards toward the floor. | The anomaly should slide **Up** towards the top of the screen. | [ ] |
| **D** | **Distance Scaling:** Walk slowly backward 10-15 meters away from the spawned anomaly. | The 3D model should scale down (shrink) simulating physical distance. | [ ] |
| **E** | **Compass Wrap-Around:** Do a full 360-degree spin in place. | The anomaly smoothly exits and re-enters the screen on the correct side without jittering across the 359-to-0 degree boundary. | [ ] |
| **F** | **Background Re-entry:** Minimize the app to the home screen for 10 seconds, then reopen. | The AR session recovers gracefully without crashing. Model is still anchored to the same compass direction. | [ ] |

## 3. Battery & Thermal Benchmarks

- Start a session with at least 80% battery. 
- Play continuously (walking, capturing, rendering AR) for **20 minutes**.
- **Metrics to Record:**
  - Starting Battery %: ______
  - Ending Battery %: ______
  - Device Temperature: [Cool / Warm / Hot / Throttling/Lagging]
- **Acceptable Limit:** Max 15% drain in 20 minutes on modern hardware. If the device becomes too hot to hold comfortably, the Three.js rendering loop needs frame-limiting optimization.
