
  // ── VIDEO REFS ──
  const vids = {
    ending:   document.getElementById('v-ending'),
    choices:  document.getElementById('v-choices'),
    loop:     document.getElementById('v-loop'),
    endingA:  document.getElementById('v-endingA'),
    endingB:  document.getElementById('v-endingB'),
    credits:  document.getElementById('v-credits'),
  };

  const fadeEl   = document.getElementById('fade');
  const overlay  = document.getElementById('choice-overlay');
  let choiceMade = false;

  // ── UTILITY: fade overlay ──
  // dir: 'in' = black→clear, 'out' = clear→black
  function fadeTo(targetOpacity, durationMs) {
    return new Promise(resolve => {
      fadeEl.style.transition = `opacity ${durationMs}ms ease`;
      fadeEl.style.opacity = targetOpacity;
      setTimeout(resolve, durationMs);
    });
  }

  function showVideo(key) {
    Object.values(vids).forEach(v => { v.pause(); v.classList.remove('active'); });
    vids[key].classList.add('active');
  }

  function playVideo(key) {
    showVideo(key);
    vids[key].currentTime = 0;
    return vids[key].play().catch(() => {});
  }

  // ── CHOICE HANDLER ──
  async function choose(answer) {
    if (choiceMade) return;
    choiceMade = true;

    // Disable buttons visually
    document.querySelectorAll('.choice-btn').forEach(b => b.style.pointerEvents = 'none');

    // Fade out choice overlay + loop video → 3s
    overlay.style.transition = 'opacity 1s ease';
    overlay.style.opacity = '0';
    await fadeTo(1, 3000);   // fade to black 3s

    overlay.classList.remove('visible');
    vids.loop.pause();

    const endKey = (answer === 'accept') ? 'endingB' : 'endingA';

    // Fade IN ending (4s)
    playVideo(endKey);
    await fadeTo(0, 4000);

    // Wait for ending video to finish
    await new Promise(resolve => {
      vids[endKey].onended = resolve;
      // safety timeout
      setTimeout(resolve, (vids[endKey].duration || 30) * 1000 + 5000);
    });

    // Fade OUT ending (3s)
    await fadeTo(1, 3000);

    // Fade IN credits (3s)
    playVideo('credits');
    await fadeTo(0, 3000);

    // Wait for credits to finish
    await new Promise(resolve => {
      vids.credits.onended = resolve;
      setTimeout(resolve, (vids.credits.duration || 30) * 1000 + 5000);
    });

    // Fade out (3s) → go to index.html
    await fadeTo(1, 3000);
    window.location.href = 'index.html';
  }

  // ── MAIN SEQUENCE ──
  async function runSequence() {

    // Start fully black
    fadeEl.style.transition = 'none';
    fadeEl.style.opacity = '1';

    // 1. ENDING.mp4 — fade IN 3s
    playVideo('ending');
    await fadeTo(0, 3000);

    // Wait for Ending.mp4 to finish
    await new Promise(resolve => {
      vids.ending.onended = resolve;
      setTimeout(resolve, (vids.ending.duration || 20) * 1000 + 5000);
    });

    // Fade OUT 3s → black
    await fadeTo(1, 3000);

    // 2. CHOICES 30 SEC — fade IN 5s, NO fade out
    playVideo('choices');
    await fadeTo(0, 5000);

    // At t=20s show question overlay
    const questionTimer = setTimeout(() => {
      overlay.style.opacity = '0';
      overlay.classList.add('visible');
      requestAnimationFrame(() => {
        overlay.style.transition = 'opacity 1s ease';
        overlay.style.opacity = '1';
      });
    }, 20000);

    // When Choices 30 Sec ends → seamlessly switch to Loop (NO black screen, NO fade)
    await new Promise(resolve => {
      vids.choices.onended = resolve;
      setTimeout(resolve, 35000); // safety
    });
    clearTimeout(questionTimer);

    // Ensure overlay is visible
    if (!overlay.classList.contains('visible')) {
      overlay.classList.add('visible');
      overlay.style.opacity = '1';
    }

    // 3. CHOICES LOOP — no fade in, no fade out, just play
    // No fade: keep current opacity (0 = clear), just swap video
    vids.choices.classList.remove('active');
    vids.loop.classList.add('active');
    vids.loop.currentTime = 0;
    vids.loop.play().catch(() => {});

    // Loop keeps playing until choose() is called
  }

  // Start on load
  window.addEventListener('load', () => {
    // Small delay to ensure browser is ready
    setTimeout(runSequence, 300);
  });
