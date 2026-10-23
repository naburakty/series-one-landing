/* Checkpoint-stop trial: decelerate, land, pause briefly, then release. */
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
    const phone = () => matchMedia('(max-width:760px), (pointer:coarse)').matches;
    let timer = 0, frame = 0, momentum = 0, armed = false, moved = false, touching = false, pointerDown = false;
    let inputTime = 0, scrollTime = 0, direction = 0, lastWheel = 0, lastY = scrollY;
    let served = null, landing = null, holdUntil = 0, touch = null;
    let cachedPoints = null, measuredAt = 0;
    const invalidate = () => { cachedPoints = null; };
    const cancel = () => {
      clearTimeout(timer);cancelAnimationFrame(frame);cancelAnimationFrame(momentum);
      timer = frame = momentum = 0;
    };
    const release = () => { cancel();landing = null;holdUntil = 0;armed = moved = false;direction = 0; };
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
        points.push({ key, y: clamp(box.top - top), reading: key === 'blade' || key === 'story' || key.startsWith('story-') });
      };
      const intro = host.querySelector('.intro-track');
      if (intro && intro.offsetHeight > innerHeight * 1.5) {
        const top = intro.getBoundingClientRect().top + scrollY, travel = intro.offsetHeight - innerHeight;
        // Finished lighting, hero, macro, system, and the complete four-tool arrangement.
        [.31, .4628, .5852, .7008, .949].forEach(progress => points.push({
          key: `intro-${progress}`, y: clamp(top + travel * progress),
          reading: [.4628,.5852,.7008].includes(progress),
          ...(progress === .949 ? { completeFrom: clamp(top + travel * .83) } : {})
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
    const maxY = () => Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const write = y => window.scrollTo({ top: Math.max(0,Math.min(maxY(),y)), behavior: 'instant' });
    const targetFor = delta => {
      const points = checkpoints().filter(point => point.key !== served?.key && (point.y-scrollY)*Math.sign(delta)>2);
      return delta>0 ? points[0] : points[points.length-1];
    };
    const land = target => {
      cancel();armed = false;landing = target;
      const from = scrollY, started = now();
      const duration = Math.min(phone()?440:520,Math.max(180,Math.abs(target.y-from)*.75));
      const tick = time => {
        if(disabled() || pointerDown){release();return;}
        const t = Math.min(1,(time-started)/duration);
        write(from+(target.y-from)*(1-(1-t)**3));
        if(t<1) frame=requestAnimationFrame(tick);
        else {frame=0;served=target;landing=null;holdUntil=now()+180;}
      };
      frame=requestAnimationFrame(tick);
    };
    const advance = delta => {
      if(landing || now()<holdUntil) return;
      const target = targetFor(delta), distance = target ? Math.abs(target.y-scrollY) : Infinity;
      if(target && distance<=Math.max(28,Math.abs(delta)*1.2)){land(target);return;}
      const zone = Math.min(innerHeight*.36,280);
      const gain = distance<zone ? .35+.65*distance/zone : 1;
      write(scrollY+delta*gain);
    };
    const settle = () => {
      timer=0;
      if(!armed || !moved || touching || pointerDown || landing || momentum || disabled()) return;
      const quiet=180, idle=now()-Math.max(inputTime,scrollTime);
      if(idle<quiet){timer=setTimeout(settle,quiet-idle);return;}
      const target=targetFor(direction), points=checkpoints();
      if(!target){armed=false;return;}
      const index=points.indexOf(target), previous=points[index-1];
      const from=previous?.y ?? 0;
      const complete=direction>0 && scrollY>=(target.completeFrom ?? from+(target.y-from)*.8);
      if(complete || Math.abs(target.y-scrollY)<=Math.min(innerHeight*.30,240)) land(target);
      else armed=false;
    };
    const schedule = () => {clearTimeout(timer);timer=setTimeout(settle,180);};
    listen(window,'wheel',event => {
      if(disabled() || event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX)>Math.abs(event.deltaY)
        || pointerDown || touching || !eligible(event.target) || event.defaultPrevented){release();return;}
      const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1), sign=Math.sign(delta);
      const fresh=now()-lastWheel>160, reverse=direction && sign!==direction;
      lastWheel=now();
      if(reverse || fresh) release();
      if(reverse && served && Math.abs(scrollY-served.y)>4) served=null;
      cancelAnimationFrame(momentum);momentum=0;
      direction=sign;inputTime=now();armed=true;clearTimeout(timer);
      if(!event.cancelable){release();return;}
      const target=targetFor(delta), distance=target?Math.abs(target.y-scrollY):Infinity;
      if(landing || now()<holdUntil || distance<=Math.max(Math.min(innerHeight*.36,280),Math.abs(delta)*1.2)){
        event.preventDefault();
        if(event.defaultPrevented) advance(delta);
      }
      schedule();
    },{passive:false});
    listen(window,'touchstart',event => {
      release();touch=null;touching=event.touches.length>0;
      if(event.touches.length!==1 || !eligible(event.target)) return;
      const point=event.touches[0];
      touch={x:point.clientX,y:point.clientY,lastY:point.clientY,time:now(),velocity:0,claimed:false};
      armed=true;inputTime=now();
    });
    listen(window,'touchmove',event => {
      if(!touch || event.touches.length!==1 || disabled()){touch=null;release();return;}
      const point=event.touches[0], dx=point.clientX-touch.x, dy=point.clientY-touch.y;
      if(!touch.claimed && Math.abs(dx)>Math.abs(dy)){touch=null;release();return;}
      if(!touch.claimed && Math.abs(dy)<2) return;
      if(!event.cancelable){touch=null;release();return;}
      event.preventDefault();
      if(!event.defaultPrevented) return;
      const delta=touch.lastY-point.clientY, time=now(), elapsed=Math.max(8,time-touch.time);
      const sign=Math.sign(delta);
      if(sign && direction && sign!==direction){release();if(served && Math.abs(scrollY-served.y)>4) served=null;}
      direction=sign || direction;inputTime=time;armed=true;
      moved=moved || Math.abs(delta)>.5;
      touch.claimed=true;touch.velocity=.4*touch.velocity+.6*delta/elapsed;
      touch.lastY=point.clientY;touch.time=time;
      advance(delta);
    },{passive:false});
    listen(window,'touchend',event => {
      touching=event.touches.length>0;
      if(touching) return;
      const gesture=touch;touch=null;inputTime=now();
      if(!gesture?.claimed || landing || now()<holdUntil){schedule();return;}
      const velocity=Math.max(-5,Math.min(5,gesture.velocity));
      if(Math.abs(velocity)<.12 || now()-gesture.time>90){schedule();return;}
      const started=now();let previous=started;
      const tick=time => {
        if(disabled() || touching || pointerDown){release();return;}
        const speed=velocity*Math.exp(-(time-started)/220), elapsed=Math.min(32,time-previous);previous=time;
        if(Math.abs(speed)<.04 || time-started>1100){momentum=0;schedule();return;}
        advance(speed*elapsed);
        if(!landing) momentum=requestAnimationFrame(tick);
      };
      momentum=requestAnimationFrame(tick);
    });
    listen(window,'touchcancel',()=>{touching=false;touch=null;release();});
    listen(window,'pointerdown',event=>{if(event.pointerType!=='touch'){release();pointerDown=true;}});
    listen(window,'pointerup',()=>{pointerDown=false;});
    listen(window,'pointercancel',()=>{pointerDown=false;});
    listen(window,'keydown',release);
    listen(host,'click',event=>{
      if(event.target instanceof Element && event.target.closest('a,button,input,select,textarea,summary')) release();
    },{capture:true});
    listen(window,'hashchange',release);
    listen(window,'popstate',release);
    listen(window,'resize',()=>{invalidate();served=null;release();});
    listen(host,'toggle',invalidate,{capture:true});
    listen(window,'blur',()=>{touching=pointerDown=false;touch=null;release();});
    listen(document,'visibilitychange',()=>{touching=pointerDown=false;touch=null;release();});
    listen(motion,'change',release);
    listen(window,'scroll',()=>{
      const y=scrollY, delta=y-lastY;lastY=y;
      if(served && !landing && Math.abs(y-served.y)>Math.min(innerHeight*.4,320)) served=null;
      if(!armed || landing || frame || momentum) return;
      moved=true;
      if(!direction && delta) direction=Math.sign(delta);
      scrollTime=now();
      if(!touching && !pointerDown) schedule();
    });
    const observer=new ResizeObserver(invalidate);observer.observe(host);
    const cleanup=()=>{release();observer.disconnect();controller.abort();};
    signal?.addEventListener('abort',cleanup,{once:true});
    controller.signal.addEventListener('abort',()=>signal?.removeEventListener('abort',cleanup),{once:true});
    return cleanup;
  };
})();
