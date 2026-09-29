/* The video slots in main.js, run headless: the teaser in the header and the
 * scene x setting clips in section 4. None of the files exist yet, so what the
 * live page shows without them matters as much as what it shows with them.
 *
 *     node tools/check-video.js
 */
var fs=require('fs');
var src=fs.readFileSync(require('path').join(__dirname,'..','main.js'),'utf8');
var a=src.indexOf('  var draft ='), b=src.indexOf('  /* ------------------------------------------------------------------ *\n   * 5. BibTeX');
var body=src.slice(a,b);
function run(opts){
  var exists=opts.exists||{};
  function el(tag){ var e={tagName:tag.toUpperCase(),hidden:false,attrs:{},children:[],parentNode:null,_l:{},
    addEventListener:function(t,f){(e._l[t]=e._l[t]||[]).push(f);},
    fire:function(t){(e._l[t]||[]).slice().forEach(function(f){f();});},
    getAttribute:function(k){return k in e.attrs?e.attrs[k]:null;},
    setAttribute:function(k,v){e.attrs[k]=String(v);},
    insertBefore:function(n,ref){n.parentNode=e;e.children.splice(e.children.indexOf(ref),0,n);},
    remove:function(){var p=e.parentNode;if(p)p.children.splice(p.children.indexOf(e),1);e.parentNode=null;},
    querySelector:function(){return null;}, querySelectorAll:function(){return [];}, textContent:''}; return e; }
  function vid(id){ var v=el('video'); var s=el('source'); v.id=id; v.readyState=0; v.networkState=2; v.plays=0;
    v.querySelector=function(q){return q==='source'?s:null;}; v.pause=function(){}; v.play=function(){v.plays++;return null;};
    v.load=function(){ v.readyState=0; v.networkState=2; var f=s.src; queue.push(function(){ if(exists[f]){v.readyState=1;v.fire('loadedmetadata');} else {v.networkState=3; s.fire('error');} }); };
    var fig=el('figure'); fig.children.push(v); v.parentNode=fig; v.src_=s; return v; }
  var queue=[];
  var teaserSlot=el('div'); teaserSlot.hidden=true;
  var teaser=vid('teaser-video'); teaser.src_.src='assets/video/teaser.mp4';
  teaser.load(); // the browser starts loading as the page parses
  var video=vid('scene-video');
  var caption=el('figcaption'); caption.attrs['data-base']='BASE.';
  function btn(v,sel,cap){ var b=el('button'); b.attrs['data-value']=v; b.attrs['aria-selected']=String(!!sel); if(cap)b.attrs['data-caption']=cap; b.closest=function(){return b;}; return b; }
  var scenes=[btn('scene-0369',1),btn('scene-0368',0)], sets=[btn('clean',1,'CLEAN'),btn('front3',0,'FRONT3')];
  function picker(axis,bs){ var p=el('div'); p.attrs['data-axis']=axis;
    p.querySelector=function(q){ return q.indexOf('aria-selected')>=0 ? bs.filter(function(b){return b.attrs['aria-selected']==='true';})[0]||null : bs[0]; };
    p.querySelectorAll=function(){return bs;}; return p; }
  var ps=[picker('scene',scenes),picker('setting',sets)], rows=[el('div'),el('div')];
  var qual=el('section'); qual.querySelectorAll=function(q){ return q==='.picker-row'?rows:ps; };
  var ids={'teaser-slot':teaserSlot,'teaser-video':teaser,'qualitative':qual,'scene-video':video,'scene-caption':caption};
  var document={getElementById:function(i){return ids[i]||null;},createElement:function(t){return el(t);}};
  var location={search:opts.search||''};
  new Function('document','location',body)(document,location);
  while(queue.length) queue.shift()();
  return {teaserSlot:teaserSlot,teaser:teaser,video:video,caption:caption,rows:rows,ps:ps,sets:sets,scenes:scenes,queue:queue,
    click:function(p,b){ (p._l.click||[]).forEach(function(f){f({target:b});}); while(queue.length) queue.shift()(); },
    note:function(){ var n=video.parentNode.children.filter(function(c){return c.tagName==='DIV';})[0]; return n?n.textContent:null; },
    tnote:function(){ var n=teaser.parentNode.children.filter(function(c){return c.tagName==='DIV';})[0]; return n?n.textContent:null; }};
}
var fail=0; function t(n,c){ console.log((c?'  ok   ':'  FAIL ')+n); if(!c)fail++; }

console.log('live page, nothing rendered yet');
var r=run({});
t('teaser slot stays hidden', r.teaserSlot.hidden===true && r.tnote()===null);
t('section 4: pickers hidden', r.rows.every(function(x){return x.hidden;}));
t('section 4: caption hidden', r.caption.hidden===true);
t('section 4: one quiet line', r.note()==='The videos are on their way.' && r.video.hidden);

console.log('?draft, nothing rendered yet');
r=run({search:'?draft'});
t('teaser slot shown with its file named', !r.teaserSlot.hidden && /teaser\.mp4/.test(r.tnote()));
t('section 4 names the clip it waits for', r.note()==='missing assets/video/scene-0369_clean.mp4');
t('section 4 pickers stay up in draft', r.rows.every(function(x){return !x.hidden;}));

console.log('files present');
r=run({exists:{'assets/video/teaser.mp4':1,'assets/video/scene-0369_clean.mp4':1,'assets/video/scene-0368_front3.mp4':1}});
t('teaser appears and plays', !r.teaserSlot.hidden && r.teaser.plays===1);
t('section 4 shows the clip, no note', !r.video.hidden && r.note()===null);
t('caption is base + setting', r.caption.textContent==='BASE. CLEAN');
r.click(r.ps[1], r.sets[1]);
t('setting tab swaps the file', r.video.src_.src==='assets/video/scene-0369_front3.mp4');
t('...and the caption', r.caption.textContent==='BASE. FRONT3');
t('a combination not rendered says so, pickers stay', r.note()==='Not rendered for this scene and setting yet.' && r.rows.every(function(x){return !x.hidden;}));
r.click(r.ps[0], r.scenes[1]);
t('scene tab: 0368 front3 exists, note cleared', r.video.src_.src==='assets/video/scene-0368_front3.mp4' && r.note()===null && !r.video.hidden);

console.log('a swap mid-load');
r=run({exists:{'assets/video/scene-0369_clean.mp4':1,'assets/video/scene-0369_front3.mp4':1}});
r.video._l={}; // fresh listeners only from here
var q=r.queue;
// click setting without draining: first probe pending, then a second swap
(r.ps[1]._l.click||[]).forEach(function(f){f({target:r.sets[1]});});
(r.ps[1]._l.click||[]).forEach(function(f){f({target:r.sets[0]});});
while(q.length) q.shift()();
t('the stale probe does not paint over the newer answer', r.note()===null && !r.video.hidden);

if(fail){console.log(fail+' failure(s)');process.exit(1);} console.log('all good');
