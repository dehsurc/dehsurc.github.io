/* The video slot in main.js, run headless: the teaser in the header and its
 * playback speed. Section 4 is drawn by qual.js and is not checked here.
 *
 *     node tools/check-video.js
 */
var fs=require('fs');
var src=fs.readFileSync(require('path').join(__dirname,'..','main.js'),'utf8');
var a=src.indexOf('  var draft ='), b=src.indexOf('  /* ------------------------------------------------------------------ *\n   * 4b. Dataset tabs');
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
    v.playbackRate=1; v.defaultPlaybackRate=1;
    v.load=function(){ v.readyState=0; v.networkState=2; v.playbackRate=v.defaultPlaybackRate; var f=s.src; queue.push(function(){ if(exists[f]){v.readyState=1;v.fire('loadedmetadata');} else {v.networkState=3; s.fire('error');} }); };
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
  function speedGroup(id){ var g=el('div'); g.attrs['data-video']=id;
    g.rates=[0.25,0.5,1,1.5,2].map(function(r){ var b=el('button'); b.attrs['data-rate']=String(r); b.attrs['aria-pressed']=String(r===1);
      b.closest=function(){return b;}; return b; });
    g.querySelectorAll=function(){return g.rates;}; return g; }
  var speeds=[speedGroup('teaser-video'),speedGroup('scene-video')];
  var document={getElementById:function(i){return ids[i]||null;},createElement:function(t){return el(t);},
    querySelectorAll:function(q){return q==='.speed[data-video]'?speeds:[];}};
  var location={search:opts.search||''};
  new Function('document','location',body)(document,location);
  while(queue.length) queue.shift()();
  return {speeds:speeds,teaserSlot:teaserSlot,teaser:teaser,video:video,caption:caption,rows:rows,ps:ps,sets:sets,scenes:scenes,queue:queue,
    click:function(p,b){ (p._l.click||[]).forEach(function(f){f({target:b});}); while(queue.length) queue.shift()(); },
    note:function(){ var n=video.parentNode.children.filter(function(c){return c.tagName==='DIV';})[0]; return n?n.textContent:null; },
    tnote:function(){ var n=teaser.parentNode.children.filter(function(c){return c.tagName==='DIV';})[0]; return n?n.textContent:null; }};
}
var fail=0; function t(n,c){ console.log((c?'  ok   ':'  FAIL ')+n); if(!c)fail++; }

console.log('live page, nothing rendered yet');
var r=run({});
t('teaser slot stays hidden', r.teaserSlot.hidden===true && r.tnote()===null);

console.log('?draft, nothing rendered yet');
r=run({search:'?draft'});
t('teaser slot shown with its file named', !r.teaserSlot.hidden && /teaser\.mp4/.test(r.tnote()));

console.log('files present');
r=run({exists:{'assets/video/teaser.mp4':1,'assets/video/scene-0369_clean.mp4':1,'assets/video/scene-0368_front3.mp4':1}});
t('teaser appears and plays', !r.teaserSlot.hidden && r.teaser.plays===1);

/* ---- the dataset tabs on the results tables (main.js 4b) ---- */
var ta=src.indexOf('  Array.prototype.slice.call(document.querySelectorAll(\'.table-tabs\'))');
var tb=src.indexOf('  /* ------------------------------------------------------------------ *\n   * 5. BibTeX');
var tabsBody=src.slice(ta,tb);
function runTabs(isDraft){
  var byId={}, removed=[];
  function node(id, attrs){ var e={id:id,hidden:!!attrs.hidden,attrs:attrs,tabIndex:0,_l:{},
    getAttribute:function(k){return k in e.attrs?e.attrs[k]:null;}, setAttribute:function(k,v){e.attrs[k]=String(v);},
    hasAttribute:function(k){return k in e.attrs;}, remove:function(){removed.push(e.id);},
    addEventListener:function(t,f){e._l[t]=f;}, focus:function(){doc.activeElement=e;},
    closest:function(){return e;} }; byId[id]=e; return e; }
  var tabs=[node('geo-tab',{'aria-controls':'geo','aria-selected':'true'}),
            node('orig-tab',{'aria-controls':'orig','aria-selected':'false'}),
            node('av2-tab',{'aria-controls':'av2','aria-selected':'false','data-draft':'',hidden:true})];
  node('geo',{}); node('orig',{hidden:true}); node('av2',{hidden:true,'data-draft':''});
  var bar=node('bar',{}); bar.querySelectorAll=function(){return tabs;};
  var doc={activeElement:null, querySelectorAll:function(){return [bar];}, getElementById:function(i){return byId[i]||null;}};
  new Function('document','draft',tabsBody)(doc,isDraft);
  return {byId:byId,removed:removed,bar:bar,doc:doc,tabs:tabs,
    click:function(id){ bar._l.click({target:byId[id]}); },
    key:function(k){ bar._l.keydown({key:k,preventDefault:function(){}}); }};
}
console.log('dataset tabs, live page');
var T=runTabs(false);
t('the draft tab and its panel are gone', T.removed.indexOf('av2-tab')>=0 && T.removed.indexOf('av2')>=0);
t('the first panel shows, the rest are hidden', !T.byId.geo.hidden && T.byId.orig.hidden);
T.click('orig-tab');
t('a click switches the panel', T.byId.geo.hidden && !T.byId.orig.hidden && T.byId['orig-tab'].attrs['aria-selected']==='true');
T.doc.activeElement=T.byId['orig-tab']; T.key('ArrowRight');
t('arrow keys wrap between the live tabs only', !T.byId.geo.hidden && T.byId.orig.hidden);
console.log('dataset tabs, ?draft');
var D=runTabs(true);
t('the draft tab is shown', D.removed.length===0 && D.byId['av2-tab'].hidden===false);
D.click('av2-tab');
t('...and opens its panel', !D.byId.av2.hidden && D.byId.geo.hidden);
console.log('playback speed');
r=run({exists:{'assets/video/teaser.mp4':1,'assets/video/scene-0369_clean.mp4':1,'assets/video/scene-0369_front3.mp4':1}});
var tg=r.speeds[0], sg=r.speeds[1];
function rateBtn(g,x){ return g.rates.filter(function(b){return b.attrs['data-rate']===String(x);})[0]; }
r.click(tg,rateBtn(tg,2));
t('teaser: 2x sets the rate', r.teaser.playbackRate===2 && r.teaser.defaultPlaybackRate===2);
t('teaser: only the chosen button is pressed', tg.rates.map(function(b){return b.attrs['aria-pressed'];}).join()==='false,false,false,false,true');
if(fail){console.log(fail+' failure(s)');process.exit(1);} console.log('all good');
