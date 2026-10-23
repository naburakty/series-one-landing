/* Small resting points after a gentle scroll. Native scrolling always wins. */
(() => {
  window.SeriesScrollCheckpoints = (host, { signal, reducedMotion = false } = {}) => {
    if (!host || signal?.aborted) return () => {};

    const controller = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const listen = (target, event, callback, options = {}) => target?.addEventListener(event, callback, {
      passive: true, ...options, signal: controller.signal
    });
    const now = () => performance.now();
    const radius = () => Math.min(innerHeight * .12, 120);
    const disabled = () => !host.isConnected || host.classList.contains('is-preparing')
      || document.hidden || motion.matches || host.reducedMotion || reducedMotion
      || window.Shopify?.designMode || host.querySelector('dialog[open]');

    let idleTimer = 0, frame = 0, armed = false, pointerDown = false, touching = false, touchScrolled = false;
    let suppressUntil = location.hash ? now() + 1500 : 0;
    let strongUntil = 0, cooldownUntil = 0, intentAt = -Infinity;
    let previousY = scrollY, previousTime = now(), samples = [], latched = null;

    const stop = () => {
      clearTimeout(idleTimer);
      idleTimer = 0;
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const suppress = () => {
      stop();
      armed = false;
      suppressUntil = now() + 1500;
    };
    const intent = () => {
      stop();
      armed = true;
      intentAt = now();
    };

    const checkpoints = () => {
      const viewport = innerHeight;
      const limit = Math.max(0, document.documentElement.scrollHeight - viewport);
      const clamp = value => Math.min(limit, Math.max(0, value));
      const points = [];
      const intro = host.querySelector('.intro-track');
      if (intro && intro.offsetHeight > viewport * 1.5) {
        const top = intro.getBoundingClientRect().top + scrollY;
        const travel = intro.offsetHeight - viewport;
        // Three indicators, the logo, then each composed camera view and the family.
        [.12, .20, .35, .512, .632, .94].forEach(progress => {
          points.push({ key: `intro-${progress}`, y: clamp(top + travel * progress) });
        });
      }
      const headerHeight = host.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      host.querySelectorAll('main > section:not(.intro-track)').forEach((section, index) => {
        if (!section.getClientRects().length || section.offsetHeight < 80) return;
        const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || headerHeight + 12;
        points.push({ key: section.id || `section-${index}`, y: clamp(section.getBoundingClientRect().top + scrollY - margin) });
      });
      return points;
    };

    const settle = () => {
      idleTimer = 0;
      const time = now();
      if (!armed || disabled() || pointerDown || touching || time < suppressUntil
        || time < strongUntil || time < cooldownUntil || time - intentAt > 1800) return;
      const hostBox = host.getBoundingClientRect();
      if (hostBox.bottom < innerHeight * .3 || hostBox.top > innerHeight * .3) return;

      const from = scrollY;
      const nearby = checkpoints().filter(point => point.key !== latched?.key
        && Math.abs(point.y - from) <= radius());
      nearby.sort((a, b) => Math.abs(a.y - from) - Math.abs(b.y - from));
      const target = nearby[0];
      if (!target || Math.abs(target.y - from) < 2) return;

      armed = false;
      latched = target;
      cooldownUntil = time + 700;
      const started = time;
      const tick = timestamp => {
        if (disabled() || pointerDown || touching) { stop(); return; }
        const progress = Math.min(1, (timestamp - started) / 220);
        const eased = 1 - (1 - progress) ** 3;
        // Explicit instant behavior avoids inheriting a theme's smooth-scroll CSS.
        window.scrollTo({ top: from + (target.y - from) * eased, behavior: 'instant' });
        frame = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };

    listen(window, 'wheel', event => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { stop(); armed = false; return; }
      // A nested drawer, picker, or other independently scrolling surface owns its input.
      for (let element = event.target; element instanceof Element && element !== host; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2) {
          stop(); armed = false; return;
        }
      }
      intent();
      const pixels = Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (pixels > innerHeight * .45) strongUntil = now() + 320;
    });
    listen(window, 'touchstart', () => { touching = true; touchScrolled = false; intent(); });
    listen(window, 'touchmove', intent);
    listen(window, 'touchend', () => {
      touching = false;
      intentAt = now();
      if (touchScrolled && armed) idleTimer = setTimeout(settle, 170);
    });
    listen(window, 'touchcancel', () => { touching = false; stop(); armed = false; });
    listen(window, 'pointerdown', () => { pointerDown = true; stop(); armed = false; });
    listen(window, 'pointerup', () => { pointerDown = false; });
    listen(window, 'pointercancel', () => { pointerDown = false; });
    listen(window, 'keydown', event => {
      stop(); armed = false;
      if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"],[role="slider"]')) return;
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
        intent();
        if (['PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) strongUntil = now() + 500;
      }
    });
    listen(host, 'click', event => {
      if (event.target instanceof Element && event.target.closest('a[href*="#"],[data-back-top],[data-reveal-intro],[data-select-product],[data-continue-shopping]')) suppress();
    }, { capture: true });
    listen(window, 'hashchange', suppress);
    listen(window, 'popstate', suppress);
    listen(window, 'resize', suppress);
    listen(window, 'blur', () => { stop(); armed = false; pointerDown = false; touching = false; });
    listen(document, 'visibilitychange', () => { stop(); armed = false; });
    listen(motion, 'change', () => { stop(); armed = false; });
    listen(window, 'scroll', () => {
      const time = now(), y = scrollY;
      if (touching && armed) touchScrolled = true;
      if (latched && Math.abs(y - latched.y) > radius() * 1.75) latched = null;
      if (!frame) {
        samples = samples.filter(sample => time - sample.time < 120);
        samples.push({ time, y });
        const recentDistance = Math.abs(y - samples[0].y);
        if (recentDistance > innerHeight * .45 || (time - previousTime < 120 && Math.abs(y - previousY) > innerHeight * .28)) strongUntil = time + 320;
        clearTimeout(idleTimer);
        if (armed && !touching && !pointerDown) idleTimer = setTimeout(settle, 170);
      }
      previousY = y;
      previousTime = time;
    });

    const cleanup = () => { stop(); controller.abort(); };
    signal?.addEventListener('abort', cleanup, { once: true });
    controller.signal.addEventListener('abort', () => signal?.removeEventListener('abort', cleanup), { once: true });
    return cleanup;
  };
})();
