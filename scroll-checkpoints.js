/* One scroll gesture can reach the next resting point; a new gesture continues immediately. */
(() => {
  window.SeriesScrollCheckpoints = (host, { signal, reducedMotion = false } = {}) => {
    if (!host || signal?.aborted) return () => {};
    const controller = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const listen = (target, event, callback, options = {}) => target?.addEventListener(event, callback, {
      passive: true, ...options, signal: controller.signal
    });
    const now = () => performance.now();
    const disabled = () => !host.isConnected || host.classList.contains('is-preparing')
      || document.hidden || motion.matches || host.reducedMotion || reducedMotion
      || window.Shopify?.designMode || host.querySelector('dialog[open]');
    let gesture = null, settleTimer = 0, releaseTimer = 0, frame = 0, viewportWidth = innerWidth;

    const stopSettle = () => {
      clearTimeout(settleTimer);
      cancelAnimationFrame(frame);
      settleTimer = frame = 0;
    };
    const release = () => {
      stopSettle();
      clearTimeout(releaseTimer);
      releaseTimer = 0;
      gesture = null;
    };
    const checkpoints = () => {
      const viewport = innerHeight;
      const limit = Math.max(0, document.documentElement.scrollHeight - viewport);
      const clamp = value => Math.max(0, Math.min(limit, value));
      const box = host.getBoundingClientRect();
      const points = [{ y: clamp(box.top + scrollY) }];
      const intro = host.querySelector('.intro-track');
      if (intro && intro.offsetHeight > viewport * 1.5) {
        const top = intro.getBoundingClientRect().top + scrollY;
        const travel = intro.offsetHeight - viewport;
        [.12, .20, .28, .35, .512, .632, .94, 1].forEach(progress => points.push({ y: clamp(top + travel * progress) }));
      }
      const headerHeight = host.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      host.querySelectorAll('main > section:not(.intro-track)').forEach(section => {
        if (!section.getClientRects().length || section.offsetHeight < 80) return;
        const margin = parseFloat(getComputedStyle(section).scrollMarginTop) || headerHeight + 12;
        points.push({ y: clamp(section.getBoundingClientRect().top + scrollY - margin) });
      });
      points.push({ y: clamp(box.bottom + scrollY - viewport) });
      points.sort((a, b) => a.y - b.y);
      const distinct = points.filter((point, index) => !index || point.y - points[index - 1].y > 24);
      const result = [];
      distinct.forEach((point, index) => {
        if (index) {
          const previous = distinct[index - 1].y;
          const steps = Math.ceil((point.y - previous) / (viewport * .9));
          // Reading stops keep a tall section or long camera move within one screen per swipe.
          for (let step = 1; step < steps; step++) result.push(previous + (point.y - previous) * step / steps);
        }
        result.push(point.y);
      });
      return result;
    };
    const eligible = target => {
      if (disabled() || !(target instanceof Element) || !host.contains(target)) return false;
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="slider"],video,audio')) return false;
      for (let element = target; element && element !== host; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2) return false;
      }
      return true;
    };
    const begin = (kind, target) => {
      release();
      const points = checkpoints(), y = scrollY;
      gesture = {
        kind, target, lower: points.filter(point => point < y - 8).at(-1),
        upper: points.find(point => point > y + 8), direction: 0,
        touching: kind === 'touch', vertical: kind === 'wheel', lastInput: now(), capped: false
      };
      return gesture;
    };
    const bound = state => state.direction > 0 ? state.upper : state.lower;
    const armRelease = () => {
      clearTimeout(releaseTimer);
      // Native inertia can last much longer than the finger gesture. Keep its boundary until quiet.
      if (gesture && !gesture.touching) releaseTimer = setTimeout(release, gesture.kind === 'touch' ? 650 : 230);
    };
    const cap = (state, predicted = scrollY, event) => {
      const target = bound(state);
      if (target == null || !state.vertical || !state.direction) return false;
      const crossing = state.direction > 0 ? predicted >= target : predicted <= target;
      if (!crossing) return false;
      if (event?.cancelable) event.preventDefault();
      stopSettle();
      state.capped = true;
      window.scrollTo({ top: target, behavior: 'instant' });
      return true;
    };
    const settle = () => {
      settleTimer = 0;
      const state = gesture;
      if (!state || disabled() || state.touching || !state.vertical) return;
      const target = bound(state);
      if (target == null || Math.abs(target - scrollY) > Math.min(innerHeight * .12, 120)) return;
      clearTimeout(releaseTimer);
      releaseTimer = 0;
      const from = scrollY, started = now();
      const tick = time => {
        if (gesture !== state || disabled() || state.touching) { stopSettle(); return; }
        const progress = Math.min(1, (time - started) / 200);
        window.scrollTo({ top: from + (target - from) * (1 - (1 - progress) ** 3), behavior: 'instant' });
        if (progress < 1) frame = requestAnimationFrame(tick);
        else { frame = 0;armRelease(); }
      };
      frame = requestAnimationFrame(tick);
    };
    const idle = () => {
      clearTimeout(settleTimer);
      if (gesture && !gesture.touching && !gesture.capped) settleTimer = setTimeout(settle, 140);
      armRelease();
    };

    listen(window, 'wheel', event => {
      if (event.ctrlKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { release(); return; }
      if (!(gesture?.kind === 'wheel' && gesture.target === event.target) && !eligible(event.target)) { release(); return; }
      if (disabled()) { release(); return; }
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      const direction = Math.sign(delta);
      if (!gesture || gesture.kind !== 'wheel' || now() - gesture.lastInput > 230
        || (gesture.direction && gesture.direction !== direction)) begin('wheel', event.target);
      stopSettle();
      gesture.direction = direction;
      gesture.lastInput = now();
      cap(gesture, scrollY + delta, event);
      idle();
    }, { passive: false });
    listen(window, 'touchstart', event => {
      release();
      if (event.touches.length !== 1 || !eligible(event.target)) return;
      const state = begin('touch', event.target), touch = event.touches[0];
      state.startX = touch.clientX;state.startY = state.lastY = touch.clientY;
    });
    listen(window, 'touchmove', event => {
      const state = gesture;
      if (!state || state.kind !== 'touch') return;
      if (event.touches.length !== 1 || disabled()) { release(); return; }
      const touch = event.touches[0], dx = touch.clientX - state.startX, dy = touch.clientY - state.startY;
      if (!state.vertical) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return;
        if (Math.abs(dx) > Math.abs(dy)) { release(); return; }
        state.vertical = true;
      }
      const delta = state.lastY - touch.clientY;
      state.lastY = touch.clientY;
      if (Math.abs(delta) > .5) state.direction = Math.sign(delta);
      cap(state, scrollY + delta, event);
    }, { passive: false });
    listen(window, 'touchend', event => {
      if (!gesture || gesture.kind !== 'touch') return;
      if (event.touches.length) { release(); return; }
      gesture.touching = false;
      idle();
    });
    listen(window, 'touchcancel', release);
    listen(window, 'pointerdown', event => { if (event.pointerType !== 'touch') release(); });
    listen(window, 'keydown', release);
    listen(host, 'click', event => {
      if (event.target instanceof Element && event.target.closest('a[href*="#"],[data-back-top],[data-reveal-intro],[data-select-product],[data-continue-shopping]')) release();
    }, { capture: true });
    listen(window, 'hashchange', release);
    listen(window, 'popstate', release);
    listen(window, 'resize', () => {
      // Mobile browser chrome changes height during a swipe; retain that swipe's boundary.
      if (Math.abs(innerWidth - viewportWidth) > 2) release();
      viewportWidth = innerWidth;
    });
    listen(window, 'blur', release);
    listen(document, 'visibilitychange', release);
    listen(motion, 'change', release);
    listen(window, 'scroll', () => {
      if (!gesture || frame) return;
      if (disabled()) { release(); return; }
      cap(gesture);
      idle();
    });
    const cleanup = () => { release();controller.abort(); };
    signal?.addEventListener('abort', cleanup, { once: true });
    controller.signal.addEventListener('abort', () => signal?.removeEventListener('abort', cleanup), { once: true });
    return cleanup;
  };
})();
