/* Light checkpoint resistance, with uninterrupted input and directional completion. */
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
    const radius = () => Math.min(innerHeight * .22, 180);
    let timer = 0, frame = 0, armed = false, moved = false, touching = false, pointerDown = false;
    let inputTime = 0, scrollTime = 0, latched = null, touchOrigin = null, touchY = 0, direction = 0;
    let cachedPoints = null, measuredAt = 0, lastY = scrollY;
    const invalidate = () => { cachedPoints = null; };

    const cancel = () => {
      clearTimeout(timer);cancelAnimationFrame(frame);
      timer = frame = 0;
    };
    const release = () => { cancel();armed = moved = false;direction = 0; };
    const eligible = target => {
      if (disabled() || !(target instanceof Element) || !host.contains(target)) return false;
      if (target.closest('input,textarea,select,[contenteditable="true"],[role="slider"],video,audio')) return false;
      for (let element = target; element && element !== host; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2) return false;
      }
      return true;
    };
    const checkpoints = () => {
      if (cachedPoints && now() - measuredAt < 1000) return cachedPoints;
      const header = host.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      const available = innerHeight - header;
      const limit = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const clamp = y => Math.max(0, Math.min(limit, y));
      const points = [], narrow = matchMedia('(max-width:760px)').matches;
      const bounds = (section, selectors) => {
        const elements = selectors ? [...section.querySelectorAll(selectors)] : [section];
        const boxes = elements.filter(element => element.getClientRects().length).map(element => element.getBoundingClientRect());
        if (!boxes.length) return null;
        const top = Math.min(...boxes.map(box => box.top)) + scrollY;
        const bottom = Math.max(...boxes.map(box => box.bottom)) + scrollY;
        return { top, height: bottom - top };
      };
      const add = (key, section, selectors, fallback, align = 'center') => {
        if (!section) return;
        const box = bounds(section, selectors);
        if (!box) return;
        if (box.height > available && fallback) {
          fallback.forEach((selection, index) => {
            const group = typeof selection === 'string' ? { selectors: selection } : selection;
            add(`${key}-${index}`, section, group.selectors, null, group.align);
          });
          return;
        }
        // Frame the headline and product together, excluding the section's outside padding.
        const top = align === 'top' ? header + 24
          : box.height <= available ? header + (available - box.height) / 2 : header + 16;
        points.push({ key, y: clamp(box.top - top) });
      };
      const intro = host.querySelector('.intro-track');
      if (intro && intro.offsetHeight > innerHeight * 1.5) {
        const top = intro.getBoundingClientRect().top + scrollY, travel = intro.offsetHeight - innerHeight;
        // Finished lighting, hero, macro, system, and the complete four-tool arrangement.
        [.20, .368, .512, .648, .94].forEach(progress => points.push({
          key: `intro-${progress}`, y: clamp(top + travel * progress),
          ...(progress === .94 ? { completeFrom: clamp(top + travel * .80) } : {})
        }));
      }
      add('story', host.querySelector('.manifesto'), narrow
        ? '.section-heading>*,.manifesto-main>*' : '.section-heading>*,.manifesto-main>*,.spec-strip>*',
        ['.manifesto-main>h2', '.manifesto-aside']);
      add('blade', host.querySelector('.blade-section'));
      const collection = host.querySelector('.collection-section');
      if (narrow) {
        add('collection-title', collection, '.collection-title-row>*,.collection-card:nth-child(1),.collection-card:nth-child(2)');
        add('collection-tools', collection, '.collection-grid,.collection-caption',
          ['.collection-card:nth-child(3),.collection-card:nth-child(4),.collection-caption']);
      } else add('collection', collection, '.collection-title-row>*,.collection-grid,.collection-caption');
      add('signature', host.querySelector('.power-section'));
      add('kit', host.querySelector('.kit-section'), narrow
        ? '.kit-heading h2,.kit-heading>p:last-child,.kit-sculpture,.kit-list>div'
        : '.kit-heading>*,.kit-contents>*',
        ['.kit-heading h2,.kit-heading>p:last-child,.kit-sculpture', '.kit-sculpture,.kit-list>div']);
      const shop = host.querySelector('.shop-section');
      if (narrow) {
        add('shop-portrait', shop, '.shop-visual,.shop-details>.eyebrow,.shop-details>h2', ['.shop-visual']);
        add('shop-finish', shop, '.shop-details', [{ selectors: '.shop-product-tabs,.shop-product-name,.shop-description,.shop-color-heading,.shop-picker,.buy-button,.shop-promises,.concept-disclosure', align: 'top' }]);
      } else add('shop', shop, '.shop-visual,.shop-details');
      add('questions', host.querySelector('.faq-section'));
      points.push({ key: 'footer', y: clamp(host.getBoundingClientRect().bottom + scrollY - innerHeight) });
      measuredAt = now();
      cachedPoints = points.sort((a, b) => a.y - b.y);
      return cachedPoints;
    };
    const settle = () => {
      timer = 0;
      if (!armed || !moved || touching || pointerDown || disabled()) return;
      const idle = now() - Math.max(inputTime, scrollTime);
      if (idle < 240) { timer = setTimeout(settle, 240 - idle);return; }
      const y = scrollY;
      const points = checkpoints();
      // Finish forward after 80% of a transition; never pull against the last gesture.
      const next = points.find(point => point.y > y + 2);
      const previous = next ? points[points.indexOf(next) - 1] : null;
      const start = previous?.y ?? 0;
      const complete = direction > 0 && next && next.key !== latched?.key && (
        next.completeFrom !== undefined ? y >= next.completeFrom
          : y >= start + (next.y - start) * .80
      );
      const nearby = points.filter(point => point.key !== latched?.key
        && (point.y - y) * direction >= -2 && Math.abs(point.y - y) <= radius());
      nearby.sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y));
      const target = complete ? next : nearby[0];
      armed = false;
      if (!target) return;
      latched = target;
      if (Math.abs(target.y - y) < 2) return;
      const started = now();
      const duration = Math.min(1000, Math.max(260, Math.abs(target.y - y) * 1.1));
      const tick = time => {
        if (disabled() || touching || pointerDown) { release();return; }
        const progress = Math.min(1, (time - started) / duration);
        window.scrollTo({ top: y + (target.y - y) * (1 - (1 - progress) ** 3), behavior: 'instant' });
        frame = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };
    const intent = target => {
      const alreadyMoved = armed && moved;
      cancel();
      if (!eligible(target)) { armed = moved = false;return false; }
      armed = true;inputTime = now();
      moved = alreadyMoved;
      if (moved && !touching && !pointerDown) timer = setTimeout(settle, 240);
      return true;
    };
    listen(window, 'wheel', event => {
      if (event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) { release();return; }
      if (pointerDown || touching || !intent(event.target)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      direction = Math.sign(delta);
      if (!event.cancelable || event.defaultPrevented) return;
      const y = scrollY, zone = Math.min(innerHeight * .38, 320);
      // A shallow resistance curve, never a destination cap. Large flicks pass freely.
      const strength = Math.max(0, ...checkpoints().map(point => {
        const distance = Math.abs(point.y - y);
        return distance < zone ? (1 - (distance / zone) ** 2) ** 2 : 0;
      }));
      const reduction = Math.min(Math.abs(delta) * .38 * strength, 44);
      if (reduction < .25) return;
      const top = Math.max(0, Math.min(document.documentElement.scrollHeight - innerHeight,
        y + delta - direction * reduction));
      // Only replace an event when it can actually advance the document.
      if (Math.abs(top - y) < .5) return;
      event.preventDefault();
      if (event.defaultPrevented) window.scrollTo({ top, behavior: 'instant' });
    }, { passive: false });
    listen(window, 'touchstart', event => {
      release();touchOrigin = null;touching = event.touches.length > 0;
      if (event.touches.length !== 1) return;
      intent(event.target);
      touchOrigin = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      touchY = touchOrigin.y;
    });
    listen(window, 'touchmove', event => {
      cancel();inputTime = now();
      if (event.touches.length !== 1 || !touchOrigin) { release();return; }
      const touch = event.touches[0];
      if (Math.abs(touch.clientX - touchOrigin.x) > Math.abs(touch.clientY - touchOrigin.y)) release();
      else if (Math.abs(touch.clientY - touchY) > 1) direction = Math.sign(touchY - touch.clientY);
      touchY = touch.clientY;
    });
    listen(window, 'touchend', event => {
      touching = event.touches.length > 0;inputTime = now();
      if (armed && moved && !touching) timer = setTimeout(settle, 240);
    });
    listen(window, 'touchcancel', () => { touching = false;touchOrigin = null;release(); });
    listen(window, 'pointerdown', event => { if (event.pointerType !== 'touch') { release();pointerDown = true; } });
    listen(window, 'pointerup', () => { pointerDown = false; });
    listen(window, 'pointercancel', () => { pointerDown = false; });
    listen(window, 'keydown', release);
    listen(host, 'click', event => {
      if (event.target instanceof Element && event.target.closest('a,button,input,select,textarea,summary')) release();
    }, { capture: true });
    listen(window, 'hashchange', release);
    listen(window, 'popstate', release);
    listen(window, 'resize', () => { invalidate();release(); });
    listen(host, 'toggle', invalidate, { capture: true });
    listen(window, 'blur', () => { touching = pointerDown = false;release(); });
    listen(document, 'visibilitychange', () => { touching = pointerDown = false;release(); });
    listen(motion, 'change', release);
    listen(window, 'scroll', () => {
      const y = scrollY;
      const delta = y - lastY;lastY = y;
      if (latched && Math.abs(y - latched.y) > radius() * 1.4) latched = null;
      if (!armed || frame) return;
      if (!direction && delta) direction = Math.sign(delta);
      moved = true;scrollTime = now();
      clearTimeout(timer);
      if (!touching && !pointerDown) timer = setTimeout(settle, 240);
    });
    const observer = new ResizeObserver(invalidate);
    observer.observe(host);
    const cleanup = () => { release();observer.disconnect();controller.abort(); };
    signal?.addEventListener('abort', cleanup, { once: true });
    controller.signal.addEventListener('abort', () => signal?.removeEventListener('abort', cleanup), { once: true });
    return cleanup;
  };
})();
