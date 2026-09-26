# CardioFlow MCS — video script

ACC Cardio Sim Creator Competition. Target 4:00, inside the 3–5 minute limit.
Narration is ~620 words, which is a calm ~155 wpm.

**Three brackets below are yours to fill or cut.** They are marked `[ ]` and they are all
in the integration block, which is the criterion this entry is weakest on.

Recording: Chrome, 1920×1080, full screen, one browser for the whole take.
Press `?` in the app for the key list.

---

## 0:00 – 0:30 · The problem

**ON SCREEN** Black. A single monitor-style MAP number climbing 62 → 81. Hold two seconds.
Then LVEDP fades in beside it, also climbing, 20 → 26.

> A patient in cardiogenic shock goes on VA-ECMO. The mean arterial pressure comes up.
> The team relaxes.
>
> But the left ventricle is now ejecting against a higher pressure than before. It empties
> less. Filling pressure climbs. The number on the monitor got better — and the ventricle
> got worse.
>
> Trainees learn these devices as a list of flow rates. They don't learn that trade-off
> until a patient distends in front of them.

---

## 0:30 – 1:20 · One patient, properly

**ON SCREEN** App opens in **solo** on S0. Let the ventricle beat for three seconds before
saying anything — wall thickening, valve opening and shutting. Then press `4`. Let the
orange badge run and clear.

> This is that patient. One ventricle, contracting against one aorta.
>
> Watch the aortic valve. It opens, blood leaves, it shuts. The ventricle wall thickens as
> it squeezes. Everything you see is driven by the model — stop the simulation and the
> picture stops with it.
>
> Now VA-ECMO at four litres.

*(pause while the badge is up)*

> Time is compressed eight-fold while the circulation equilibrates. The tick is unchanged
> and no time constant was shortened; we're just drawing fewer frames per simulated second.

*(badge clears)*

> Mean pressure, sixty-two to eighty-one. Filling pressure, twenty to twenty-six.
>
> And look at the valve. It's barely opening now. That is the afterload problem, made
> physical — the ventricle can no longer clear the pressure the circuit has created.

---

## 1:20 – 1:45 · The chain

**ON SCREEN** Stay in solo. Cursor moves along the chain strip at the bottom, left to right.
Optionally click the **Native SV** tab to show it re-derive.

> The chain along the bottom isn't a stored explanation. It's derived from this run's own
> numbers, and it updates live.
>
> Circuit flow up. Arterial volume up. Mean pressure up. Afterload up. Stroke volume down.
> End-diastolic volume up. Filling pressure up.
>
> Change what you're asking about and it re-derives. If the numbers don't support a link,
> it won't draw one.

---

## 1:45 – 2:10 · The split

**ON SCREEN** Press `C`. The untreated baseline slides in as pane A, already beat-locked.
Hold on both LVEDP tiles.

> Here is the same patient untreated, on the same heartbeat.
>
> Left, before. Right, on ECMO. Both running live, beat-locked, so you are never comparing
> two different moments.
>
> Filling pressure, twenty against twenty-six. Perfusion bought at the ventricle's expense.

---

## 2:10 – 2:30 · Plane, and the fix

**ON SCREEN** Press `P`. Hold on S3 sitting low-right. Close, press `5`, let it settle,
reopen `P`.

> Plot systemic support against ventricular unloading. VA-ECMO moves this patient right —
> and down.
>
> Add a trans-valvular pump, holding circuit flow constant, and the point climbs back up
> without sliding left. One variable changed. That is the argument for venting, as geometry.

---

## 2:30 – 3:15 · Assessment

**ON SCREEN** Switch to **Resident session**. Show one complete item: stem → lock → run →
reveal → mechanism. Then the scorecard.

> Watching isn't learning. So every transition is gated behind a prediction.
>
> "ECMO flow two to four litres. Native stroke volume will rise, fall, or stay the same."
> The learner commits before anything moves. Then the intervention runs, and they find out.
>
> Then a second question: which mechanism? Getting the direction right for the wrong reason
> is a different problem, and it's scored separately.
>
> Correct answers live outside the simulator, keyed from the literature. An automated check
> fails the build if the simulator ever disagrees with them. The model cannot grade itself.
>
> The scorecard reports one headline competency: does this learner distinguish systemic
> perfusion from ventricular unloading? Specifically — did they predict that ECMO raises
> mean pressure *and* lowers stroke volume? Getting one right and the other wrong is exactly
> the misconception this exists to find.
>
> Every session exports as JSON, and across sessions as a single CSV.

---

## 3:15 – 3:45 · Integration

**ON SCREEN** The single HTML file copied to a laptop and double-clicked. Then the CSV open
in a spreadsheet.

> One HTML file. No install, no server, no internet. Hand a resident a laptop in the
> workroom and they start.

> It's built for **[ the actual conference slot — e.g. "the twenty-minute teaching block in
> our Thursday CCU conference" ]**, run by **[ fellow / attending ]**, with no simulation
> centre and no technician.

> The exported CSV gives a programme director per-construct performance across a cohort,
> mapping to **[ the actual ACGME competency or EPA ]**.

> **[ If you run the pilot: "In a pilot of N residents, X of N predicted the pressure rise
> correctly and only Y predicted the filling-pressure rise." ]**

---

## 3:45 – 4:00 · Honesty, and close

**ON SCREEN** The disclaimer in the app header. Then back to solo, ventricle beating.

> This is an educational model. It is not validated against patient data and does not claim
> to be. Its internal checks verify that it behaves the way its own equations should — not
> that it matches a patient.
>
> It teaches one patient, one physiology, one confusion. Properly.
>
> The pressure got better. The ventricle got worse. Once you've watched it happen, you don't
> unsee it.

---

## Notes for the shoot

- **Let the heart beat before you talk over it.** The valve and the wall are the payoff of
  the whole build and they need three seconds of silence at the top of the 0:30 block.
- **Explain the orange badge the first time it appears.** Unexplained it looks like a cheat;
  explained it reads as rigour.
- **`D` runs a hands-free scripted demo** — identical every take, never fires a causal chain
  over unsettled numbers, stops by itself. It runs in compare view and takes about 60 s. Use
  it if you'd rather not drive live; it does not cover the assessment block.
- If a judge asks why filling pressure rises here but not in every patient: this is the
  afterload-dominant phenotype, named in the app header, and the app says so wherever it
  reports an LV-loading result. Reported LV-distension incidence on VA-ECMO spans 1–68%.

## One answer worth having ready

**"Is this validated?"** — No, and it says so on screen. 146 automated checks verify that the
model does what its own equations should do, that the narrated mechanism never contradicts
the numbers, and that the answer keys are independent of the simulator. None of that is
clinical validation, and the repo never calls it that.
