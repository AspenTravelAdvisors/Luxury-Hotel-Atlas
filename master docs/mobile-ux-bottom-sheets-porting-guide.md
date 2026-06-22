# Mobile UX redesign — bottom-sheet filters, bottom-drawer details, loader/error polish

> **Append this to `CHANGESsearchfiltersredesign.md`.** It documents the changes made to the
> **Hotel Atlas** (`index-evaluation-details.html`, 2026-06-22) so the same treatment can be ported
> to the Cruise / Yacht / Jet / Expedition atlases that share the rail + dock-pills + panel + veil layout.
>
> Scope of this batch = priority items **2, 4, 5** (filters → bottom sheet, details → bottom drawer,
> loading/error polish) **plus a critical structural bug fix**. Items 1 (pin clustering) and
> 3 (gesture conflicts) are NOT included here.
>
> All changes are **mobile-scoped via `@media (max-width:680px)`** — desktop layout is unchanged.

---

## 0. PRE-FLIGHT — the `</script>` bug (check EVERY atlas first)

The Hotel Atlas had a **missing `</script>`** on the dock-controls script: it was never closed, so the
browser swallowed the entire Need-Help modal (`<style>`, markup, and its `<script>`) as raw script text,
producing a syntax error that **silently killed both the dock pills and the Need-Help modal**.

**How to detect:**
```bash
# open and close counts MUST be equal
echo "open:  $(grep -c '<script'  FILE.html)"
echo "close: $(grep -c '</script>' FILE.html)"
```
If they differ, find the dock IIFE that ends with `})();` immediately followed by an HTML comment /
`<style>` (instead of `</script>`) and insert the missing tag:

```html
  syncRail(); syncPanel();
})();
</script>                               <!-- ADD THIS LINE -->
<!-- ===== Need Help contact modal ===== -->
```

Do this **before** anything else — the mobile JS below relies on the dock script actually running.

---

## 1. Dock observer fix — closing details must not spring filters open

In the dock-controls IIFE, the panel MutationObserver did `railCollapsed = open` on every change, so
**closing** a hotel re-opened the filters sheet (was tolerable as a top-overlay, jarring as a bottom sheet).

**Find:**
```js
    if(mq.matches){ railCollapsed=open; syncRail(); }   // only auto-hide filters on mobile/small screens
```
**Replace with:**
```js
    // On mobile, opening a hotel hides the filters sheet; closing it must NOT spring filters back open.
    if(mq.matches && open && !railCollapsed){ railCollapsed=true; syncRail(); }
```

---

## 2. New markup (4 small insertions)

### 2a. Scrim + sheet handle + sticky footer on the filter rail
Add the scrim just before the rail, and a drag handle + sticky "Show N" footer inside it:

```html
<!-- scrim behind mobile bottom sheets -->
<div class="sheetScrim" id="sheetScrim" hidden></div>

<aside class="rail collapsed-none" id="rail">
  <div class="railtoggle" id="railToggle">&#9776;&nbsp; Filters &amp; results</div>
  <div class="sheetHandle" id="railHandle" aria-hidden="true"><span></span></div>   <!-- ADD -->
  <div class="rhead"> ... existing ... </div>
  <div class="scroller"> ... existing groups + reset ... </div>
  <div class="sheetFooter" id="railFooter">                                         <!-- ADD -->
    <button type="button" class="sheetApply" id="railApply">Show <span id="applyCount">2,500</span> stays</button>
  </div>
</aside>
```
> **Per-atlas knob:** change the word **`stays`** (→ `voyages`, `flights`, `expeditions`…) and the
> placeholder count `2,500` to match the atlas. `applyCount` is kept in sync with the live `#count` by JS.

### 2b. Drag handle on the detail panel
```html
<section class="panel" id="panel">
  <div class="sheetHandle drawerHandle" id="panelHandle" aria-hidden="true"><span></span></div>  <!-- ADD -->
  <div class="hero"> ... existing ... </div>
  ...
</section>
```

### 2c. Loader: skeleton + progress bar (inside the veil)
```html
<div class="veil" id="veil">
  <div class="veilSkeleton" aria-hidden="true"></div>                               <!-- ADD -->
  <div class="box" id="veilLoad">
    <div class="spinner"></div>
    <h2>Loading the Atlas&hellip;</h2>
    <p id="loadMsg">Rendering photorealistic 3D terrain and 2,500 luxury stays.</p> <!-- add id -->
    <div class="loadbar" role="progressbar" aria-label="Loading the atlas"          <!-- ADD -->
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="loadBar">
      <div class="loadbar-fill" id="loadFill"></div>
    </div>
  </div>
  ... error box (see 2d) ...
</div>
```

### 2d. Error box: friendly message, technical setup tucked away
Replace the raw "Add your Google Maps key" box with:
```html
  <div class="box hidden" id="veilErr">
    <div class="errmark" aria-hidden="true">&#9906;</div>
    <h2>The Atlas is taking a moment</h2>
    <p>Our photorealistic 3D map isn&rsquo;t available right now. Please refresh, or reach our concierge
       and we&rsquo;ll send curated recommendations straight to you.</p>
    <p style="margin-top:14px">
      <a class="errbtn" href="#" onclick="location.reload();return false;">Refresh</a>
      <a class="errbtn ghost" href="mailto:Book@BeVvip.com?subject=Hotel%20Atlas%20%E2%80%94%20help">Contact concierge</a>
    </p>
    <details class="setupNote">
      <summary>Setup details</summary>
      <p>The 3D map needs a Google Maps Platform API key with the <b>Maps JavaScript API</b> and
         <b>Map Tiles API</b> enabled (billing on).</p>
      <p>In Vercel, open <b>Project → Settings → Environment Variables</b>, add
         <code>GOOGLE_MAPS_API_KEY</code> with your key, then redeploy.</p>
      <p><a href="https://console.cloud.google.com/google/maps-apis/credentials" target="_blank" rel="noopener">Get a key &rarr;</a> &middot;
         <a href="https://developers.google.com/maps/documentation/javascript/3d-maps-overview" target="_blank" rel="noopener">3D Maps docs &rarr;</a></p>
    </details>
  </div>
```
> **Per-atlas knob:** the mailto subject + the "map / recommendations" wording.

---

## 3. New CSS

### 3a. Base rules (in the head `<style>`, NOT inside a media query)
```css
/* mobile-only sheet chrome — hidden on desktop */
.sheetHandle,.sheetFooter{display:none}

/* loader: branded skeleton + progress bar */
.veilSkeleton{position:absolute;inset:0;z-index:-1;overflow:hidden;
  background:radial-gradient(46% 46% at 50% 42%,rgba(202,164,78,.10),transparent 70%),
             radial-gradient(80% 80% at 50% 120%,rgba(91,141,214,.10),transparent 70%)}
.veilSkeleton:before{content:"";position:absolute;inset:-40% -10%;
  background:linear-gradient(115deg,transparent 38%,rgba(236,223,194,.07) 50%,transparent 62%);
  animation:shimmer 2.4s ease-in-out infinite}
@keyframes shimmer{0%{transform:translateX(-30%)}100%{transform:translateX(30%)}}
.box{position:relative;z-index:1}
.loadbar{width:230px;max-width:70vw;height:4px;margin:20px auto 0;border-radius:4px;
  background:rgba(202,164,78,.18);overflow:hidden}
.loadbar-fill{height:100%;width:0;border-radius:4px;
  background:linear-gradient(90deg,var(--accent),var(--accent2));
  transition:width .5s cubic-bezier(.22,.61,.36,1)}

/* friendly error state */
.errmark{font-size:40px;color:var(--accent);margin-bottom:6px;opacity:.9}
.errbtn{display:inline-block;margin:4px 5px;padding:10px 20px;border-radius:30px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));color:#10131a;
  font-weight:700;font-size:13.5px;text-decoration:none}
.errbtn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}
.errbtn:hover{filter:brightness(1.05)}
.setupNote{margin-top:20px;text-align:left;max-width:440px;margin-left:auto;margin-right:auto;
  border-top:1px solid var(--line);padding-top:12px}
.setupNote summary{cursor:pointer;font-size:11.5px;letter-spacing:.8px;text-transform:uppercase;
  color:var(--muted);list-style:none}
.setupNote summary::-webkit-details-marker{display:none}
.setupNote summary:before{content:"\25B8 ";color:var(--accent)}
.setupNote[open] summary:before{content:"\25BE "}
.setupNote p{font-size:12.5px;margin:8px 0}
```

### 3b. Mobile sheet/drawer block — add AFTER the dock `<style>` so it overrides the dock's mobile rail rule
```css
@media (max-width:680px){
  /* shared sheet chrome */
  .sheetScrim{position:fixed;inset:0;z-index:1250;background:rgba(3,6,11,.5);
    -webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);
    opacity:0;transition:opacity .26s ease}
  .sheetScrim.show{opacity:1}
  .sheetHandle{display:flex;justify-content:center;align-items:center;padding:9px 0 4px;
    touch-action:none;cursor:grab}
  .sheetHandle span{width:38px;height:5px;border-radius:5px;background:var(--line);display:block}

  /* ---------- FILTERS: bottom sheet ---------- */
  /* override the dock rule that floated the rail at the top */
  body.rail-shown .rail,
  .rail{
    position:fixed !important;left:0 !important;right:0 !important;
    top:auto !important;bottom:0 !important;z-index:1300 !important;
    width:100% !important;max-width:100% !important;max-height:86vh !important;
    border:1px solid var(--line) !important;border-bottom:0 !important;
    border-radius:18px 18px 0 0 !important;
    background:rgba(17,21,29,.98) !important;
    box-shadow:0 -12px 40px rgba(0,0,0,.55) !important;
    transform:translateY(100%) !important;
    transition:transform .3s cubic-bezier(.22,.61,.36,1) !important;
    opacity:1 !important;visibility:visible !important;display:flex !important;
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px) !important}
  body.rail-shown .rail{transform:translateY(0) !important}
  .rail .rhead{padding-top:2px}
  .sheetFooter{display:block;border-top:1px solid var(--line);background:rgba(17,21,29,.98);
    padding:10px 14px calc(12px + env(safe-area-inset-bottom,0))}
  .sheetApply{width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;font:inherit;
    font-weight:800;font-size:15px;letter-spacing:.3px;color:#10131a;
    background:linear-gradient(135deg,var(--accent),var(--accent2))}
  .sheetApply:active{transform:scale(.99)}

  /* ---------- DETAILS: bottom drawer with snap points ---------- */
  .panel{
    top:auto !important;bottom:0 !important;left:0 !important;right:0 !important;z-index:1300 !important;
    width:100% !important;max-width:100% !important;height:52vh !important;
    border-left:0 !important;border-top:1px solid var(--line) !important;
    border-radius:18px 18px 0 0 !important;
    box-shadow:0 -14px 44px rgba(0,0,0,.6) !important;
    transform:translateY(100%);
    transition:transform .32s cubic-bezier(.22,.61,.36,1),height .3s cubic-bezier(.22,.61,.36,1)}
  .panel.open{transform:translateY(0)}
  .panel.drawer-expanded{height:92vh !important}
  body.panel-collapsed .panel.open{transform:translateY(100%) !important}
  .panel .hero{padding-top:4px}
  .panel .close{top:8px}
}
```

> **Stacking note:** scrim `z-index:1250`, sheets `1300`. These sit above the dock (`1200`) and below the
> Need-Help modal (`3000`). If an atlas uses different z-indexes, keep scrim < sheets, and sheets > dock.

---

## 4. New JS

### 4a. Progress wiring — add a `setProgress()` helper and call it through `init()`
```js
function setProgress(pct,msg){
  const fill=document.getElementById("loadFill");
  const bar=document.getElementById("loadBar");
  const lbl=document.getElementById("loadMsg");
  if(fill) fill.style.width=Math.max(0,Math.min(100,pct))+"%";
  if(bar) bar.setAttribute("aria-valuenow",String(Math.round(pct)));
  if(msg && lbl) lbl.textContent=msg;
}
```
Then sprinkle stage calls inside `init()` (adapt the copy per atlas):
```js
async function init(){
  setProgress(8,"Connecting to the Atlas…");
  await fetchKey();
  setProgress(22,"Authorizing map tiles…");
  try{ await loadMaps(); } catch(e){ showError(); return; }
  try{
    ... importLibrary("maps3d") / "marker" ...
    setProgress(45,"Rendering photorealistic 3D terrain…");
    ...
    FEATURES = await loadInventory();
    setProgress(70,"Placing 2,500 luxury stays…");
    ... buildFilters / buildMarkers / fit ...
    setProgress(100,"Welcome to the Atlas");
    document.getElementById("veil").classList.add("hidden");
  }catch(e){ console.error(e); showError(); }
}
```

### 4b. Mobile sheet/drawer interactions — append as a NEW `<script>` just before `</body>`
Scrim sync + tap-to-close, live "Show N" count, swipe-to-dismiss filters, snap-point drawer drag:
```html
<script>
(function(){
  var mq=window.matchMedia("(max-width:680px)");
  var body=document.body;
  var rail=document.getElementById('rail');
  var railPill=document.getElementById('railPill');
  var panel=document.getElementById('panel');
  var scrim=document.getElementById('sheetScrim');
  var railHandle=document.getElementById('railHandle');
  var rhead=rail.querySelector('.rhead');
  var panelHandle=document.getElementById('panelHandle');
  var applyBtn=document.getElementById('railApply');
  var countEl=document.getElementById('count');
  var applyCount=document.getElementById('applyCount');

  function railOpen(){ return body.classList.contains('rail-shown'); }
  function closeRail(){ if(railOpen()) railPill.click(); }
  function panelOpen(){ return panel.classList.contains('open') && !body.classList.contains('panel-collapsed'); }
  function closePanel(){ panel.classList.remove('open'); }
  function expanded(){ return panel.classList.contains('drawer-expanded'); }

  /* keep the sticky "Show N" button in sync with the live result count */
  if(countEl && applyCount){
    applyCount.textContent=countEl.textContent;
    new MutationObserver(function(){ applyCount.textContent=countEl.textContent; })
      .observe(countEl,{childList:true,characterData:true,subtree:true});
  }
  if(applyBtn) applyBtn.addEventListener('click',closeRail);

  /* scrim mirrors whichever sheet is open (mobile only) */
  function syncScrim(){
    var show=mq.matches && (railOpen() || panelOpen());
    if(show){ scrim.hidden=false; requestAnimationFrame(function(){ scrim.classList.add('show'); }); }
    else { scrim.classList.remove('show'); setTimeout(function(){ if(!scrim.classList.contains('show')) scrim.hidden=true; },260); }
  }
  scrim.addEventListener('click',function(){ if(railOpen()) closeRail(); else if(panelOpen()) closePanel(); });
  new MutationObserver(syncScrim).observe(body,{attributes:true,attributeFilter:['class']});

  /* each fresh open of the drawer starts at the teaser snap */
  var prevOpen=false;
  new MutationObserver(function(){
    var o=panel.classList.contains('open');
    if(o && !prevOpen && mq.matches){ panel.classList.remove('drawer-expanded'); panel.style.removeProperty('transform'); }
    prevOpen=o;
    syncScrim();
  }).observe(panel,{attributes:true,attributeFilter:['class']});
  if(mq.addEventListener) mq.addEventListener('change',syncScrim);

  /* generic vertical-drag helper, active only on mobile */
  function dragify(grip,target,handlers){
    var startY=0,dy=0,active=false;
    grip.addEventListener('touchstart',function(e){ if(!mq.matches) return; active=true; startY=e.touches[0].clientY; dy=0; target.style.transition='none'; },{passive:true});
    grip.addEventListener('touchmove',function(e){ if(!active) return; dy=e.touches[0].clientY-startY; handlers.move(dy,e); },{passive:false});
    function end(){ if(!active) return; active=false; target.style.transition=''; handlers.end(dy); dy=0; }
    grip.addEventListener('touchend',end);
    grip.addEventListener('touchcancel',end);
  }
  function setT(el,y){ el.style.setProperty('transform','translateY('+y+'px)','important'); }
  function clearT(el){ el.style.removeProperty('transform'); }

  /* filters sheet — drag handle or header down to dismiss */
  function railGrip(grip){
    dragify(grip,rail,{
      move:function(dy,e){ if(dy>0){ e.preventDefault(); setT(rail,dy); } },
      end:function(dy){ clearT(rail); if(dy>90) closeRail(); }
    });
  }
  railGrip(railHandle); railGrip(rhead);

  /* details drawer — drag to expand, collapse to teaser, or dismiss */
  dragify(panelHandle,panel,{
    move:function(dy,e){ e.preventDefault(); if(dy>0) setT(panel,dy); },
    end:function(dy){
      clearT(panel);
      if(dy<-50 && !expanded()) panel.classList.add('drawer-expanded');
      else if(dy>110){ if(expanded()) panel.classList.remove('drawer-expanded'); else closePanel(); }
    }
  });
})();
</script>
```

---

## 5. Per-atlas adaptation checklist

Run the `</script>` balance check (§0) on each, then adapt these atlas-specific values:

| Knob | Hotel Atlas value | Where |
|---|---|---|
| Dock pill IDs | `railPill`, `panelPill` | JS expects these; rename in §4b if different |
| Result count element | `#count` → `#applyCount` | §4b auto-syncs; confirm `#count` exists |
| "Show N **stays**" noun | `stays` | §2a button + footer |
| Loader stage copy | "terrain", "luxury stays" | §4a `setProgress(...)` |
| Error mailto + wording | `Book@BeVvip.com`, "map/recommendations" | §2d |
| Accent palette | `--accent`/`--accent2` gold | already var-driven; no edit if vars exist |
| Mobile breakpoint | `680px` (CSS) / dock uses `640px` | keep consistent with the atlas's existing values |

**Atlases that are code-twins of this rail/dock/panel/veil structure** get the changes near-verbatim.
**Module-based atlases** (see the rail-Region-pattern notes) may need the markup hooks placed differently —
verify the `rail` / `panel` / `veil` IDs exist before pasting.

---

## 6. Verification (per atlas)

Preview sandbox can only read `/tmp`, so `cp ATLAS.html /tmp/atlasprev/index.html` and serve from there.
Without a Maps key the page lands on the error veil (good for checking §2d/§3). Then, at a 390px viewport:

1. Loader shows progress bar + skeleton, advances through stages.
2. Error veil = friendly copy + Refresh/Concierge + collapsible "Setup details".
3. Filters pill → sheet slides up from bottom, scrim dims, sticky "Show N" mirrors live count, swipe-down dismisses.
4. Open a hotel → drawer at ~52vh teaser; drag up → ~92vh; drag/close down → dismiss; filters do NOT pop open.
5. Resize to desktop + reload → rail is the left panel, detail is a right slide-in, `.sheetHandle`/`.sheetFooter` `display:none`.
```
script-open == script-close   &&   style-open == style-close
```
