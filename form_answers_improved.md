A summary of the **main improvements and changes implemented since Phase 2**, including the main technical challenges encountered and how they were addressed.

**Main improvements and changes since the previous phase**

1. **Hardware moved from design to a working prototype:** The orthosis was designed in CAD, 3D-printed and assembled. The custom EMG circuit and the discrete stimulation chain (DAC, current source, H-bridge) were replaced by ready-made EMG and NMES modules. The EMG module was tested on a real muscle and the NMES module on a dummy load. Hardware safety was added: battery-only stimulation, isolated control lines, a latching STOP button, current monitoring with a hardware trip, a hardware watchdog and a USB lockout.

2. **Firmware completed:** It runs as two tasks on separate cores, so communication cannot delay stimulation. It includes the session state machine, a 100 ms supervision loop that checks the delivered current, sensor fusion, repetition counting and a safe-stop on any fault. Before each contraction the patient pushes with the stimulator off; the EMG measured in that window sets the current for that contraction between a clinician-set floor and the approved ceiling (a PI-type assist rule). A fixed dose at the floor is the fallback whenever a check fails.

3. **AI redesigned around the clinician:** The AI no longer changes stimulation by itself. Before each day's sessions it suggests three parameters: the intensity ceiling, the rest time and the number of contractions, each with its two main reasons. The physiotherapist accepts or overrides each one, and every decision is logged to retrain the model.

4. **NMES parameters aligned with a published post-TKA protocol:** Values follow that protocol: 50 Hz, 250 µs, 15 s hold with 3 s ramp up and 2 s ramp down, twice daily for 6 weeks from 48 h after surgery, seated with the knee at 60°. The firmware locks these limits, and only three parameters adapt to the patient.

5. **Software built:** A mobile app, a web dashboard and a backend run locally. They include a patient view of the approved plan with comfort and pain feedback, and a clinician panel to approve the plan with charts and the decision log. Plans carry a patient ID, version, expiry and checksum, which the brace checks before use.

**Main technical challenges and how they were addressed**

1. **Building the EMG and stimulation electronics from scratch was too risky for the deadline.** A custom EMG circuit and a discrete stimulator would have taken too long to finish and validate safely. They were replaced by ready-made modules, tested on a real muscle and on a dummy load.

2. **No TKA patient data was available to train the AI.** A physiology-based simulator was built to generate virtual patients over 6 weeks. All AI results are clearly labelled as simulated, and the pipeline is ready to retrain on real recordings.

3. **A fully autonomous AI would be hard to trust and to justify on safety grounds.** The AI now only suggests and explains each value. The clinician validates every parameter, and rule-based safety limits clamp each suggestion before it is shown.

4. **The AI must not add delay to the real-time loop.** The real-time control runs on the brace, while the AI runs on the backend between sessions. A compact version of the model was exported to the backend and gives the same results as the original Python model (300 of 300 test cases).

5. **Stimulation had to stay safe even if the software failed.** Every critical protection also works in hardware: the STOP button, USB lockout, over-current trip and watchdog.

6. **Some Phase 1 assumptions did not match clinical practice or the sensors.** Stimulating during walking and adjusting many parameters were dropped after a literature review: sessions are seated and isometric, with frequency, pulse width and ramps fixed at protocol values. We also found that EMG recorded while current flows is dominated by the stimulation response, so the controller reads the patient's own EMG only with the stimulator off, and uses the 100 ms loop to supervise current.

A **Safety Checklist** covering potential risks, user controls, limitations, safe operation, and relevant emergency procedures.

**Potential risks**

* Burn or pain from excess current: approved ceiling (capped at 50 mA), 60 mA firmware cut, 65 mA hardware cut
* Electric shock: battery-only stimulation, isolated control lines, stimulation blocked while charging
* Software failure: hardware watchdog switches stimulation off
* Detached electrode: detected, stimulation stops
* AI intensity too high: at most +10 mA per session, lowered after pain, clinician approval required
* Wrong or stale plan: patient ID, version, expiry and checksum checked; a plan expires after 36 h by default
* Wrong posture or a sensor fault: stimulation does not start, or stops

**User controls**

* Red STOP button cuts stimulation in under 10 ms
* Comfort (0–3) and pain (0–10) rating after each session
* Clinician approves or overrides every parameter; nothing unapproved is applied

**Safe operation**

* First session at the clinic with the physiotherapist
* Check contraindications first: pacemaker or implanted stimulator, active deep vein thrombosis, damaged skin, wound or infection under the electrodes, impaired circulation, malignancy in the treated area, uncontrolled epilepsy, inability to use the STOP button, no surgeon clearance (use only from 48 h after surgery)
* Sit with the knee at 60°; check the skin and electrodes before use
* Unplug the charger and let the self-test finish
* Maximum 2 sessions per day, at least 3 h apart, approved plan only; the brace enforces this

**Emergency procedures**

* Pain or burning: press STOP, remove the electrodes, report it in the app, contact the physiotherapist
* Calf swelling or pain: stop and see a doctor urgently (possible thrombosis)
* Chest pain or dizziness: press STOP and call emergency services
* Smoke, heat or a device fault: press STOP, switch off, do not reuse until checked

**Limitations**

* Research prototype, not certified and not a medical device. No stimulation has been applied to a person
* AI trained and tested on simulated data only; clinician validation always required
* The controller does not measure force; it sets a bounded current from the patient's EMG
* Seated isometric exercises only; not for use while walking

A description of the **current results and limitations** of your solution, including any remaining technical constraints or areas requiring further improvement.

**Current results**

*Hardware and firmware*

* The orthosis is designed, 3D-printed and assembled, with the electronics mounted on it.
* The sEMG module has been tested on a real muscle and gives clean RMS and median-frequency readings.
* Knee angle is measured by fusing the hinge potentiometer with the IMU. The filter was tuned against a goniometer.
* The NMES module has been tested on a dummy load across the TODO(team: state the current range actually tested on the dummy load; the module maximum is 57.6 mA and the plan cap is 50 mA) range.
* All safety layers are implemented: the hardware 65 mA trip, the 60 mA firmware cut, the enable gate, the STOP button, the USB lockout and the watchdog. They have not yet been verified on the assembled device.
* The firmware is complete. It covers the session state machine, the 100 ms supervision loop, the assist rule, Model A running on the board, and logging.

*AI layer (tested on simulated patients only)*

* Model A classifies muscle state with 93.5 % accuracy (simulated).
* Model B suggests the next session's settings:
  * Intensity ceiling within 5 mA of the ideal value in 97 % of sessions, against 56 % for the fixed protocol (simulated).
  * Rest time exact in 86 % of sessions and always within one step (simulated).
  * Number of contractions exact in 93 % of sessions (simulated).
* Clinicians accepted all three suggestions in 64 % of sessions at first, and in 92 % after the model was retrained on their decisions (simulated clinician).
* Compared with the fixed protocol, painful sessions dropped from 47 % to 1 % in simulation, with slightly higher muscle activation at week 6 (85 % vs 83 %).
* Model C predicts knee bend at week 6 within 2.2° on average (simulated). Its alert for patients likely to stay below 110° is correct 90 % of the time (simulated).
* These figures check that the loop behaves as designed; they say nothing about real patients.

*Software*

* The patient app, the clinician dashboard and the backend all run locally. The full suggest → approve or override → log → retrain loop works.
* The compact model in the backend gives the same results as the original Python model (300 of 300 test cases).

**Limitations**

* The AI has been trained and tested only on simulated data. It has never been tested on real patients or on real clinicians' decisions. The simulator was built by our team, so these results check the loop, not clinical accuracy.
* Stimulation has not been tested on a person. The NMES module has only been tested on a dummy load.
* Our protocol stimulates while the patient also contracts the muscle. The published protocols we followed stimulate a muscle at rest, so our approach is not clinically validated yet.
* The controller does not measure force, so it cannot show that a contraction reached a target. The EMG-based assist rule uses design values for its gains, not tuned ones.
* The clinician approves the plan once a day (valid for 36 h), which still adds workload that we have not tested in practice.
* The device is a prototype and has no medical certification. We design with reference to IEC 60601-1, IEC 60601-2-10 and ISO 14971, but do not claim conformity.

**Remaining technical constraints**

* The Bluetooth link between the brace and the phone is still being finished, so the full system has not been tested end to end. A USB-serial transfer is the fallback.
* The ESP32's built-in analog-to-digital converter is not linear, which limits angle accuracy. An external ADS1115 converter with a 5-point calibration is the planned fix.
* The EMG signal is sensitive to motion artifacts and to where the electrodes are placed, and the NMES module may add interference. We have not yet measured that interference; the first test will be EMG from a volunteer, with no stimulation on the volunteer, while the module drives a dummy load.
* Data is stored in a local file, with no hosted database and only basic security.
* We have not yet run fault-injection tests on the complete assembled device.

**Areas for improvement**

* Finish the Bluetooth link and test the whole system end to end.
* Run fault-injection tests on the assembled safety chain.
* Collect EMG data from healthy volunteers (no stimulation) and retrain the models with real clinician decisions.
* Add a force sensor to study the relation between EMG and force; self-tuning of the controller gains is a planned future step that needs that signal.
* Move to a secure hosted database and consider auto-renewing approved plans to reduce the clinician's workload.
* Prepare an ethics-approved pilot study with TKA patients.
