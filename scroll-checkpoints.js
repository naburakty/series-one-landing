/* Composed checkpoints: brake, settle the scene, hold still, then continue. */
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
    let timer = 0, frame = 0, momentum = 0, holdTimer = 0, armed = false, moved = false, touching = false, pointerDown = false;
    let inputTime = 0, scrollTime = 0, direction = 0, lastY = scrollY;
    let served = null, landing = null, holding = null, holdUntil = 0, touch = null, savedScrub = null;
    let cachedPoints = null, measuredAt = 0;
    const invalidate = () => { cachedPoints = null; };
    const emit = (phase, target) => {
      if(target) host.dispatchEvent(new CustomEvent('series:checkpoint', {
        bubbles: true, detail: { phase, key: target.key, y: target.y, direction }
      }));
    };
    const cancel = () => {
      clearTimeout(timer);clearTimeout(holdTimer);
      cancelAnimationFrame(frame);cancelAnimationFrame(momentum);
      timer = frame = momentum = holdTimer = 0;
    };
    const restoreScrub = () => {
      if(savedScrub){
        if(host.isConnected && host.sequence===savedScrub.sequence) savedScrub.sequence.scrubDuration(savedScrub.duration);
        savedScrub=null;
      }
    };
    const release = () => {
      const interrupted = landing || holding;
      cancel();landing = holding = served = null;holdUntil = 0;armed = moved = false;direction = 0;
      restoreScrub();
      emit('released',interrupted);
    };
    const stopped = () => landing || now()<holdUntil;
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
        const boxes = elements.filter(element => element.getClientRects().length).map(element => {
          const box = element.getBoundingClientRect();
          // Frame the final revealed position, including while the entrance is still animating.
          const transform = element.matches('[data-reveal]') && window.DOMMatrixReadOnly
            ? new DOMMatrixReadOnly(getComputedStyle(element).transform).m42 : 0;
          return { top: box.top-transform, bottom: box.bottom-transform };
        });
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
        // Finished lighting, clipper, trimmer/shaver pair, dryer, and complete collection.
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
      cachedPoints = [];
      points.sort((a,b)=>a.y-b.y).forEach(point=>{
        if(!cachedPoints.length || point.y-cachedPoints[cachedPoints.length-1].y>6) cachedPoints.push(point);
      });
      return cachedPoints;
    };
    const maxY = () => Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const write = y => window.scrollTo({ top: Math.max(0,Math.min(maxY(),y)), behavior: 'instant' });
    const targetFor = delta => {
      const points = checkpoints().filter(point => point.key !== served?.key && (point.y-scrollY)*Math.sign(delta)>2);
      return delta>0 ? points[0] : points[points.length-1];
    };
    const land = target => {
      cancel();armed = moved = false;landing = target;
      const from = scrollY, started = now(), sequence = host.sequence;
      if(sequence?.scrubDuration && typeof sequence.vars.scrub==='number'){
        if(!savedScrub) savedScrub={sequence,duration:sequence.vars.scrub};
        sequence.scrubDuration(.12);
      }
      const duration = Math.min(phone()?560:680,Math.max(300,Math.abs(target.y-from)*.9));
      emit('approach',target);
      const tick = time => {
        if(disabled() || pointerDown){release();return;}
        const t = Math.max(0,Math.min(1,(time-started)/duration)), eased = 1-(1-t)**3;
        write(from+(target.y-from)*eased);
        if(t<1) frame=requestAnimationFrame(tick);
        else {
          frame=0;
          // Finish the short camera catch-up before starting the still-frame pause.
          holdTimer=setTimeout(()=>{
            holdTimer=0;
            if(disabled() || pointerDown){release();return;}
            sequence?.getTween?.()?.progress(1);
            served={...target,direction};landing=null;holding=target;
            const pause = target.reading ? (phone()?480:560) : (phone()?380:440);
            holdUntil=now()+pause;
            emit('stopped',target);
            holdTimer=setTimeout(()=>{
              holdTimer=0;holdUntil=0;holding=null;restoreScrub();emit('released',target);
            },pause);
          },savedScrub?140:0);
        }
      };
      frame=requestAnimationFrame(tick);
    };
    const advance = delta => {
      if(stopped()) return false;
      const target = targetFor(delta), distance = target ? Math.abs(target.y-scrollY) : Infinity;
      if(target && distance<=Math.max(34,Math.abs(delta)*1.2)){land(target);return false;}
      const zone = Math.min(innerHeight*(target?.reading ? .52 : .42),target?.reading?420:340);
      const gain = distance<zone ? .22+.78*distance/zone : 1;
      const before=scrollY;
      write(before+delta*gain);
      moved=moved || Math.abs(scrollY-before)>.5;
      return true;
    };
    const settle = () => {
      timer=0;
      if(!armed || !moved || touching || pointerDown || stopped() || momentum || disabled()) return;
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
      if(direction && sign!==direction){
        release();
      }
      if(!event.cancelable){release();return;}
      event.preventDefault();
      if(!event.defaultPrevented){release();return;}
      cancelAnimationFrame(momentum);momentum=0;
      direction=sign;inputTime=now();clearTimeout(timer);
      // Same-direction input cannot cancel an arrival or its bounded still frame.
      if(stopped()) return;
      armed=true;
      if(advance(delta)) schedule();
    },{passive:false});
    listen(window,'touchstart',event => {
      cancelAnimationFrame(momentum);momentum=0;clearTimeout(timer);
      touch=null;touching=event.touches.length>0;
      if(event.touches.length!==1 || !eligible(event.target)){release();return;}
      const point=event.touches[0];
      touch={x:point.clientX,y:point.clientY,lastY:point.clientY,time:now(),velocity:0,claimed:false};
      inputTime=now();
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
      if(sign && direction && sign!==direction){release();touch.velocity=0;}
      direction=sign || direction;inputTime=time;
      const blocked=stopped();
      touch.claimed=true;
      touch.velocity=blocked?0:.4*touch.velocity+.6*delta/elapsed;
      touch.lastY=point.clientY;touch.time=time;
      if(blocked) return;
      armed=true;advance(delta);
    },{passive:false});
    listen(window,'touchend',event => {
      touching=event.touches.length>0;
      if(touching) return;
      const gesture=touch;touch=null;inputTime=now();
      if(stopped()) return;
      if(!gesture?.claimed){schedule();return;}
      const velocity=Math.max(-5,Math.min(5,gesture.velocity));
      if(Math.abs(velocity)<.12 || now()-gesture.time>90){schedule();return;}
      const started=now();let previous=started;
      const tick=time => {
        if(disabled() || touching || pointerDown){release();return;}
        const speed=velocity*Math.exp(-(time-started)/220), elapsed=Math.min(32,time-previous);previous=time;
        if(Math.abs(speed)<.04 || time-started>1100){momentum=0;schedule();return;}
        advance(speed*elapsed);
        if(!stopped()) momentum=requestAnimationFrame(tick);
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
