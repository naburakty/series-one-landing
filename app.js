/* SERIES 01 — locally bundled GSAP / ScrollTrigger, with a native scroll fallback. */
(() => {
  if (customElements.get('series-landing')) return;
  class SeriesLanding extends HTMLElement {
    connectedCallback() {
      if (this.controller) return;
      this.controller = new AbortController();
      this.abortSignal = this.controller.signal;
      this.$ = (selector) => this.querySelector(selector);
      this.$$ = (selector) => [...this.querySelectorAll(selector)];
      this.on = (element, event, callback) => element?.addEventListener(event, callback, { signal: this.abortSignal });
      this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
      this.finishMotionQuery = matchMedia('(max-width:760px), (pointer:coarse)');
      this.reducedMotion = this.motionQuery.matches;
      this.sequenceController = null;
      this.classList.add('enhanced');
      this.initReveal();
      this.initSequence();
      this.scrollCheckpointCleanup = window.SeriesScrollCheckpoints?.(this, { signal: this.abortSignal });
      this.initCollection();
      this.initBag();
      this.on(this.motionQuery, 'change', () => {
        this.reducedMotion = this.motionQuery.matches;
        if(this.reducedMotion){this.finishTimeline?.progress(1);this.finishTimeline?.kill();this.finishTimeline=null;}
        this.sequenceController?.abort();
        this.sequence?.kill();
        this.sequence = null;
        this.timeline?.kill();
        this.timeline = null;
        this.initSequence();
        if(!this.reducedMotion)this.startTurnPreload();
      });
      this.on(this.$('[data-back-top]'), 'click', () => {
        window.scrollTo({ top: this.getBoundingClientRect().top + scrollY, behavior: this.reducedMotion ? 'instant' : 'smooth' });
      });
      this.on(this.$('[data-reveal-intro]'), 'click', () => this.revealIntro());
      // Anchor navigation keeps the complete page usable inside a Shopify section.
      this.$$('a[href^="#series-"]').forEach((link) => this.on(link, 'click', (event) => {
        const target = this.$(link.getAttribute('href'));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ behavior: this.reducedMotion ? 'instant' : 'smooth' });
      }));
    }
    disconnectedCallback() {
      this.controller?.abort();
      this.sequenceController?.abort();
      this.poseTween?.kill();
      this.scrollCheckpointCleanup?.();
      this.scrollCheckpointCleanup = null;
      this.observer?.disconnect();
      this.finishImageCache?.clear();
      this.finishTimeline?.kill();
      this.finishTimeline=null;
      this.finishRequest = (this.finishRequest || 0) + 1;
      this.sequence?.kill();
      this.timeline?.kill();
      if (this.frame) cancelAnimationFrame(this.frame);
      this.$('.bag-dialog')?.close();
      this.controller = null;
    }
    initReveal() {
      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            this.observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -25px 0px' });
      this.$$('[data-reveal]').forEach((element) => this.observer.observe(element));
    }
    initSequence() {
      this.sequenceController?.abort();
      this.poseTween?.kill();
      this.sequenceController = new AbortController();
      const listen = (target, event, callback, options = {}) => target.addEventListener(event, callback, { ...options, signal: this.sequenceController.signal });
      const intro = this.$('.intro-track'), stage = this.$('.intro-stage');
      const product = this.$('.hero-product'), render = this.$('.hero-render');
      const silhouette = this.$('.hero-silhouette');
      const frontPose = this.$('.hero-clipper'), anglePose = this.$('.hero-angle');
      const led = this.$('.led-cluster'), header = this.$('.site-header');
      const ledBars = [...led.children].reverse();
      const ignitionLogo = this.$('.ignition-logo'), ignitionLight = this.$('.ignition-light');
      const ignitionBeam = this.$('.ignition-beam'), ignitionWash = this.$('.ignition-wash');
      const ignitionBloom = this.$('.ignition-bloom'), ignitionWave = this.$('.ignition-wave');
      const logoSheen = this.$('.ignition-logo-sheen'), logoSource = this.$('.ignition-source');
      const copy = this.$('.hero-copy'), outline = this.$('.hero-outline');
      const halo = this.$('.stage-halo'), prompt = this.$('.intro-prompt');
      const caption = this.$('.scene-caption'), captionText = this.$('[data-scene-caption]');
      const detail = this.$('.journey-copy-detail'), system = this.$('.journey-copy-system');
      const heading = this.$('.journey-family-heading'), controls = this.$('.journey-controls');
      const labels = this.$('.journey-labels'), display = this.$('.journey-display');
      const macro = this.$('.journey-macro'), portal = this.$('.journey-portal');
      const floor = this.$('.journey-floor'), sideNote = this.$('.hero-side-note');
      const progress = this.$('.intro-progress span'), skip = this.$('.skip-intro');
      const siblings = this.$$('[data-journey-product]');
      const shadows = this.$$('[data-display-shadow]');
      const clamp = (v) => Math.min(1, Math.max(0, v));
      const range = (p, a, b) => clamp((p - a) / (b - a));
      const ease = (v) => v * v * v * (v * (v * 6 - 15) + 10);
      const lerp = (a, b, t) => a + (b - a) * t;
      const show = (element, opacity, interactive = false) => {
        if (!element) return;
        element.style.opacity = opacity;
        element.style.visibility = opacity > .002 ? 'visible' : 'hidden';
        if (interactive) element.inert = opacity < .65;
      };
      const pose = { mix: 0 };
      let poseTarget = 0;
      const paintPose = () => {
        if(!frontPose || !anglePose)return;
        const mix=pose.mix,compact=this.finishMotionQuery.matches;
        show(frontPose,1-mix);show(anglePose,mix);
        frontPose.style.transform=compact?`scaleX(${1-.035*mix})`:`rotateY(${8*mix}deg)`;
        anglePose.style.transform=compact?`scaleX(${1-.035*(1-mix)})`:`rotateY(${-8*(1-mix)}deg)`;
        this.poseMix=mix;
      };
      const updatePose = wanted => {
        this.turnWanted=wanted;
        const ready=this.turnAssetUrl && this.finishImageCache?.get(this.turnAssetUrl(this.finish))?.ready;
        const target=wanted && ready && !this.reducedMotion && window.gsap ? 1 : 0;
        if(!ready || this.reducedMotion){
          this.poseTween?.kill();poseTarget=pose.mix=0;paintPose();return;
        }
        if(target===poseTarget)return;
        poseTarget=target;this.poseTween?.kill();
        // A short timed blend avoids parking on two ghosted blades during a slow scroll.
        this.poseTween=gsap.to(pose,{mix:target,duration:.28,ease:'power1.inOut',onUpdate:paintPose});
      };
      paintPose();
      this.sequenceController.signal.addEventListener('abort',()=>this.poseTween?.kill(),{once:true});
      let width, height, narrow, heroHeight, toolHeights, positions, keys;
      const measure = () => {
        width = stage.clientWidth; height = stage.clientHeight; narrow = width <= 760;
        heroHeight = product.offsetHeight;
        toolHeights = siblings.map(element => element.offsetHeight);
        const clipperHeight = narrow ? Math.min(height * .22, width * .55) : Math.min(height * .43, 430, width * .28);
        const heights = [clipperHeight, ...toolHeights];
        const columns = narrow ? [28, 72, 28, 72] : [18.5, 39.5, 60.5, 81.5];
        const baselines = narrow ? [46, 46, 71, 71] : [70, 70, 70, 70];
        const bottoms = [.96028646, .96028646, .96028646, .755];
        positions = heights.map((h, i) => ({ x: columns[i], y: baselines[i] - (bottoms[i] - .5) * h / height * 100 }));
        // Cubic tangents carry momentum through each composition; only the final display settles.
        keys = narrow ? [
          {p:0,x:50,y:38,s:.75,r:0},
          {p:.21,x:67,y:38,s:.79,r:5},
          {p:.39,x:27,y:37,s:.81,r:-11},
          {p:.56,x:65,y:37,s:.75,r:7},
          {p:.84,x:positions[0].x,y:positions[0].y,s:clipperHeight/heroHeight,r:0}
        ] : [
          {p:0,x:50,y:40,s:.70,r:0},
          {p:.21,x:66,y:50,s:.96,r:5},
          {p:.39,x:31,y:53,s:1.17,r:-11},
          {p:.56,x:65,y:50,s:.91,r:7},
          {p:.84,x:positions[0].x,y:positions[0].y,s:clipperHeight/heroHeight,r:0}
        ];
      };
      const sample = (p, field) => {
        if (p >= keys[keys.length - 1].p) return keys[keys.length - 1][field];
        const i = Math.max(1, keys.findIndex(key => key.p >= p));
        const a = keys[i - 1], b = keys[i], t = range(p, a.p, b.p), dt = b.p - a.p;
        const tangent = (index) => {
          if (index === 0 || index === keys.length - 1) return 0;
          const prev = keys[index - 1], next = keys[index + 1];
          return (next[field] - prev[field]) / (next.p - prev.p);
        };
        return (2*t*t*t-3*t*t+1)*a[field] + (t*t*t-2*t*t+t)*dt*tangent(i-1)
          + (-2*t*t*t+3*t*t)*b[field] + (t*t*t-t*t)*dt*tangent(i);
      };
      const place = (element, x, y, scale, rotation) => {
        element.style.transform = `translate3d(${(x-50)*width/100}px,${(y-50)*height/100}px,0) translate(-50%,-50%) rotate(${rotation}deg) scale(${scale})`;
      };
      const apply = (scrollProgress) => {
        // Reserve a fully illuminated close-up before beginning the travelling camera.
        const journeyProgress = .20+.80*range(scrollProgress,.32,1);
        // Slow the visual journey around complete headlines while the page keeps scrolling.
        let readingProgress = journeyProgress;
        for (const center of [.368,.512,.648]) {
          const t = (journeyProgress-center)/.06;
          if (Math.abs(t)<1) {
            readingProgress = center+.06*(t-.65*t*(1-t*t)**2);
            break;
          }
        }
        // Reserve the new lead-in without compressing the existing camera journey.
        const p = range(readingProgress,.20,1);
        updatePose(journeyProgress>=.43 && journeyProgress<.60);
        // Begin close enough to fill the canvas, then rejoin the established headline view.
        const openingScale = Math.min(height*.88/(heroHeight*.9206),width*.76/(heroHeight*(2/3)*.4287));
        const pullback = ease(range(scrollProgress,.33,.455));
        const x = lerp(50,sample(p,'x'),pullback);
        const y = lerp(48,sample(p,'y'),pullback)+(narrow?2*Math.sin(Math.PI*pullback):0);
        const scale = lerp(openingScale,sample(p,'s'),pullback), rotation = lerp(0,sample(p,'r'),pullback);
        const family = ease(range(p,.62,.85)), open = range(p,0,.27);
        place(product,x,y,scale,rotation);
        product.style.opacity = '1';
        const lightHandoff = 1-ease(range(journeyProgress,.265,.305));
        show(led,lightHandoff);
        ledBars.forEach((bar,i) => {
          const power = ease(range(scrollProgress,.012+i*.04,.036+i*.04));
          bar.style.opacity = power;
          bar.style.transform = `scaleX(${lerp(.7,1,power)})`;
        });
        const logoPower = ease(range(scrollProgress,.137,.18));
        const logoFade = 1-ease(range(journeyProgress,.285,.355));
        show(ignitionLogo,logoPower*logoFade);
        ignitionLogo.style.transform = `translate(-50%,-50%) scale(${lerp(.97,1,logoPower)})`;
        logoSheen.style.backgroundPosition = `${lerp(180,-80,ease(range(scrollProgress,.17,.25)))}% 0`;
        show(logoSheen,ease(range(scrollProgress,.17,.195))*(1-ease(range(scrollProgress,.24,.265))));
        const spill = ease(range(scrollProgress,.185,.285));
        const spillFade = 1-ease(range(journeyProgress,.34,.46));
        const lightPower = ease(range(scrollProgress,.174,.215));
        show(ignitionLight,lightPower*spillFade);
        const sourceY = y + (.1973895-.5)*heroHeight*scale/height*100;
        const sourceX = x + (.529315-.5)*(heroHeight*2/3)*scale/width*100;
        ignitionLight.style.setProperty('--emission-x',`${sourceX}%`);
        ignitionLight.style.setProperty('--emission-y',`${sourceY}%`);
        ignitionBeam.style.transform = `translateX(-50%) scale(${lerp(.18,1.15,spill)},${lerp(.15,1.2,spill)})`;
        ignitionWash.style.transform = `scale(${lerp(.35,1.3,spill)})`;
        ignitionBloom.style.transform = `translate(-50%,-50%) scale(${lerp(.3,1.2,lightPower)})`;
        show(ignitionBloom,1-.7*ease(range(scrollProgress,.24,.34)));
        ignitionWave.style.transform = `translate(-50%,-50%) scale(${lerp(.015,1.1,spill)})`;
        show(ignitionWave,1-ease(range(scrollProgress,.245,.30)));
        show(logoSource,ease(range(scrollProgress,.178,.22)));
        const illumination = ease(range(scrollProgress,.19,.285));
        show(silhouette,.46*(1-illumination));
        show(render,.10+.90*illumination);
        render.style.maskImage = illumination < .999 ? `radial-gradient(circle at 52.9315% 19.73895%,#000 ${illumination*120}%,transparent ${illumination*150+8}%),linear-gradient(112deg,#000 16%,transparent 40%,transparent 64%,#000 88%)` : 'none';
        show(header,ease(range(open,.22,.38)),true);
        show(copy,ease(range(open,.43,.68))*(1-ease(range(p,.26,.33))),true);
        show(detail,ease(range(p,.30,.36))*(1-ease(range(p,.43,.50))));
        show(system,ease(range(p,.48,.54))*(1-ease(range(p,.59,.67))));
        show(heading,ease(range(p,.70,.80)));
        show(controls,ease(range(p,.74,.84)),true);
        show(labels,ease(range(p,.81,.88)));
        heading.style.transform = `translate3d(0,${(1-ease(range(p,.70,.80)))*16}px,0)`;
        labels.style.transform = `translate3d(0,${(1-ease(range(p,.81,.88)))*10}px,0)`;
        show(display,ease(range(p,.66,.83)));
        outline.style.opacity = ease(range(open,.24,.55)) * (1-ease(range(p,.27,.39)));
        halo.style.opacity = ease(range(open,.13,.45)) * lerp(.7,.28,family);
        halo.style.transform = `translate3d(${(x-50)*width/100}px,${(y-50)*height/100}px,0) translate(-50%,-50%)`;
        show(sideNote,ease(range(open,.55,.76))*(1-ease(range(p,.27,.34))));
        const captionOpacity = ease(range(scrollProgress,.29,.32));
        show(caption,captionOpacity,true);
        progress.style.transform = `scaleX(${scrollProgress})`;
        prompt.style.setProperty('--prompt-intensity',1-ease(range(scrollProgress,.205,.235)));
        prompt.style.display = scrollProgress > .235 ? 'none' : '';
        skip.style.visibility = p > .83 || captionOpacity < .65 ? 'hidden' : 'visible';
        const scene = p < .30 ? 0 : p < .48 ? 1 : p < .67 ? 2 : 3;
        const sceneNames = ['01 / THE AWAKENING','02 / A CHANGE IN PERSPECTIVE','03 / THE BIGGER PICTURE','04 / THE COMPLETE SERIES'];
        if (captionText.textContent !== sceneNames[scene]) captionText.textContent = sceneNames[scene];
        show(macro,.36*ease(range(p,.30,.38))*(1-ease(range(p,.44,.51))));
        macro.style.transform = `scale(${1.1+range(p,.30,.49)*.15}) translate3d(${-range(p,.30,.49)*3}%,0,0)`;
        show(portal,.35*ease(range(p,.47,.56))*(1-ease(range(p,.65,.81))));
        show(floor,.25*ease(range(p,.49,.58))*(1-family));
        siblings.forEach((sibling,i) => {
          const f = ease(range(p,.62+i*.025,.80+i*.02));
          const destination = positions[i+1];
          show(sibling,f);
          place(sibling,lerp(58,destination.x,f),lerp(50,destination.y,f),lerp(.66,1,f),lerp([-7,5,10][i],0,f));
        });
        shadows.forEach((shadow,i) => {
          shadow.style.left = `${positions[i].x}%`;
          shadow.style.top = `${narrow ? (i<2 ? 46 : 71) : 70}%`;
          shadow.style.opacity = ease(range(p,.73+i*.018,.86+i*.006));
        });
        this.sceneProgress = scrollProgress;
      };
      measure();
      this.applySequence = apply;
      listen(window,'resize',() => { measure(); apply(this.sceneProgress ?? 0); });
      if (this.reducedMotion) { apply(1); return; }
      if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
        const state = {progress:0};
        this.timeline = gsap.to(state,{progress:1,duration:1,ease:'none',onUpdate:()=>apply(state.progress),paused:true});
        this.sequence = ScrollTrigger.create({trigger:intro,start:'top top',end:'bottom bottom',animation:this.timeline,scrub:matchMedia('(max-width:760px), (pointer:coarse)').matches?.45:1.05,invalidateOnRefresh:true});
        apply(this.sequence.progress);
      } else {
        let target = 0, current = 0, previous = 0;
        const tick = (time) => {
          this.frame = null;
          if (this.reducedMotion || !this.isConnected) return;
          const elapsed = previous ? Math.min(time-previous,64) : 16;
          previous = time;
          current += (target-current)*(1-Math.exp(-elapsed/(narrow?85:130)));
          if (Math.abs(target-current)<.00005) current=target;
          apply(current);
          if (current!==target) this.frame=requestAnimationFrame(tick);
        };
        const update = () => {
          const box=intro.getBoundingClientRect();
          target=clamp(-box.top/Math.max(1,box.height-innerHeight));
          if(!this.frame){previous=0;this.frame=requestAnimationFrame(tick);}
        };
        listen(window,'scroll',update,{passive:true});
        listen(window,'resize',update);
        this.sequenceController.signal.addEventListener('abort',() => { if(this.frame)cancelAnimationFrame(this.frame); this.frame=null; },{once:true});
        update();
      }
    }
    revealIntro() {
      const intro=this.$('.intro-track');
      const top=intro.getBoundingClientRect().top+scrollY;
      window.scrollTo({top:top+(intro.offsetHeight-innerHeight)*.92,behavior:this.reducedMotion?'instant':'smooth'});
    }
    initCollection() {
      this.finish = ['black','bone','gray','red'].includes(this.dataset.finish) ? this.dataset.finish : 'black';
      this.shopProduct = 'clipper';
      this.finishNames = {black:'Black',bone:'Bone white',gray:'Dark gray',red:'Red'};
      try { Object.assign(this.finishNames,JSON.parse(this.dataset.finishNames||'{}')); } catch (_) {}
      this.products = {
        clipper:{name:'The Clipper',price:189,description:'Cut with intent. A considered precision clipper, from the first pass to the finishing detail.'},
        trimmer:{name:'The Trimmer',price:149,description:'Define every line. A dedicated detail trimmer for the edges, angles, and finishing touches.'},
        shaver:{name:'The Shaver',price:129,description:'A closer finish. A compact twin-foil shaver for the final, considered pass.'},
        dryer:{name:'The Blow Dryer',price:199,description:'Shape what’s next. A sculpted blow dryer to take your work from cut to complete.'}
      };
      try {
        const config=JSON.parse(this.dataset.productConfig||'{}');
        Object.keys(this.products).forEach(key=>{
          if(!config[key])return;
          ['name','priceText','description','url'].forEach(field=>{
            if(typeof config[key][field]==='string'&&config[key][field])this.products[key][field]=config[key][field];
          });
        });
      } catch (_) { /* Default concept content stays available. */ }
      this.compactFinishes = this.finishMotionQuery.matches;
      this.assetBase = this.compactFinishes
        ? this.dataset.mobileCollectionBase || this.dataset.collectionBase || 'assets/mobile/collection/'
        : this.dataset.collectionBase || 'assets/collection/';
      this.assetUrl = (product,finish) => `${this.assetBase}${product}-${finish}.webp`;
      this.detailBase = this.compactFinishes
        ? this.dataset.mobileDetailBase || this.dataset.detailBase || 'assets/mobile/details/clipper-'
        : this.dataset.detailBase || 'assets/details/clipper-';
      this.turnBase = this.compactFinishes
        ? this.dataset.mobileTurnBase || this.dataset.turnBase || 'assets/mobile/angles/clipper-'
        : this.dataset.turnBase || 'assets/angles/clipper-';
      this.turnAssetUrl = finish => `${this.turnBase}${finish}.webp`;
      this.visualAssetUrl = (visual,finish) => visual.dataset.visualKind === 'angle'
        ? this.turnAssetUrl(finish) : visual.dataset.visualKind === 'detail'
          ? `${this.detailBase}${finish}.webp` : this.assetUrl(visual.dataset.productVisual,finish);
      this.finishImageCache = new Map();
      this.pendingFinish = null;
      this.finishesReady = false;
      this.$$('[data-product-visual]').forEach((visual)=>{
        if(!visual.dataset.assetBase)visual.dataset.assetBase=this.assetBase;
        if(visual.dataset.visualKind==='angle'){
          visual.style.setProperty('--product-mask','none');return;
        }
        visual.style.setProperty('--product-mask',`url("${this.visualAssetUrl(visual,'black')}")`);
        visual.querySelector('.finish-front').src=this.visualAssetUrl(visual,this.finish);
        visual.querySelector('.finish-front').style.opacity='1';
        visual.querySelector('.finish-back').style.opacity='0';
        visual.querySelector('.finish-sheen').style.opacity='0';
      });
      this.$$('[data-finish]').forEach(button=>{
        button.classList.toggle('selected',button.dataset.finish===this.finish);
        button.setAttribute('aria-pressed',String(button.dataset.finish===this.finish));
        const warm=()=>{this.prepareFinish(button.dataset.finish,'high');this.prepareTurn(button.dataset.finish,'low');};
        ['pointerenter','focus','pointerdown'].forEach(event=>this.on(button,event,warm));
        this.on(button,'click',()=>this.changeFinish(button.dataset.finish));
      });
      this.$$('[data-finish-name]').forEach(label=>{label.textContent=this.finishNames[this.finish]});
      this.$$('[data-shop-product],[data-select-product]').forEach(button=>this.on(button,'click',()=>{
        const key=button.dataset.shopProduct||button.dataset.selectProduct;
        this.selectProduct(key);
        if(button.hasAttribute('data-select-product'))this.$('#series-shop').scrollIntoView({behavior:this.reducedMotion?'instant':'smooth'});
      }));
      this.setFinishSelection(this.finish);
      this.selectProduct('clipper');
      this.startFinishPreload();
    }
    startFinishPreload() {
      const signal=this.abortSignal,loader=this.$('[data-series-loader]');
      const progress=this.$('[data-series-load-progress]'),busyRegion=this.$('main');
      const finishes=Object.keys(this.finishNames),initialFinish=this.finish;
      const urls=[...new Set(finishes.flatMap(finish=>this.finishUrls(finish)))];
      const pageTop=this.getBoundingClientRect().top+scrollY;
      const historyVisit=performance.getEntriesByType('navigation')[0]?.type==='back_forward';
      const showLoader=loader&&!location.hash&&!historyVisit&&!window.Shopify?.designMode&&scrollY<8&&pageTop<8;
      const started=performance.now();
      let minimumTimer,deadlineTimer,exitTimer,leaving=false;
      let content=[],previousBusy=null;
      const update=()=>{
        if(signal.aborted||!showLoader)return;
        const ready=urls.filter(url=>this.finishImageCache.get(url)?.ready).length;
        if(progress)progress.style.transform=`scaleX(${ready/urls.length})`;
      };
      const cleanup=()=>{
        clearTimeout(minimumTimer);clearTimeout(deadlineTimer);clearTimeout(exitTimer);
        signal.removeEventListener('abort',cleanup);
        if(this.finishLoadProgress===update)this.finishLoadProgress=null;
        if(!showLoader)return;
        this.classList.remove('is-preparing');
        loader.hidden=true;loader.classList.remove('is-leaving');
        content.forEach(([element,inert])=>{element.inert=inert;});
        if(previousBusy===null)busyRegion?.removeAttribute('aria-busy');
        else busyRegion?.setAttribute('aria-busy',previousBusy);
      };
      const reveal=()=>{
        if(signal.aborted||leaving||!showLoader)return;
        const remaining=550-(performance.now()-started);
        if(remaining>0){clearTimeout(minimumTimer);minimumTimer=setTimeout(reveal,remaining);return;}
        leaving=true;clearTimeout(deadlineTimer);
        loader.classList.add('is-leaving');
        exitTimer=setTimeout(cleanup,this.reducedMotion?0:240);
      };
      if(showLoader){
        content=[...this.children].filter(element=>element!==loader).map(element=>[element,element.inert]);
        content.forEach(([element])=>{element.inert=true;});
        previousBusy=busyRegion?.getAttribute('aria-busy')??null;busyRegion?.setAttribute('aria-busy','true');
        loader.classList.remove('is-leaving');loader.hidden=false;
        this.classList.add('is-preparing');
        // Continue warming after the deadline; individual selections can still await missing assets.
        deadlineTimer=setTimeout(reveal,4500);
        this.on(window,'scroll',()=>{if(scrollY>8)reveal();});
        signal.addEventListener('abort',cleanup,{once:true});
      }
      this.finishLoadProgress=update;
      // Decode the opening finish first, then prepare the other three together.
      this.finishPreload=this.prepareFinish(initialFinish,'high').then(initialReady=>{
        if(signal.aborted)return false;
        return Promise.all(finishes.filter(finish=>finish!==initialFinish).map(finish=>this.prepareFinish(finish,'auto')))
          .then(results=>initialReady&&results.every(Boolean));
      }).then(ready=>{
        if(signal.aborted)return false;
        this.finishesReady=ready;update();
        if(showLoader)reveal();else cleanup();
        this.startTurnPreload();
        return ready;
      });
    }
    prepareTurn(finish,priority='low') {
      if(this.reducedMotion || !this.turnAssetUrl)return Promise.resolve(false);
      const signal=this.abortSignal,url=this.turnAssetUrl(finish);
      return this.loadFinishImage(url,priority).then(ready=>{
        if(ready && !signal.aborted && this.finish===finish){
          const visual=this.$('.hero-angle');
          if(visual && !visual.classList.contains('is-changing-finish')){
            visual.querySelector('.finish-front').src=url;
            visual.style.setProperty('--product-mask',`url("${url}")`);
          }
          this.applySequence?.(this.sceneProgress??0);
        }
        return ready;
      });
    }
    startTurnPreload() {
      if(this.reducedMotion || !this.finishNames)return Promise.resolve(false);
      this.turnPreload=Promise.all(Object.keys(this.finishNames).map(finish=>this.prepareTurn(finish)))
        .then(results=>results.every(Boolean));
      return this.turnPreload;
    }
    finishUrls(finish) {
      return [...Object.keys(this.products).map(product=>this.assetUrl(product,finish)),`${this.detailBase}${finish}.webp`];
    }
    loadFinishImage(url,priority) {
      const cache=this.finishImageCache;
      const cached=cache.get(url);
      if(cached){if(priority==='high')cached.image.fetchPriority='high';return cached.promise;}
      const image=new Image(),signal=this.abortSignal;
      image.decoding='async';image.fetchPriority=priority;
      const entry={image,ready:false,promise:null};
      image.src=url;
      entry.promise=image.decode().then(()=>{entry.ready=true;if(!signal.aborted)this.finishLoadProgress?.();return true},()=>{
        if(cache.get(url)===entry)cache.delete(url);
        return false;
      });
      cache.set(url,entry);
      return entry.promise;
    }
    prepareFinish(finish,priority='auto') {
      return Promise.all(this.finishUrls(finish).map(url=>this.loadFinishImage(url,priority)))
        .then(results=>results.every(Boolean));
    }
    setFinishSelection(finish,loading=false) {
      this.$$('[data-finish]').forEach(button=>{
        const selected=button.dataset.finish===finish;
        button.classList.toggle('selected',selected);
        button.classList.toggle('is-loading',selected&&loading);
        button.setAttribute('aria-pressed',String(selected));
        if(selected&&loading)button.setAttribute('aria-busy','true');
        else button.removeAttribute('aria-busy');
      });
      const buy=this.$('[data-add-to-bag]');if(buy)buy.disabled=loading;
    }
    async changeFinish(finish) {
      if(!this.finishNames[finish]||finish===this.pendingFinish)return;
      const request=(this.finishRequest||0)+1;
      this.finishRequest=request;
      this.finishTimeline?.progress(1);
      this.finishTimeline?.kill();this.finishTimeline=null;
      if(finish===this.finish){this.pendingFinish=null;this.setFinishSelection(finish);return;}
      this.pendingFinish=finish;
      const ready=this.finishUrls(finish).every(url=>this.finishImageCache.get(url)?.ready);
      this.setFinishSelection(finish,!ready);
      const loaded=ready||await this.prepareFinish(finish,'high');
      if(loaded && this.turnWanted)await this.prepareTurn(finish,'high');
      if(request!==this.finishRequest||!this.isConnected)return;
      this.pendingFinish=null;
      if(!loaded){
        this.setFinishSelection(this.finish);
        const message=this.$('[data-finish-announcement]');
        if(message)message.textContent='The finish is still loading. Please try again.';
        return;
      }
      // Read visibility before changing theme styles or writing animation layers.
      const visuals=this.$$('[data-product-visual]');
      const visible=visual=>{
        const box=visual.getBoundingClientRect();
        if(box.bottom<=0||box.top>=innerHeight||box.right<=0||box.left>=innerWidth)return false;
        for(let node=visual;node&&node!==this;node=node.parentElement){
          const style=getComputedStyle(node);
          if(node.hidden||style.display==='none'||style.visibility==='hidden'||Number(style.opacity)<.01)return false;
        }
        return true;
      };
      const jobs=visuals.map(visual=>({visual,url:this.visualAssetUrl(visual,finish),visible:visible(visual)}));
      this.finish=finish;
      this.dataset.finish=finish;
      this.applySequence?.(this.sceneProgress??0);
      this.setFinishSelection(finish);
      this.$$('[data-finish-name]').forEach(label=>{label.textContent=this.finishNames[finish]});
      const commit=(visual,url)=>{
        const front=visual.querySelector('.finish-front'),back=visual.querySelector('.finish-back');
        front.src=url;
        front.alt=`Series 01 ${visual.dataset.productVisual.replace('dryer','blow dryer')} in ${this.finishNames[finish].toLowerCase()}`;
        front.style.opacity='1';back.style.opacity='0';
        visual.classList.remove('is-changing-finish');
        const sheen=visual.querySelector('.finish-sheen');if(sheen)sheen.style.opacity='0';
      };
      if(this.reducedMotion||!window.gsap){jobs.forEach(({visual,url})=>commit(visual,url));}
      else {
        const timeline=gsap.timeline();
        const compact=this.finishMotionQuery.matches;
        this.finishTimeline=timeline;
        jobs.forEach(({visual,url,visible})=>{
          const front=visual.querySelector('.finish-front'),back=visual.querySelector('.finish-back'),sheen=visual.querySelector('.finish-sheen');
          if(!visible){commit(visual,url);return;}
          back.src=url;
          visual.classList.add('is-changing-finish');
          // Give the incoming layer a frame to upload; mobile uses a simple compositor fade.
          timeline.fromTo(back,{opacity:0},{opacity:1,duration:compact?.24:.28,ease:'power1.inOut'},compact?.03:0);
          if(!compact)timeline.fromTo(sheen,{backgroundPosition:'180% 0',opacity:0},{backgroundPosition:'-80% 0',opacity:.3,duration:.34,ease:'power1.inOut'},0);
          timeline.call(()=>commit(visual,url),[],compact?.29:.35);
        });
      }
      const message=this.$('[data-finish-announcement]');
      if(message)message.textContent=`The entire series is now in ${this.finishNames[finish]}.`;
      this.updateProductLink?.();
    }
    selectProduct(key) {
      if(!this.products[key])return;
      this.finishTimeline?.progress(1);
      this.finishTimeline?.kill();
      this.shopProduct=key;
      const product=this.products[key];
      const visual=this.$('.shop-product-visual');
      visual.dataset.productVisual=key;
      visual.style.setProperty('--product-mask',`url("${this.assetUrl(key,'black')}")`);
      const front=visual.querySelector('.finish-front');
      front.src=this.assetUrl(key,this.finish);
      front.alt=`Series 01 ${product.name} in ${this.finishNames[this.finish]}`;
      visual.querySelector('.finish-back').style.opacity='0';
      this.$('[data-shop-title]').textContent=product.name;
      this.$('[data-shop-price]').textContent=product.priceText||`$${product.price} USD`;
      this.$('[data-shop-description]').textContent=product.description;
      this.$$('[data-shop-product]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.shopProduct===key)));
      if(!this.reducedMotion&&window.gsap)gsap.fromTo(visual,{opacity:.25},{opacity:1,duration:.5,ease:'power2.out'});
      this.updateProductLink?.();
    }
    updateProductLink() {
      const link=this.$('[data-product-link]');
      if(link)link.href=this.products[this.shopProduct]?.url||this.dataset[`${this.shopProduct}Url`]||'#series-shop';
    }
    initBag() {
      const dialog=this.$('.bag-dialog');
      if(!dialog)return;
      const itemContainer=this.$('[data-bag-items]');
      let cart=[];
      try {
        const stored=JSON.parse(sessionStorage.getItem('series-one-collection-bag')||'[]');
        if(Array.isArray(stored))cart=stored.filter(item=>this.products[item.product]&&this.finishNames[item.finish]&&Number.isInteger(item.quantity)&&item.quantity>0&&item.quantity<=20);
      } catch (_) { /* The concept bag is usable without browser storage. */ }
      const escape=(value)=>{const node=document.createElement('span');node.textContent=value;return node.innerHTML};
      const update=()=>{
        const total=cart.reduce((n,item)=>n+item.quantity,0);
        this.$$('.bag-count,.drawer-count').forEach(count=>{count.textContent=`(${total})`});
        this.$('.bag-empty').hidden=total>0;
        this.$('.bag-filled').hidden=total===0;
        itemContainer.innerHTML=cart.map((item,index)=>{
          const product=this.products[item.product];
          return `<div class="bag-product"><img src="${this.assetUrl(item.product,item.finish)}" alt="${escape(product.name)} in ${escape(this.finishNames[item.finish])}" width="100" height="150"><div><p class="eyebrow">SERIES 01</p><h3>${escape(product.name)}</h3><p>${escape(this.finishNames[item.finish])}</p><div class="quantity-control"><button data-cart-action="decrease" data-cart-index="${index}" aria-label="Decrease ${escape(product.name)} quantity">−</button><output class="bag-quantity">${item.quantity}</output><button data-cart-action="increase" data-cart-index="${index}" aria-label="Increase ${escape(product.name)} quantity" ${item.quantity>=20?'disabled':''}>+</button></div><button class="remove-item" data-cart-action="remove" data-cart-index="${index}">Remove</button></div><strong class="bag-line-total">$${product.price*item.quantity}</strong></div>`;
        }).join('');
        this.$('.bag-subtotal').textContent=`$${cart.reduce((n,item)=>n+this.products[item.product].price*item.quantity,0).toLocaleString()} USD`;
        try{sessionStorage.setItem('series-one-collection-bag',JSON.stringify(cart))}catch(_){/* Optional persistence. */}
      };
      const open=()=>{if(!dialog.open)dialog.showModal()};
      this.$$('[data-open-bag]').forEach(button=>this.on(button,'click',open));
      this.on(this.$('[data-add-to-bag]'),'click',()=>{
        const existing=cart.find(item=>item.product===this.shopProduct&&item.finish===this.finish);
        if(existing)existing.quantity=Math.min(20,existing.quantity+1);
        else cart.push({product:this.shopProduct,finish:this.finish,quantity:1});
        update();open();
        this.$('[data-cart-announcement]').textContent=`${this.products[this.shopProduct].name} in ${this.finishNames[this.finish]} added to your concept bag.`;
      });
      this.on(dialog,'click',event=>{
        const button=event.target.closest('[data-cart-action]');
        if(button){
          const index=Number(button.dataset.cartIndex),item=cart[index];
          if(!item)return;
          const action=button.dataset.cartAction;
          if(action==='increase')item.quantity=Math.min(20,item.quantity+1);
          else if(action==='decrease')item.quantity--;
          else if(action==='remove')item.quantity=0;
          cart=cart.filter(entry=>entry.quantity>0);
          update();
          const next=itemContainer.querySelector(`[data-cart-index="${Math.min(index,cart.length-1)}"][data-cart-action="${action}"]`);
          next?.focus();
          return;
        }
        if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close()}
      });
      this.on(this.$('[data-close-bag]'),'click',()=>dialog.close());
      this.$$('[data-continue-shopping]').forEach(button=>this.on(button,'click',()=>{
        dialog.close();this.$('#series-shop').scrollIntoView({behavior:this.reducedMotion?'instant':'smooth'});
      }));
      update();
    }

  }
  customElements.define('series-landing', SeriesLanding);
})();
