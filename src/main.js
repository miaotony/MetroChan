import './styles/main.css';
import qrcode from 'qrcode-generator';
/* ============ 地铁数据 ============ */
import METRO_DATA from '../data/metro_data.json';

/* 线路颜色 */
const LINE_COLORS = {'1号线':'#E3002B','2号线':'#82BF25','3号线':'#FCD600','4号线':'#461D84','5号线':'#944D9A','6号线':'#D40068','7号线':'#ED6F00','8号线':'#0094D8','9号线':'#87CAED','10号线':'#C6AFD4','11号线':'#871C2B','12号线':'#007B61','13号线':'#E999C0','14号线':'#626020','15号线':'#BCA886','16号线':'#98D1C0','17号线':'#BC796F','18号线':'#C4984F','浦江线':'#B5B5B6'};
const DARK_TEXT_LINES = ['2号线','3号线','9号线','10号线','13号线','15号线','16号线','浦江线'];
const LINE_ORDER = ['1号线','2号线','3号线','4号线','5号线','6号线','7号线','8号线','9号线','10号线','11号线','12号线','13号线','14号线','15号线','16号线','17号线','18号线','浦江线'];

/* ============ 票价函数 ============ */
function fareCurrent(d){ if(d<=6) return 3; return 3 + Math.ceil((d-6)/10); }
function farePlan1(d){
  var steps=[4,4,4,7,7,7,10,10,10], price=3, km=4;
  for(var i=0;i<steps.length;i++){ if(d<=km) return price; km+=steps[i]; price+=1; }
  if(d<=67) return price;
  return price + Math.ceil((d-67)/15);
}
function farePlan2(d){
  var steps=[6,8,8,10,10,12,12], price=4, km=6;
  for(var i=0;i<steps.length;i++){ if(d<=km) return price; km+=steps[i]; price+=1; }
  if(d<=72) return price;
  return price + Math.ceil((d-72)/14);
}
/* 2026-12-01 生效的新方案：起步 3 元 / 4 km，16 km 内每 4 km 加 1 元，
   16 元后每 7 km 加 1 元，30 km 后每 10 km 加 1 元，125 km 后每 20 km 加 1 元 */
function fareFinal(d){
  if (d <= 4) return 3;
  var tiers=[[8,4],[12,5],[16,6],[23,7],[30,8],[40,9],[50,10]];
  for(var i=0;i<tiers.length;i++){ if(d<=tiers[i][0]) return tiers[i][1]; }
  return 10 + Math.ceil((d-50)/15);   /* 50 公里以上每 15 公里加 1 元 */
}
const FARES = [
  {key:'cur',   name:'老方案（2005 版）',      fn:fareCurrent, color:'#8a8a8a'},
  {key:'final', name:'新方案（2026-12）',  fn:fareFinal,   color:'#c8102e'},
  {key:'p1',    name:'听证方案一（未采纳）', fn:farePlan1,   color:'#1668a3', hearing:true},
  {key:'p2',    name:'听证方案二（未采纳）', fn:farePlan2,   color:'#2f8f6b', hearing:true}
];
var SHOW_HEARING = false;
function activeFares(){
  return SHOW_HEARING ? FARES : FARES.filter(function(f){ return !f.hearing; });
}

/* ============ Tab 切换 ============ */
var s2sModalWired = false;
function maybeShowS2sModal(){
  var KEY = 'metrochan_s2s_notice_v1';
  var dismissed = null;
  try { dismissed = localStorage.getItem(KEY); } catch(e){}
  if(dismissed) return;
  var mask = document.getElementById('s2sModal');
  mask.classList.add('open');
  if(s2sModalWired) return;
  s2sModalWired = true;
  function close(){
    mask.classList.remove('open');
    if(document.getElementById('s2sModalDontShow').checked){
      try { localStorage.setItem(KEY, '1'); } catch(e){}
    }
  }
  document.getElementById('s2sModalOk').addEventListener('click', close);
  mask.addEventListener('click', function(ev){ if(ev.target===mask) close(); });
}
function switchTab(name, updateHash){
  document.body.dataset.tab = name;
  document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active', x.dataset.tab===name);});
  document.querySelectorAll('.panel').forEach(function(x){x.classList.toggle('active', x.id==='panel-'+name);});
  if(updateHash !== false){
    try {
      if(name === 's2s') history.replaceState(null, '', location.pathname + location.search);
      else history.replaceState(null, '', '#' + name);
    } catch(e){ location.hash = (name === 'dist') ? '' : name; }
  }
}
document.querySelectorAll('.tab').forEach(function(t){
  t.addEventListener('click', function(){ switchTab(t.dataset.tab); });
});
if(location.hash === '#dist'){ switchTab('dist', false); }
if(location.hash === '#cities'){ switchTab('cities', false); }
if(location.hash === '#change'){ switchTab('change', false); }

/* 从 ?km= 还原乘距 */
window.addEventListener('load', function(){
  try {
    var km = new URLSearchParams(location.search).get('km');
    if(!km) return;
    var v = parseFloat(km);
    if(isNaN(v) || v < 1) return;
    v = Math.min(v, 135);
    var active = document.querySelector('.tab.active');
    var tab = active ? active.dataset.tab : 'dist';
    var num = document.getElementById(tab === 'cities' ? 'cityKmNum' : 'kmNum');
    if(num){ num.value = Math.round(v); num.dispatchEvent(new Event('input')); }
  } catch(e){}
});

/* 复制当前视图链接 */
(function(){
  var btn = document.getElementById('shareBtn');
  var txt = document.getElementById('shareBtnText');
  if(!btn) return;
  var LABEL = '🔗 复制当前视图链接';
  function buildUrl(){ /* 也供二维码模块使用 */
    var active = document.querySelector('.tab.active');
    var tab = active ? active.dataset.tab : 'dist';
    var url = location.origin + location.pathname;
    var qs = [];
    var withParams = document.getElementById('shareWithParams');
    if(tab === 's2s' && withParams && withParams.checked && window.__getS2S){
      var p = window.__getS2S();
      if(p.from) qs.push('from=' + encodeURIComponent(p.from));
      if(p.to) qs.push('to=' + encodeURIComponent(p.to));
      var rr = document.getElementById('ridesS2s');
      if(rr && rr.value) qs.push('rides=' + encodeURIComponent(rr.value));
    } else {
      var num = document.getElementById(tab === 'cities' ? 'cityKmNum' : 'kmNum');
      if(tab !== 's2s' && num && num.value) qs.push('km=' + encodeURIComponent(num.value));
    }
    if(qs.length) url += '?' + qs.join('&');
    if(tab !== 'dist') url += '#' + tab;
    return url;
  }
  function flash(msg, ok){
    txt.textContent = msg;
    btn.classList.toggle('done', !!ok);
    setTimeout(function(){ txt.textContent = LABEL; btn.classList.remove('done'); }, 2000);
  }
  function copyNow(cb){
    var url = buildUrl();
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta);
      flash(ok ? '✅ 已复制链接' : '复制失败，请手动复制', ok);
      if(cb) cb(ok);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){ flash('✅ 已复制链接', true); if(cb) cb(true); }, fallback);
    } else fallback();
  }
  btn.addEventListener('click', function(){ copyNow(); });
  window.__buildShareUrl = buildUrl;
  window.__copyShareLink = copyNow;
})();
/* 二维码分享 */
(function(){
  var btn = document.getElementById('qrBtn');
  if(!btn) return;
  var box = null;
  btn.addEventListener('click', function(){
    if(!box){
      box = document.createElement('div');
      box.className = 'qrbox'; box.hidden = true;
      box.innerHTML = '<div class="qr-card" role="dialog" aria-label="二维码分享">'
        + '<h3>扫码打开本页</h3>'
        + '<div class="qr-sub"></div>'
        + '<label class="qr-opt"><input type="checkbox" id="qrWithParams" checked> 带上起点、终点和每月乘坐次数</label>'
        + '<div class="qr-img"></div>'
        + '<div class="qr-url"></div>'
        + '<div class="qr-acts"><button type="button" class="qr-copy">复制链接</button>'
        + '<button type="button" class="qr-close">关闭</button></div>';
      document.body.appendChild(box);
      box.addEventListener('click', function(e){ if(e.target === box) close(); });
      box.querySelector('.qr-close').addEventListener('click', close);
      box.querySelector('#qrWithParams').addEventListener('change', function(e){
        var main = document.getElementById('shareWithParams');
        if(main) main.checked = e.currentTarget.checked;
        var card1 = box.querySelector('.qr-card');
        var u = buildShareUrl();
        card1.querySelector('.qr-url').textContent = u;
        drawQr(u, card1.querySelector('.qr-img'));
      });
      box.querySelector('.qr-copy').addEventListener('click', function(e){
        var b = e.currentTarget;
        if(!window.__copyShareLink) return;
        window.__copyShareLink(function(ok){
          b.textContent = ok ? '已复制 ✓' : '复制失败';
          setTimeout(function(){ b.textContent = '复制链接'; }, 1400);
        });
      });
      document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && box && !box.hidden) close(); });
    }
    var url = buildShareUrl();
    var card = box.querySelector('.qr-card');
    var optBox = card.querySelector('#qrWithParams');
    if(optBox){ var mainChk = document.getElementById('shareWithParams'); if(mainChk) optBox.checked = mainChk.checked; }
    card.querySelector('.qr-sub').textContent = '当前视图：' + shareViewLabel();
    card.querySelector('.qr-url').textContent = url;
    drawQr(url, card.querySelector('.qr-img'));
    box.hidden = false;
  });
  function close(){ box.hidden = true; }
  function buildShareUrl(){ return window.__buildShareUrl ? window.__buildShareUrl() : location.href; }
  function shareViewLabel(){
    var t = document.querySelector('.tab.active');
    return t ? t.textContent.trim() : '默认视图';
  }
  function drawQr(text, holder){
    holder.innerHTML = '';
    try{
      var qr = qrcode(0, 'M');
      qr.addData(text); qr.make();
      var n = qr.getModuleCount(), cell = Math.max(2, Math.floor(232 / n));
      var cv = document.createElement('canvas');
      var px = n * cell;
      cv.width = px; cv.height = px;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, px, px);
      ctx.fillStyle = '#1f1c18';
      for(var r = 0; r < n; r++) for(var c = 0; c < n; c++){
        if(qr.isDark(r, c)) ctx.fillRect(c * cell, r * cell, cell, cell);
      }
      holder.appendChild(cv);
    }catch(err){
      var img = document.createElement('img');
      img.alt = '二维码生成失败'; holder.appendChild(img);
      var card0 = holder.closest('.qr-card'); if(card0) card0.querySelector('.qr-url').textContent = '二维码生成失败，请直接复制链接';
    }
  }
})();
/* 移动端悬浮按钮：二维码（复制链接在弹层内） */
(function(){
  var b2 = document.getElementById('mQrBtn');
  if(b2) b2.addEventListener('click', function(){
    var q = document.getElementById('qrBtn');
    if(q) q.click();
  });
})();

/* 解析分享参数：?from=&to=&rides=（等主脚本初始化完再跑） */
window.addEventListener('load', function(){
  var q;
  try { q = new URLSearchParams(location.search); } catch(e){ return; }
  var f = q.get('from'), t = q.get('to'), r = q.get('rides');
  if(!f || !t || !window.__setS2S) return;
  window.__setS2S(f, t);
  if(r){
    var rr = document.getElementById('ridesS2s');
    var rd = document.getElementById('ridesS2sRange');
    var v = Math.max(1, Math.min(120, parseInt(r, 10) || 44));
    if(rr) rr.value = v;
    if(rd) rd.value = v;
  }
  if(typeof switchTab === 'function') switchTab('s2s', false);
});

/* 浏览器前进/后退时同步 tab */
window.addEventListener('hashchange', function(){
  var h = location.hash.replace('#','');
  switchTab((h === 's2s' || h === 'cities') ? h : 'dist', false);
});

/* spoiler 点按显示（移动端） */
document.addEventListener('click', function(ev){
  var sp = ev.target.closest ? ev.target.closest('.spoiler') : null;
  if(sp) sp.classList.toggle('revealed');
});

/* ============ 共用：月成本表 ============ */
function renderCostTable(container, km, rides, useDisc){
  var rows = [];
  activeFares().forEach(function(f){
    var per = f.fn(km);
    var total = per * rides;
    var th = f.key==='cur' ? 70 : (f.key==='final' ? 90 : 100);  // 老方案满70、新方案满90、听证方案满100 打 9 折
    if(useDisc && total>th){ total = th + (total-th)*0.9; }
    rows.push({label:f.name+'（单程）', detail:per+' 元/次', cost:total});
  });
  var perFinal = fareFinal(km);
  [{n:35,c:190},{n:45,c:210},{n:60,c:270},{n:90,c:390}].forEach(function(t){
    var over = rides - t.n;
    if (over > 0) {
      /* 超出次数用单程票补齐：计次票 + 单程票组合 */
      rows.push({label:'计次票 '+t.n+' 次', detail:t.c+' 元 + '+over+' 次单程', cost: t.c + over*perFinal, combo:true});
    } else {
      rows.push({label:'计次票 '+t.n+' 次', detail:t.c+' 元/30天', cost: t.c});
    }
  });
  // 最低：只在新方案（方案一/方案二）和计次票之间比，排除老方案
  var bestIdx = -1;
  for(var i=1;i<rows.length;i++){
    if(rows[i].cost===null) continue;
    if(bestIdx<0 || rows[i].cost < rows[bestIdx].cost) bestIdx=i;
  }
  var html = '<table class="cost"><thead><tr>'
    + '<th>方案</th><th>单价</th><th>月成本</th><th>均次</th><th>对比最低</th></tr></thead><tbody>';
  rows.forEach(function(r,i){
    var bestCls = (i===bestIdx) ? ' class="best"' : '';
    var costStr = r.cost===null ? '次数不足' : ('¥ '+r.cost.toFixed(1));
    var avgStr = r.cost===null ? '—' : ('¥ '+(r.cost/rides).toFixed(1));
    var diffStr = '';
    if(r.cost!==null){
      if(i===bestIdx){ diffStr = '最低'; }
      else {
        var diff = r.cost - rows[bestIdx].cost;
        if(diff >= 0){ diffStr = '+¥ '+diff.toFixed(1); }
        else { diffStr = '−¥ '+Math.abs(diff).toFixed(1); }
        if(i===0){ diffStr = '不参与评比'; }
      }
    }
    html += '<tr'+bestCls+'><td>'+r.label+(i===0?'<span class="badge est">推算</span>':'')+(i===bestIdx?'<span class="badge">最低</span>':'')+(r.combo?'<span class="badge combo">组合</span>':'')+'</td>'
      + '<td>'+r.detail+'</td><td class="cst">'+costStr+'</td><td>'+avgStr+'</td><td>'+diffStr+'</td></tr>';
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

/* ============ Tab1: 按乘距 ============ */
(function(){
  var range = document.getElementById('kmRange');
  var num = document.getElementById('kmNum');
  var cards = document.getElementById('cards');
  var svg = document.getElementById('chart');
  var ridesInput = document.getElementById('rides');
  var discInput = document.getElementById('discount');
  var costTable = document.getElementById('costTable');

  function getKm(){ var v = parseFloat(num.value); return (isNaN(v)||v<1)?1:Math.min(v,200); }

  function renderCards(){
    var d = getKm();
    var cur = fareCurrent(d);
    var html = '';
    activeFares().forEach(function(f){
      var p = f.fn(d);
      var cls = f.key==='cur'?'cur':(f.key==='p1'?'p1':(f.key==='p2'?'p2':'final'));
      var deltaTxt, deltaCls, note;
      if(f.key==='cur'){
        deltaTxt = '基准'; deltaCls = 'eq'; note = '0-6km 起步 3 元，每 10km +1';
      } else {
        var diff = p - cur;
        deltaTxt = diff===0 ? '与老方案相同' : ('比老方案 ' + (diff>0?'+':'') + diff + ' 元');
        deltaCls = diff===0 ? 'eq' : 'up';
        note = f.key==='p1' ? '起步 3 元不变，缩短起乘/中短距间距'
             : (f.key==='p2' ? '起步 4 元，均摊涨幅' : '起步 3 元/4km，16km 内每 4km +1');
      }
      html += '<div class="card '+cls+'">'
            + '<div class="name">'+f.name+'</div>'
            + '<div class="price">'+p+'<span class="u">元</span></div>'
            + '<div class="delta '+deltaCls+'">'+deltaTxt+'</div>'
            + '<div class="note">'+note+'</div>'
            + '</div>';
    });
    cards.innerHTML = html;
  }

  var CHW = 920, CHH = 380, CHL = 42, CHR = 16, CHT = 30, CHB = 38;
  function measureChart(){
    var cw = svg.clientWidth || 900;
    CHW = Math.max(300, Math.round(cw));
    CHH = CHW < 560 ? 300 : 380;
    CHL = CHW < 560 ? 34 : 42;
  }
  measureChart();
  function renderChart(){
    if(svg.clientWidth && Math.abs(svg.clientWidth - CHW) > 2) measureChart();
    var W=CHW, H=CHH, L=CHL, R=CHR, T=CHT, B=CHB;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var xMin=0, xMax=135, yMin=0, yMax=16;
    function sx(x){ return L + (x-xMin)/(xMax-xMin)*(W-L-R); }
    function sy(y){ return H-B - (y-yMin)/(yMax-yMin)*(H-T-B); }
    var out = '';
    [0,2,4,6,8,10,12,14,16].forEach(function(y){
      out += '<line class="grid" x1="'+sx(xMin)+'" y1="'+sy(y)+'" x2="'+sx(xMax)+'" y2="'+sy(y)+'"/>';
      out += '<text class="axis" x="'+(L-8)+'" y="'+(sy(y)+4)+'" text-anchor="end">'+y+'</text>';
    });
    [0,20,40,60,80,100,120].forEach(function(x){
      out += '<line class="grid" x1="'+sx(x)+'" y1="'+sy(yMin)+'" x2="'+sx(x)+'" y2="'+sy(yMax)+'"/>';
      out += '<text class="axis" x="'+sx(x)+'" y="'+(H-B+18)+'" text-anchor="middle">'+x+'</text>';
    });
    out += '<text class="axis" x="'+sx(xMax)+'" y="'+(H-B+18)+'" text-anchor="end">公里</text>';
    out += '<text class="axis" x="'+(L-8)+'" y="14" text-anchor="end">元</text>';
    activeFares().forEach(function(f){
      var pts=[];
      for(var x=1; x<=xMax; x++){ pts.push([x, f.fn(x)]); }
      var d='M '+sx(pts[0][0])+' '+sy(pts[0][1]);
      for(var i=1;i<pts.length;i++){
        d += ' L '+sx(pts[i][0])+' '+sy(pts[i-1][1]);
        d += ' L '+sx(pts[i][0])+' '+sy(pts[i][1]);
      }
      out += '<path d="'+d+'" fill="none" stroke="'+f.color+'" stroke-width="2.2" stroke-linejoin="round"/>';
    });
    var km = getKm();
    var desc1 = '横轴为乘距 0 至 135 公里，纵轴为票价 0 至 16 元。' + activeFares().length + ' 条阶梯曲线分别为：'
      + activeFares().map(function(f){ return f.name + ' 在 ' + km + ' 公里时 ' + f.fn(km) + ' 元'; }).join('；') + '。';
    out = '<title>上海地铁三方案全乘距票价阶梯图</title><desc>' + desc1 + '</desc>' + out;
    out += '<line class="crosshair" x1="'+sx(km)+'" y1="'+sy(yMin)+'" x2="'+sx(km)+'" y2="'+sy(yMax)+'"/>';
    out += '<text class="axis" x="'+sx(km)+'" y="'+(T-8)+'" text-anchor="middle" font-weight="700">'+km+' km</text>';
    activeFares().forEach(function(f){
      var y=f.fn(km);
      out += '<circle class="dot" cx="'+sx(km)+'" cy="'+sy(y)+'" r="4.5" fill="'+f.color+'"/>';
    });
    svg.innerHTML = out;
  }

  function renderCost(){
    var d = getKm();
    var rides = parseInt(ridesInput.value,10)||0;
    if(rides<1) rides=1;
    renderCostTable(costTable, d, rides, discInput.checked);
  }

  (function(){
    function off(){ document.querySelectorAll('.ride-chips[data-target="km"] button.on').forEach(function(x){ x.classList.remove('on'); }); }
    var rr = document.getElementById('ridesRange');
    if (rr) rr.addEventListener('input', off);
    ridesInput.addEventListener('input', off);
  })();
  document.querySelectorAll('.ride-chips[data-target="km"] button').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.getAttribute('data-rides');
      ridesInput.value = v;
      var rng = document.getElementById('ridesRange');
      if (rng) rng.value = v;
      b.parentNode.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x===b); });
      renderCost();
    });
  });

  function syncRange(){
    var v = getKm();
    range.value = Math.round(v);
    num.value = Math.round(v);
    renderCards(); renderChart(); renderCost();
  }
  range.addEventListener('input', function(){ num.value = range.value; syncRange(); });
  num.addEventListener('input', function(){ if(parseFloat(num.value)>135) range.max=Math.ceil(Math.max(135,parseFloat(num.value))); syncRange(); });
  document.querySelectorAll('.presets button').forEach(function(b){
    b.addEventListener('click', function(){ num.value = b.getAttribute('data-km'); syncRange(); });
  });
  ridesInput.addEventListener('input', renderCost);
  discInput.addEventListener('change', renderCost);

  window.__renderDist = function(){ renderCards(); renderChart(); renderCost(); };
  var ridesRange = document.getElementById('ridesRange');
  ridesRange.addEventListener('input', function(){ ridesInput.value = ridesRange.value; renderCost(); });
  ridesInput.addEventListener('input', function(){ ridesRange.value = ridesInput.value; });

  var showHearing = document.getElementById('showHearing');
  var showHearingS2s = document.getElementById('showHearingS2s');
  if (showHearing) {
    showHearing.addEventListener('change', function(){
      SHOW_HEARING = showHearing.checked;
      document.body.classList.toggle('show-hearing', SHOW_HEARING);
      if (showHearingS2s) showHearingS2s.checked = SHOW_HEARING;
      renderCards(); renderChart(); renderCost();
      if (window.__renderRoute) window.__renderRoute();
    });
  }

  /* 标签页切换/窗口变化后补一次测量，保证字号不被缩放 */
  var chTimer = 0;
  function remeasure(){ if(svg.clientWidth){ measureChart(); renderChart(); } }
  window.addEventListener('resize', function(){ clearTimeout(chTimer); chTimer = setTimeout(remeasure, 140); });
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('.tab') : null;
    if(t) setTimeout(remeasure, 60);
  });

  /* 点击/拖动图表直接选距离 */
  svg.style.cursor = 'crosshair';
  function svgKm(ev){
    var W=CHW, L=CHL, R=CHR, xMin=0, xMax=135;
    var rect = svg.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
    var px = (cx - rect.left) / rect.width * W;
    var km = Math.round(xMin + (px - L)/(W-L-R)*(xMax-xMin));
    return Math.max(1, Math.min(xMax, km));
  }
  var chartDragging = false;
  svg.addEventListener('mousedown', function(ev){ ev.preventDefault(); chartDragging = true; num.value = svgKm(ev); syncRange(); });
  window.addEventListener('mousemove', function(ev){ if(chartDragging){ num.value = svgKm(ev); syncRange(); } });
  window.addEventListener('mouseup', function(){ chartDragging = false; });
  svg.addEventListener('touchstart', function(ev){ chartDragging = true; num.value = svgKm(ev); syncRange(); ev.preventDefault(); }, {passive:false});
  svg.addEventListener('touchmove', function(ev){ if(chartDragging){ num.value = svgKm(ev); syncRange(); ev.preventDefault(); } }, {passive:false});
  window.addEventListener('touchend', function(){ chartDragging = false; });

  syncRange();
})();

/* ============ Tab3: 城市对比 ============ */
/* 各城市现行计价公式（单程原价，来源见规则卡片） */
function fareBJ(d){ if(d<=6) return 3; if(d<=12) return 4; if(d<=32) return 4+Math.ceil((d-12)/10); return 6+Math.ceil((d-32)/20); }
function fareGSH(d){ if(d<=4) return 2; if(d<=12) return 2+Math.ceil((d-4)/4); if(d<=24) return 4+Math.ceil((d-12)/6); return 6+Math.ceil((d-24)/8); }
function fareNJ(d){
  var steps=[5,5,7,7,9,11,13,15], price=2, km=4;
  for(var i=0;i<steps.length;i++){ if(d<=km) return price; km+=steps[i]; price+=1; }
  if(d<=km) return price;
  return price + Math.ceil((d-km)/15); /* 76km 以上官方未明示，按每 15km +1 外推 */
}
function fareCDWH(d){ if(d<=4) return 2; if(d<=12) return 2+Math.ceil((d-4)/4); if(d<=24) return 4+Math.ceil((d-12)/6); if(d<=40) return 6+Math.ceil((d-24)/8); if(d<=50) return 8+Math.ceil((d-40)/10); return 9+Math.ceil((d-50)/20); }

const CITY_FARES = [
  {key:'sh',   name:'上海·老方案',     short:'沪老方案', fn:fareCurrent, color:'#8a8a8a'},
  {key:'shf',  name:'上海·新方案', short:'沪新价', fn:fareFinal,   color:'#c8102e'},
  {key:'bj',   name:'北京',        short:'北京',   fn:fareBJ,      color:'#e6a23c'},
  {key:'gsh',  name:'广州 / 深圳 / 杭州', short:'穗深杭', fn:fareGSH, color:'#2e7d32'},
  {key:'nj',   name:'南京',        short:'南京',   fn:fareNJ,      color:'#7b1fa2'},
  {key:'cdwh', name:'成都 / 武汉', short:'蓉汉',   fn:fareCDWH,    color:'#00838f'}
];

const CITY_CARDS = [
  {name:'上海（2026 新方案）', color:'#c8102e',
   rule:'计程票制：起步 3 元可乘 4 公里；4–16 公里每 4 公里加 1 元，16–30 公里每 7 公里加 1 元，30–50 公里每 10 公里加 1 元，50–125 公里每 15 公里加 1 元。',
   meta:'优惠：月累计满 90 元后 9 折；计次票 35/45/60/90 次；一日票 24 元、三日票 60 元。2026-12-01 起执行；老方案（2005 版）与听证方案见「按乘距」页。',
   src:'https://www.shanghai.gov.cn/nw4411/20260820/65c1be2474c345339c39a9ad9c724fdf.html', srcName:'上海市人民政府'},
  {name:'北京', color:'#e6a23c',
   rule:'计程限时票制（首都机场线、大兴机场线除外）：起步 6 公里（含）内 3 元；6–12 公里（含）4 元；12–22 公里（含）5 元；22–32 公里（含）6 元；32 公里以上每增加 20 公里加 1 元，票价不封顶。',
   meta:'优惠：一卡通每自然月累计满 100 元后 8 折、满 150 元后 5 折、满 400 元后不再打折（月底清零）；部分车站工作日 7 时前进站 5 折。',
   src:'https://www.mtr.bj.cn/page/instructions.html', srcName:'京港地铁（票价方案原文）'},
  {name:'广州', color:'#2e7d32',
   rule:'里程分段计价、递远递减：起步 4 公里以内 2 元；4–12 公里每递增 4 公里加 1 元；12–24 公里每递增 6 公里加 1 元；24 公里以上每递增 8 公里加 1 元。APM 线单一票价 2 元。',
   meta:'优惠：同一羊城通卡/乘车码每自然月累计实付满 80 元不满 200 元部分 8 折、超 200 元部分 5 折（2023 年 9 月起，与公交合并累计）。2026 年内将举行票价机制优化听证。',
   src:'https://www.gz.gov.cn/zwfw/zxfw/jtfw/content/post_10395580.html', srcName:'广州市人民政府'},
  {name:'深圳', color:'#2e7d32',
   rule:'里程分段计价、同网同价：起步 4 公里以内 2 元；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24 公里以上每 1 元可乘 8 公里（与广州、杭州公式一致）。',
   meta:'优惠：深圳通卡（含虚拟卡）普通车厢 9.5 折；90 分钟内公交↔地铁换乘每人次优惠 0.4 元。',
   src:'https://www.sz.gov.cn/ztfw/jtly/wyc_184756/ggjtcx/csgdjtcx/content/post_7750833.html', srcName:'深圳政府在线'},
  {name:'杭州', color:'#2e7d32',
   rule:'计程票制：起步价 2 元可乘 4 公里；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24 公里以上每 1 元可乘 8 公里（与广州、深圳公式一致）。',
   meta:'优惠：储值卡/交通码每自然月累计消费 50 元以内 9 折、50（含）–100 元 7 折、100 元（含）以上 5 折（地铁公交合并累计）。',
   src:'https://hwyst.hangzhou.com.cn/mtld/content/2023-05/11/content_8531793.htm', srcName:'杭州网（官方解答）'},
  {name:'南京', color:'#7b1fa2',
   rule:'里程分段计价：起步价 2 元可乘 4 公里；4 公里以上部分，每 1 元晋级里程依次为 5、5、7、7、9、11、13、15 公里（即 3 元至 9km、4 元至 14km……10 元至 76km；76km 以上官方未明示，本页按每 15km 加 1 元外推）。',
   meta:'优惠：储值卡月累计 150 元以下乘次 9.5 折；超 150 元后 9 折；超 200 元后 8 折；超 300 元后恢复 9.5 折。',
   src:'https://www.njmetro.com.cn/njdtweb/portal/article-detail.do?rowId=4a8208ae7b6b11e9ac27000c2965e15a&columnId=40288e817180aad0017180ae38a40001&tag=infoopen3', srcName:'南京地铁（新闻发布会）'},
  {name:'成都', color:'#00838f',
   rule:'里程计价制：起步价 2 元可乘 4 公里；4–12 公里每递增 4 公里加 1 元；12–24 公里每递增 6 公里加 1 元；24–40 公里每递增 8 公里加 1 元；40–50 公里每递增 10 公里加 1 元；超过 50 公里每递增 20 公里加 1 元。',
   meta:'优惠：天府通卡/电子支付基本票价 9 折；每自然月单平台累计满 200 元后，自下次乘车起 6 折（各平台独立累计）。',
   src:'https://sichuan.scol.com.cn/ggxw/202312/82437556.html', srcName:'四川在线（官方问政答复）'},
  {name:'武汉', color:'#00838f',
   rule:'里程限时计费：起步 2 元可乘 4 公里；4–12 公里每 1 元可乘 4 公里；12–24 公里每 1 元可乘 6 公里；24–40 公里每 1 元可乘 8 公里；40–50 公里每 1 元可乘 10 公里；50 公里以上每 1 元可乘 20 公里（与成都公式一致）。进出闸限时 240 分钟。',
   meta:'优惠：武汉通卡 9 折；虚拟换乘车站 30 分钟内出站换乘连续计价。',
   src:'https://www.wuhan.gov.cn/hdjl/rdhy/202410/t20241027_2474108.shtml', srcName:'武汉市人民政府'}
];

(function(){
  var svg = document.getElementById('cityChart');
  if(!svg) return;
  var range = document.getElementById('cityKmRange');
  var num = document.getElementById('cityKmNum');
  var pricesBox = document.getElementById('cityPrices');

  function getKm(){ var v = parseFloat(num.value); return (isNaN(v)||v<1)?1:Math.min(v,135); }

  /* 图例 */
  var hidden = {};
  var legendEl = document.getElementById('cityLegend');
  function renderLegend(){
    var lg = '';
    CITY_FARES.forEach(function(f){
      lg += '<span data-key="'+f.key+'" class="'+(hidden[f.key]?'off':'')+'" title="点击显示/隐藏该曲线"'
          + ' role="button" tabindex="0" aria-pressed="'+(hidden[f.key]?'false':'true')+'"'
          + ' aria-label="'+f.name+(hidden[f.key]?'，当前已隐藏，按回车显示':'，当前已显示，按回车隐藏')+'">'
          + '<i class="sw" style="background:'+f.color+'"></i>'+f.name+'</span>';
    });
    legendEl.innerHTML = lg;
  }
  renderLegend();
  legendEl.addEventListener('keydown', function(ev){
    if(ev.key !== 'Enter' && ev.key !== ' ') return;
    var sp = ev.target.closest ? ev.target.closest('span[data-key]') : null;
    if(!sp) return;
    ev.preventDefault(); sp.click();
  });
  legendEl.addEventListener('click', function(ev){
    var sp = ev.target.closest ? ev.target.closest('span[data-key]') : null;
    if(!sp) return;
    var k = sp.getAttribute('data-key');
    var shown = CITY_FARES.filter(function(f){ return !hidden[f.key]; });
    if(!hidden[k] && shown.length <= 1) return;  /* 至少保留一条 */
    hidden[k] = !hidden[k];
    renderLegend(); renderChart(); renderPrices();
  });

  /* 阶梯图 */
  var W=920, H=400, L=44, R=16, T=30, B=36;
  function measureChart(){
    var cw = svg.clientWidth || 900;
    W = Math.max(300, Math.round(cw));
    H = W < 560 ? 330 : 420;
    L = W < 560 ? 34 : 42;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }
  measureChart();
  /* 容器宽度变化（含切到本标签页）时重算，保证 11px 字号不被缩放 */
  var rtimer = 0;
  window.addEventListener('resize', function(){
    clearTimeout(rtimer);
    rtimer = setTimeout(function(){ measureChart(); renderChart(); }, 140);
  });
  /* 标签页切换后容器才可见，补一次测量 */
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('.tab') : null;
    if(!t) return;
    setTimeout(function(){ if(svg.clientWidth){ measureChart(); renderChart(); } }, 60);
  });
  if(window.ResizeObserver){
    window.__cityChartRO = new ResizeObserver(function(){
      var cw = svg.clientWidth;
      if(cw && Math.abs(cw - W) > 2){ measureChart(); renderChart(); }
    });
    window.__cityChartRO.observe(svg);
  }
  var xMin=0, xMax=135, yMin=0, yMax=20;
  function sx(x){ return L + (x-xMin)/(xMax-xMin)*(W-L-R); }
  function sy(y){ return H-B - (y-yMin)/(yMax-yMin)*(H-T-B); }

  function renderChart(){
    if(svg.clientWidth && Math.abs(svg.clientWidth - W) > 2) measureChart();
    var km = getKm();
    var out = '';
    for(var y=0;y<=yMax;y+=2){
      out += '<line class="grid" x1="'+sx(xMin)+'" y1="'+sy(y)+'" x2="'+sx(xMax)+'" y2="'+sy(y)+'"/>';
      out += '<text class="axis" x="'+(L-8)+'" y="'+(sy(y)+4)+'" text-anchor="end">'+y+'</text>';
    }
    [0,20,40,60,80,100,120].forEach(function(x){
      out += '<line class="grid" x1="'+sx(x)+'" y1="'+sy(yMin)+'" x2="'+sx(x)+'" y2="'+sy(yMax)+'"/>';
      out += '<text class="axis" x="'+sx(x)+'" y="'+(H-B+18)+'" text-anchor="middle">'+x+'</text>';
    });
    out += '<text class="axis" x="'+sx(xMax)+'" y="'+(H-B+18)+'" text-anchor="end">公里</text>';
    out += '<text class="axis" x="'+(L-8)+'" y="14" text-anchor="end">元</text>';
    CITY_FARES.forEach(function(f){
      if(hidden[f.key]) return;
      var d='M '+sx(1)+' '+sy(f.fn(1));
      var prev=f.fn(1);
      for(var x=2;x<=xMax;x++){
        var v=f.fn(x);
        d += ' L '+sx(x)+' '+sy(prev);
        d += ' L '+sx(x)+' '+sy(v);
        prev=v;
      }
      out += '<path d="'+d+'" fill="none" stroke="'+f.color+'" stroke-width="2.2" stroke-linejoin="round" opacity="0.9"/>';
    });
    var shownF = CITY_FARES.filter(function(f){ return !hidden[f.key]; });
    var desc3 = '横轴为乘距 0 至 135 公里，纵轴为票价 0 至 20 元。当前显示 ' + shownF.length + ' 条曲线，'
      + shownF.map(function(f){ return f.name + ' 在 ' + km + ' 公里时 ' + f.fn(km) + ' 元'; }).join('；') + '。';
    out = '<title>各城市地铁票价阶梯对比图</title><desc>' + desc3 + '</desc>' + out;
    out += '<line class="crosshair" x1="'+sx(km)+'" y1="'+sy(yMin)+'" x2="'+sx(km)+'" y2="'+sy(yMax)+'"/>';
    out += '<text class="axis" x="'+sx(km)+'" y="'+(T-8)+'" text-anchor="middle" font-weight="700">'+km+' km</text>';
    CITY_FARES.forEach(function(f){
      if(hidden[f.key]) return;
      var y=f.fn(km);
      out += '<circle class="dot" cx="'+sx(km)+'" cy="'+sy(y)+'" r="4.5" fill="'+f.color+'"/>';
    });
    svg.innerHTML = out;
  }

  function renderPrices(){
    var km = getKm();
    var vals = CITY_FARES.map(function(f){ return f.fn(km); });
    var shownVals = CITY_FARES.filter(function(f){ return !hidden[f.key]; }).map(function(f){ return f.fn(km); });
    var min = Math.min.apply(null, shownVals);
    var html = '';
    CITY_FARES.forEach(function(f, i){
      if(hidden[f.key]) return;
      html += '<div class="cp-chip'+(vals[i]===min?' low':'')+'">'
        + '<span class="cdot" style="background:'+f.color+'"></span>'
        + '<span class="cp-name">'+f.name+'</span>'
        + '<span class="cp-fare">'+vals[i]+' 元</span>'
        + '</div>';
    });
    pricesBox.innerHTML = html;
  }

  function sync(){
    var v = getKm();
    range.value = Math.round(v);
    num.value = Math.round(v);
    renderChart(); renderPrices();
  }
  range.addEventListener('input', function(){ num.value = range.value; sync(); });
  num.addEventListener('input', sync);
  document.querySelectorAll('#cityPresets button').forEach(function(b){
    b.addEventListener('click', function(){ num.value = b.getAttribute('data-km'); sync(); });
  });

  /* 点击/拖动图表直接选距离 */
  function svgKm(ev){
    var rect = svg.getBoundingClientRect();
    var cx = (ev.touches ? ev.touches[0].clientX : ev.clientX);
    var px = (cx - rect.left) / rect.width * W;
    var km = Math.round(xMin + (px - L)/(W-L-R)*(xMax-xMin));
    return Math.max(1, Math.min(xMax, km));
  }
  var dragging = false;
  svg.addEventListener('mousedown', function(ev){ ev.preventDefault(); dragging = true; num.value = svgKm(ev); sync(); });
  window.addEventListener('mousemove', function(ev){ if(dragging){ num.value = svgKm(ev); sync(); } });
  window.addEventListener('mouseup', function(){ dragging = false; });
  svg.addEventListener('touchstart', function(ev){ dragging = true; num.value = svgKm(ev); sync(); ev.preventDefault(); }, {passive:false});
  svg.addEventListener('touchmove', function(ev){ if(dragging){ num.value = svgKm(ev); sync(); ev.preventDefault(); } }, {passive:false});
  window.addEventListener('touchend', function(){ dragging = false; });

  sync();

  /* 票价里程区间对照表：每档票价各城市能坐几到几公里 */
  var SCAN_MAX = 135;
  var cityBrackets = CITY_FARES.map(function(f){
    var m = {};
    for(var d=1; d<=SCAN_MAX; d++){
      var p = f.fn(d);
      if(!m[p]) m[p] = {lo:d-1, hi:d};
      else m[p].hi = d;
    }
    return m;
  });
  var maxPrice = 0;
  cityBrackets.forEach(function(m){
    Object.keys(m).forEach(function(k){ maxPrice = Math.max(maxPrice, +k); });
  });
  var html = '<table class="cost"><thead><tr><th>票价</th>';
  CITY_FARES.forEach(function(f){ html += '<th title="'+f.name+'"><span class="th-full">'+f.name+'</span><span class="th-short">'+f.short+'</span></th>'; });
  html += '</tr></thead><tbody>';
  for(var price=2; price<=maxPrice; price++){
    var cells = cityBrackets.map(function(m){
      var b = m[price];
      if(!b) return null;
      if(b.hi >= SCAN_MAX) return {txt:'&gt;'+b.lo+' km', hi:Infinity};
      if(b.lo === 0) return {txt:'≤'+b.hi+' km', hi:b.hi};
      return {txt:b.lo+'–'+b.hi+' km', hi:b.hi};
    });
    var maxHi = -1;
    cells.forEach(function(c){ if(c && isFinite(c.hi)) maxHi = Math.max(maxHi, c.hi); });
    html += '<tr><td>'+price+' 元</td>';
    cells.forEach(function(c){
      if(!c){ html += '<td>—</td>'; return; }
      var best = isFinite(c.hi) && c.hi === maxHi && maxHi > 0;
      html += '<td'+(best?' class="cheap"':'')+'>'+c.txt+'</td>';
    });
    html += '</tr>';
  }
  html += '</tbody></table>';
  document.getElementById('cityTable').innerHTML = html;

  /* 典型乘距票价对照表 */
  var DISTS = [5, 10, 16, 25, 40, 60, 80, 124];
  var dhtml = '<table class="cost"><thead><tr><th>乘距</th>';
  CITY_FARES.forEach(function(f){ dhtml += '<th title="'+f.name+'"><span class="th-full">'+f.name+'</span><span class="th-short">'+f.short+'</span></th>'; });
  dhtml += '</tr></thead><tbody>';
  DISTS.forEach(function(d){
    var vals = CITY_FARES.map(function(f){ return f.fn(d); });
    var min = Math.min.apply(null, vals);
    dhtml += '<tr><td>'+d+' km</td>';
    vals.forEach(function(v){
      dhtml += '<td'+(v===min?' class="cheap"':'')+'>'+v+'</td>';
    });
    dhtml += '</tr>';
  });
  dhtml += '</tbody></table>';
  document.getElementById('cityDistTable').innerHTML = dhtml;

  /* 规则卡片 */
  var cards = '';
  CITY_CARDS.forEach(function(c){
    cards += '<div class="city-card">'
      + '<h3><span class="cdot" style="background:'+c.color+'"></span>'+c.name+'</h3>'
      + '<p class="rule">'+c.rule+'</p>'
      + '<p class="meta">'+c.meta+' 来源：<a href="'+c.src+'" target="_blank" rel="noopener">'+c.srcName+'</a></p>'
      + '</div>';
  });
  document.getElementById('cityCards').innerHTML = cards;
})();

/* ============ Tab2: 站到站 ============ */
(function(){
  // 构建图（里程权重）
  var graph = {};
  METRO_DATA.edges.forEach(function(e){
    (graph[e.a] = graph[e.a]||{})[e.b] = {d:e.d, l:e.l};
    (graph[e.b] = graph[e.b]||{})[e.a] = {d:e.d, l:e.l};
  });
  var LINE_LIST = LINE_ORDER.filter(function(ln){ return METRO_DATA.lines[ln] && METRO_DATA.lines[ln].length; });

  /* ---- 轻量下拉组件（线路 / 站点，可搜索） ---- */
  function mkPicker(root, opt){
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'pick-btn';
    btn.setAttribute('aria-label', opt.label);
    var panel = document.createElement('div'); panel.className = 'pick-panel';
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'pick-search';
    input.placeholder = opt.searchPh || '搜索'; input.autocomplete = 'off';
    var list = document.createElement('div'); list.className = 'pick-list';
    panel.appendChild(input); panel.appendChild(list);
    root.appendChild(btn); root.appendChild(panel);

    var value = null, src = [], api = {};

    function renderBtn(){
      var all = opt.items('') || [], hit = null;
      for (var i = 0; i < all.length; i++) if (all[i].value === value) { hit = all[i]; break; }
      btn.innerHTML = hit
        ? (opt.glyph ? opt.glyph(hit) : '') + '<span class="pick-text">' + hit.label + '</span><i class="pick-caret"></i>'
        : '<span class="pick-ph">' + opt.label + '</span><i class="pick-caret"></i>';
    }
    function renderList(q){
      src = opt.items(q) || [];
      list.innerHTML = src.length ? src.map(function(it, i){
        return '<div class="pick-item' + (it.value === value ? ' on' : '') + '" data-i="' + i + '">'
          + (opt.glyph ? opt.glyph(it) : '') + '<span class="pick-name">' + it.label + '</span>'
          + (it.sub ? '<span class="pick-sub">' + it.sub + '</span>' : '') + '</div>';
      }).join('') : '<div class="pick-empty">没有匹配</div>';
      list.querySelectorAll('.pick-item').forEach(function(el){
        el.addEventListener('click', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          var it = src[+el.getAttribute('data-i')];
          var changed = it.value !== value;
          value = it.value; renderBtn(); close();
          if (opt.onpick) opt.onpick(it.value, changed);
        });
      });
    }
    function open(){
      /* 同一时间只允许一个下拉展开 */
      document.querySelectorAll('.pick-panel.open').forEach(function(el){ if (el !== panel) el.classList.remove('open'); });
      panel.classList.add('open'); input.value = ''; renderList('');
      panel.style.left = '0px';
      var r = btn.getBoundingClientRect();
      var vw = window.innerWidth || document.documentElement.clientWidth;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      /* 移动端由 CSS 媒体查询接管（fixed 铺满宽度），这里只给 top 变量 */
      panel.style.setProperty('--pick-top', Math.round(r.bottom + 6) + 'px');
      if (vw >= 601){
        var pw = panel.offsetWidth || 268;
        var shift = Math.min(0, vw - 10 - (r.left + pw));
        if (shift < 0) panel.style.left = shift + 'px';
      }
      input.focus();
    }
    function close(){ panel.classList.remove('open'); }
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      panel.classList.contains('open') ? close() : open();
    });
    input.addEventListener('input', function(){ renderList(input.value.trim()); });
    input.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ var f = list.querySelector('.pick-item'); if (f) f.click(); }
      if (e.key === 'Escape'){ close(); btn.focus(); }
    });
    document.addEventListener('click', function(e){ if (!root.contains(e.target)) close(); });

    api.get = function(){ return value; };
    api.set = function(v){ value = v; renderBtn(); };
    api.refresh = renderBtn;
    api.rebuild = function(){ if (panel.classList.contains('open')) renderList(input.value.trim()); };
    return api;
  }

  /* ---- 每端一个复合选择器：线路 + 站点，均可搜索 ---- */
  function Endpoint(prefix, defLine, defStation){
    var search = document.getElementById(prefix+'Search');
    var suggest = document.getElementById(prefix+'Suggest');
    var self = {onchange:null};
    var curLine = defLine, curSta = defStation;

    function dotsOf(name){
      var lns = (METRO_DATA.stations[name] || []).slice();
      var i = lns.indexOf(curLine);
      if (i > 0) { lns.splice(i, 1); lns.unshift(curLine); }   /* 当前线路排最前 */
      if (!lns.length) lns = [curLine];
      var dots = lns.slice(0, 4).map(function(l){
        return '<span class="pick-dot1" style="background:' + (LINE_COLORS[l] || '#888') + '" title="' + l + '"></span>';
      }).join('');
      return '<span class="pick-dots">' + dots + '</span>';
    }
    function chipOf(ln){
      return '<span class="pick-chip" style="background:'+(LINE_COLORS[ln]||'#888')+'"></span>';
    }

    var linePick = mkPicker(document.getElementById(prefix+'LinePick'), {
      label: '线路', searchPh: '搜索线路',
      items: function(q){
        var out = [];
        for (var i = 0; i < LINE_LIST.length; i++){
          var ln = LINE_LIST[i];
          if (q && ln.indexOf(q) < 0) continue;
          out.push({value: ln, label: ln, glyph: chipOf(ln)});
        }
        return out;
      },
      glyph: function(it){ return it.glyph; },
      onpick: function(ln){
        curLine = ln;
        var names = METRO_DATA.lines[ln] || [];
        if (names.indexOf(curSta) < 0) curSta = names[0];
        staPick.set(curSta);
        if (staPick.rebuild) staPick.rebuild();
        fire();
      }
    });

    var staPick = mkPicker(document.getElementById(prefix+'SelPick'), {
      label: '站点', searchPh: '搜索站名 / 拼音',
      items: function(q){
        q = (q||'').trim().toLowerCase();
        var pool = q ? Object.keys(METRO_DATA.stations) : (METRO_DATA.lines[curLine] || []);
        var out = [];
        for (var i = 0; i < pool.length; i++){
          var n = pool[i], py = METRO_DATA.py[n] || ['',''];
          if (q && n.indexOf(q) < 0 && py[0].indexOf(q) < 0 && py[1].indexOf(q) < 0) continue;
          out.push({value: n, label: n, sub: py[0] || '', glyph: dotsOf(n)});
          if (q && out.length >= 40) break;
        }
        return out;
      },
      glyph: function(it){ return it.glyph; },
      onpick: function(name){
        curSta = name;
        var lines = METRO_DATA.stations[name] || [];
        if (lines.indexOf(curLine) < 0 && lines.length){ curLine = lines[0]; linePick.set(curLine); }
        staPick.refresh();
        fire();
      }
    });

    function fire(){ if (self.onchange) self.onchange(); }

    function pick(name){
      if (!METRO_DATA.stations[name]) return;
      var lines = METRO_DATA.stations[name] || [];
      curLine = lines.indexOf(curLine) >= 0 ? curLine : lines[0];
      curSta = name;
      linePick.set(curLine);
      staPick.set(name);
      if (search) search.value = '';
      if (suggest) suggest.classList.remove('open');
      fire();
    }

    /* 拼音 / 汉字搜索 */
    var hoverIdx = -1, items = [];
    function doSearch(q){
      q = q.trim().toLowerCase();
      items = []; hoverIdx = -1;
      if (!q){ suggest.classList.remove('open'); suggest.innerHTML = ''; return; }
      var res = [];
      for (var name in METRO_DATA.stations){
        var py = METRO_DATA.py[name] || ['',''];
        var full = py[0], init = py[1], score = -1;
        if (name.indexOf(q) >= 0){ score = name.indexOf(q) === 0 ? 0 : 1; }
        else if (init.indexOf(q) === 0){ score = 2; }
        else if (full.indexOf(q) === 0){ score = 3; }
        else if (init.indexOf(q) > 0){ score = 4; }
        else if (full.indexOf(q) > 0){ score = 5; }
        if (score >= 0) res.push({name: name, score: score, py: full});
      }
      res.sort(function(a,b){ return a.score - b.score || a.name.length - b.name.length || (a.name < b.name ? -1 : 1); });
      res = res.slice(0, 12);
      items = res;
      if (!res.length){
        suggest.innerHTML = '<div class="sg-empty">没有匹配的车站</div>';
        suggest.classList.add('open'); return;
      }
      suggest.innerHTML = res.map(function(r, i){
        var dots = (METRO_DATA.stations[r.name]||[]).map(function(ln){
          return '<span class="ln-dot" style="background:'+(LINE_COLORS[ln]||'#888')+'" title="'+ln+'"></span>';
        }).join('');
        return '<div class="sg-item" data-i="'+i+'">'+dots+'<span>'+r.name+'</span><span class="py">'+r.py+'</span></div>';
      }).join('');
      suggest.classList.add('open');
      suggest.querySelectorAll('.sg-item').forEach(function(el){
        el.addEventListener('click', function(ev){
          ev.preventDefault(); ev.stopPropagation();
          pick(items[+el.getAttribute('data-i')].name);
        });
      });
    }
    if (search) search.addEventListener('input', function(){ doSearch(search.value); });
    if (search) search.addEventListener('blur', function(){ setTimeout(function(){ suggest.classList.remove('open'); }, 150); });
    if (search) search.addEventListener('keydown', function(e){
      if (!items.length) return;
      if (e.key === 'ArrowDown'){ hoverIdx = Math.min(items.length-1, hoverIdx+1); e.preventDefault(); }
      else if (e.key === 'ArrowUp'){ hoverIdx = Math.max(0, hoverIdx-1); e.preventDefault(); }
      else if (e.key === 'Enter'){ if (hoverIdx >= 0) pick(items[hoverIdx].name); return; }
      else return;
      suggest.querySelectorAll('.sg-item').forEach(function(el, i){ el.classList.toggle('on', i === hoverIdx); });
    });

    self.get = function(){ return curSta; };
    self.set = function(name){ pick(name); };
    self.line = function(){ return curLine; };
    var _names0 = METRO_DATA.lines[defLine] || [];
    curSta = _names0.indexOf(defStation) >= 0 ? defStation : _names0[0];
    linePick.set(defLine);
    staPick.set(curSta);
    return self;
  }

  var epFrom = Endpoint('from', '1号线', '人民广场');
  var epTo = Endpoint('to', '1号线', '徐家汇');
  window.__getS2S = function(){ return { from: epFrom.get(), to: epTo.get() }; };
  window.__setS2S = function(f, t){ if (f) epFrom.set(f); if (t) epTo.set(t); };

  var ridesS2s = document.getElementById('ridesS2s');
  var discS2s = document.getElementById('discountS2s');
  var costTableS2s = document.getElementById('costTableS2s');
  var lastKm = null;

  function dijkstra(src){
    var dist = {}; dist[src] = 0;
    var prev = {};
    var pq = [[0, src]];
    while(pq.length){
      pq.sort(function(x,y){return x[0]-y[0];});
      var top = pq.shift(); var d = top[0], u = top[1];
      if(d > (dist[u]===undefined?Infinity:dist[u])) continue;
      var nbrs = graph[u]||{};
      for(var v in nbrs){
        var nd = d + nbrs[v].d;
        if(nd < (dist[v]===undefined?Infinity:dist[v])){
          dist[v] = nd; prev[v] = u; pq.push([nd, v]);
        }
      }
    }
    return {dist:dist, prev:prev};
  }

  function renderCostS2s(){
    if(lastKm===null){ costTableS2s.innerHTML=''; return; }
    var rides = parseInt(ridesS2s.value,10)||0;
    if(rides<1) rides=1;
    renderCostTable(costTableS2s, lastKm, rides, discS2s.checked);
  }

  /* ---------- 线路图（站点坐标来自官方地图接口） ---------- */
  var MAPXY = null, MAPREQ = null, MAPGEO = null;
  function loadMapXY(){
    if (MAPXY) return Promise.resolve(MAPXY);
    if (!MAPREQ){
      MAPREQ = fetch('data/map_geo.json?v=2', {cache:'force-cache'})
        .then(function(r){ return r.json(); })
        .then(function(d){
          d = d || {};
          MAPXY = d.st || {};                 /* 站点：官方图 1:1 页面坐标 */
          MAPGEO = d;
          var b = '';
          (d.base || []).forEach(function(x){ b += '<path class="lbase" d="' + x + '"/>'; });
          OFFICIAL_MAP = b;
          return MAPXY;
        })
        .catch(function(){ MAPXY = {}; return MAPXY; });
    }
    return MAPREQ;
  }

  var MW = 1000, MH = 1400;   /* 坐标系：与世界地图同比例的 x/y 空间 */

  function pt(G, name){ var q = G[name]; return q ? [q[0], q[1]] : null; }

  /* Catmull-Rom -> 三次贝塞尔，接近官方图的圆滑走向 */
  function smooth(pts){
    /* 官方线路图风格：直线段 + 拐角圆弧，不做样条拉伸 */
    if (!pts.length) return '';
    var f = function(v){ return v.toFixed(1); };
    if (pts.length < 3) return 'M' + pts.map(function(p){ return f(p[0]) + ',' + f(p[1]); }).join('L');
    var R = 9;
    var d = 'M' + f(pts[0][0]) + ',' + f(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++){
      var a = pts[i-1], p1 = pts[i], b = pts[i+1];
      var v1x = p1[0]-a[0], v1y = p1[1]-a[1], v2x = b[0]-p1[0], v2y = b[1]-p1[1];
      var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
      if (!l1 || !l2){ d += 'L' + f(p1[0]) + ',' + f(p1[1]); continue; }
      var r = Math.min(R, l1/2, l2/2);
      var s1x = p1[0]-v1x/l1*r, s1y = p1[1]-v1y/l1*r;
      var s2x = p1[0]+v2x/l2*r, s2y = p1[1]+v2y/l2*r;
      d += 'L' + f(s1x) + ',' + f(s1y) + 'Q' + f(p1[0]) + ',' + f(p1[1]) + ' ' + f(s2x) + ',' + f(s2y);
    }
    var last = pts[pts.length-1];
    d += 'L' + f(last[0]) + ',' + f(last[1]);
    return d;
  }

  /* 全网底图：官方线路图矢量（service.shmetro.com/xltzt，站名坐标同源，等比缩放 0.379 对齐坐标轴） */
  var OFFICIAL_MAP = '';
  function mapBase(G, k){ return OFFICIAL_MAP; }

  function routePts(G, segs){
    var groups = [];
    segs.forEach(function(sg){
      var seq = lineSlice(sg.line, sg.from, sg.to), pts = [];
      for (var i = 0; i < seq.length; i++){ var q = pt(G, seq[i]); if (q) pts.push(q); }
      if (pts.length > 1) groups.push({pts: pts, color: lineColor(sg.line)});
    });
    return groups;
  }


  function segGeo(line, seq){
    if (!MAPGEO || !MAPGEO.seg) return null;
    var d = '';
    for (var i = 0; i < seq.length - 1; i++){
      var a = seq[i], b = seq[i+1];
      var g = MAPGEO.seg[a + '|' + b + '|' + line], rev = false;
      if (!g){ g = MAPGEO.seg[b + '|' + a + '|' + line]; rev = true; }
      if (!g) return null;
      var pts = g.slice(1).split('L');
      if (rev) pts.reverse();
      d += (d ? 'L' : 'M') + pts.join('L');
    }
    return d;
  }
  function mapRoute(G, segs, k){
    var out = '';
    segs.forEach(function(sg){
      var seq = lineSlice(sg.line, sg.from, sg.to);
      var d = segGeo(sg.line, seq);
      if (!d){
        var pts = []; seq.forEach(function(n){ var q = pt(G, n); if (q) pts.push(q); });
        if (pts.length < 2) return;
        d = smooth(pts);
      }
      var g = {color: lineColor(sg.line)};
      out += '<path class="mhalo" d="' + d + '" fill="none" stroke-width="' + (9*k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
      out += '<path d="' + d + '" fill="none" stroke="' + g.color + '" stroke-width="' + (5*k).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    return out;
  }

  function mapStops(G, segs, from, to, k){
    var marks = {}, out = '';
    segs.forEach(function(sg, i){
      if (i === 0) marks[sg.from] = 'end';
      marks[sg.to] = (i === segs.length-1) ? 'end' : 'inter';
    });
    [from, to].forEach(function(nm){ marks[nm] = 'flag'; });
    for (var nm in marks){
      var q = pt(G, nm);
      if (!q) continue;
      var r = (marks[nm] === 'flag' ? 6.5 : 4.5) * k;
      out += '<circle class="mstop ' + marks[nm] + '" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="' + r.toFixed(2) + '" stroke-width="' + (1.6*k).toFixed(2) + '">'
           + '<title>' + nm + '</title></circle>';
    }
    return out;
  }

  /* 小图常显：起点、终点、换乘站的站名 */
  function mapStopLabels(G, segs, from, to, k, vb){
    var marks = {};
    segs.forEach(function(sg, i){
      if (i === 0) marks[sg.from] = 'flag';
      marks[sg.to] = (i === segs.length - 1) ? 'flag' : 'inter';
    });
    marks[from] = 'flag'; marks[to] = 'flag';
    var b = vb.split(' ').map(Number), out = '<g class="mlabels-sm">';
    for (var nm in marks){
      var q = pt(G, nm); if (!q) continue;
      var flip = (q[0] + 10*k + nm.length*7.2*k) > (b[0] + b[2]);
      var x = flip ? q[0] - 8*k : q[0] + 8*k;
      out += '<text class="mlab-sm' + (marks[nm] === 'flag' ? ' flag' : '') + '" x="' + x.toFixed(1)
           + '" y="' + (q[1] + 3.4*k).toFixed(1) + '" text-anchor="' + (flip ? 'end' : 'start') + '">' + nm + '</text>';
    }
    return out + '</g>';
  }

  function mapMidStops(G, segs, k){
    var seen = {}, out = '';
    segs.forEach(function(sg){
      var seq = lineSlice(sg.line, sg.from, sg.to);
      seq.forEach(function(nm){
        if (seen[nm]) return; seen[nm] = 1;
        var q = pt(G, nm); if (!q) return;
        out += '<circle class="mstop mid" cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1)
             + '" r="' + (3.4*k).toFixed(2) + '" stroke-width="' + (1.4*k).toFixed(2) + '">'
             + '<title>' + nm + '</title></circle>';
      });
    });
    return '<g class="mids" style="display:none">' + out + '</g>';
  }

  /* 按路径范围裁出 2:1 的横向视野 */
  function mapViewBox(groups){
    var xs = [], ys = [];
    groups.forEach(function(g){ g.pts.forEach(function(p){ xs.push(p[0]); ys.push(p[1]); }); });
    if (!xs.length) return '0 0 ' + MW + ' ' + (MH*0.6);
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = Math.max(maxX-minX, 140), h = Math.max(maxY-minY, 140);
    var pad = Math.max(w, h) * 0.16;
    w += pad*2; h += pad*2;
    var RATIO = window.innerWidth < 900 ? 1.7 : 2.35;
    if (w/h < RATIO) w = h*RATIO; else h = w/RATIO;
    var cx = (minX+maxX)/2, cy = (minY+maxY)/2;
    return [ (cx-w/2).toFixed(1), (cy-h/2).toFixed(1), w.toFixed(1), h.toFixed(1) ].join(' ');
  }

  /* ---------- 全屏地图查看器：双指缩放 / 拖拽 / 滚轮 / 双击 ---------- */
  function openMapViewer(srcSvg){
    var full = srcSvg.cloneNode(true);
    var smallLabels = full.querySelector('.mlabels-sm');
    if (smallLabels) smallLabels.parentNode.removeChild(smallLabels);
    var vb0 = (srcSvg.getAttribute('data-full') || '0 0 1000 1400').split(' ').map(Number);
    var vbR = srcSvg.getAttribute('viewBox').split(' ').map(Number);   /* 初始视野=路径附近 */
    full.removeAttribute('preserveAspectRatio');
    full.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    var ov = document.createElement('div');
    ov.className = 'mapv';
    ov.innerHTML = '<div class="mapv-bar"><span>线路图 · 双指或滚轮缩放，拖动平移</span>'
      + '<button type="button" class="mapv-btn" data-z="in" aria-label="放大">＋</button>'
      + '<button type="button" class="mapv-btn" data-z="out" aria-label="缩小">－</button>'
      + '<button type="button" class="mapv-btn" data-z="fit" aria-label="全图">全图</button>'
      + '<button type="button" class="mapv-btn mapv-mid" aria-pressed="false" aria-label="显示沿途站点">沿途站点</button>'
      + '<button type="button" class="mapv-btn mapv-net" aria-pressed="false" aria-label="显示全网站点">全网站点</button>'
      + '<button type="button" class="mapv-close" aria-label="关闭">×</button></div>'
      + '<div class="mapv-stage"></div>';
    ov.querySelector('.mapv-stage').appendChild(full);
    document.body.appendChild(ov);
    document.body.classList.add('map-zoom-open');

    var stage = ov.querySelector('.mapv-stage');
    var vb = vbR.slice();

    /* ---- 大图：全网站点 + 站名（屏幕空间避让，绝不重叠） ---- */
    var NSV = 'http://www.w3.org/2000/svg';
    var ROUTE = {}, ROUTEX = {}, FLAGS = {}, LABS = [], DOTS = [], NETLAYER = null;
    (function(){
      var collect = function(sel, set){
        full.querySelectorAll(sel).forEach(function(c){
          var t = c.querySelector('title'); if (t) set[t.textContent] = 1;
        });
      };
      collect('.mids circle', ROUTE); collect('.mstop.flag', ROUTE);
      collect('.mstop.inter', ROUTE); collect('.mstop.end', ROUTE);
      collect('.mstop.flag', FLAGS);
      /* 高亮线路内的起点/终点/换乘站：默认只显示这些 */
      collect('.mstop.flag', ROUTEX); collect('.mstop.inter', ROUTEX); collect('.mstop.end', ROUTEX);

      var netG = document.createElementNS(NSV, 'g'); netG.setAttribute('class', 'netdots');
      netG.style.display = 'none'; NETLAYER = netG;
      var labG = document.createElementNS(NSV, 'g'); labG.setAttribute('class', 'mlabels');
      var G = MAPXY || {};
      Object.keys(G).forEach(function(nm){
        var q = G[nm]; if (!q) return;
        var lines = (typeof METRO_DATA !== 'undefined' && METRO_DATA.stations && METRO_DATA.stations[nm]) || [];
        var tr = lines.length > 1;
        var c = document.createElementNS(NSV, 'circle');
        c.setAttribute('class', 'mstop all' + (tr ? ' tr' : ''));
        c.setAttribute('cx', q[0].toFixed(1)); c.setAttribute('cy', q[1].toFixed(1));
        var ti = document.createElementNS(NSV, 'title'); ti.textContent = nm;
        c.appendChild(ti); netG.appendChild(c);

        var t = document.createElementNS(NSV, 'text');
        t.setAttribute('class', 'mlab' + (tr ? ' tr' : ''));
        t.setAttribute('text-anchor', 'start');
        t.setAttribute('dominant-baseline', 'middle');
        t.textContent = nm; t.style.display = 'none';
        labG.appendChild(t);
        LABS.push({ n: nm, x: q[0], y: q[1], tr: tr, el: t });
      });
      var stops = full.querySelectorAll('.mstop');
      if (stops.length) full.insertBefore(netG, stops[0]); else full.appendChild(netG);
      full.appendChild(labG);
      DOTS = Array.prototype.slice.call(full.querySelectorAll('circle.mstop'));
    })();

    var layoutT = null;
    function scheduleLayout(){
      if (layoutT) clearTimeout(layoutT);
      layoutT = setTimeout(function(){ layoutT = null; layoutAll(); }, 60);
    }
    function layoutAll(){
      var W = stage.clientWidth || 1, H = stage.clientHeight || 1;
      var upp = vb[2] / W;                 /* 1 屏幕像素 = 多少用户单位 */
      DOTS.forEach(function(c){
        var r, sw;
        if (c.classList.contains('flag')){ r = 7; sw = 2.8; }
        else if (c.classList.contains('end')){ r = 5.6; sw = 2.4; }
        else if (c.classList.contains('all')){
          if (c.classList.contains('tr')){ r = 3.4; sw = 1.7; } else { r = 1.6; sw = 1.0; }
        }
        else if (c.classList.contains('inter')){ r = 4.4; sw = 2.0; }
        else { r = 3.2; sw = 1.1; }
        c.setAttribute('r', (r * upp).toFixed(2));
        c.setAttribute('stroke-width', (sw * upp).toFixed(2));
      });

      var midOn = midBtn && midBtn.classList.contains('on');
      var netOn = netBtn && netBtn.classList.contains('on');
      /* 默认：只有本线的起点/终点/换乘站；勾沿途=本线全站；勾全网=全部 */
      function showable(nm){
        if (netOn) return true;
        if (FLAGS[nm] || ROUTEX[nm]) return true;
        return !!(midOn && ROUTE[nm]);
      }
      var FS = W < 620 ? 10 : 11;
      var kx = W / vb[2], ky = H / vb[3];
      var PAD = 3;                         /* 站名之间的安全间距（屏幕像素） */
      function prio(L){
        if (FLAGS[L.n]) return 0;
        if (midOn && ROUTE[L.n]) return 1;
        if (L.tr) return 2;
        return 3;
      }
      var arr = LABS.slice().sort(function(a, b){ return prio(a) - prio(b); });
      var placed = [];
      arr.forEach(function(L){
        var el = L.el;
        if (!showable(L.n)){ el.style.display = 'none'; return; }
        var sx = (L.x - vb[0]) * kx, sy = (L.y - vb[1]) * ky;
        if (sx < -40 || sx > W + 40 || sy < -20 || sy > H + 20){ el.style.display = 'none'; return; }
        var w = L.n.length * FS * 1.06 + 3, h = FS * 1.18 + 3;
        var bw = w + PAD * 2, bh = h + PAD * 2;     /* 参与碰撞的盒子 */
        /* 右 / 左 / 上 / 下 四向找位，全都放不下才隐藏 */
        var cand = [
          [sx + 7, sy - bh / 2],
          [sx - 7 - bw, sy - bh / 2],
          [sx - bw / 2, sy - 9 - bh],
          [sx - bw / 2, sy + 9],
          [sx + 6, sy - 7 - bh],
          [sx + 6, sy + 6],
          [sx - 6 - bw, sy - 7 - bh],
          [sx - 6 - bw, sy + 6],
          [sx + 15, sy - bh / 2],
          [sx - 15 - bw, sy - bh / 2],
          [sx - bw / 2, sy - 18 - bh],
          [sx - bw / 2, sy + 18]
        ];
        var bx = null, by = null;
        for (var c = 0; c < cand.length; c++){
          var tx = cand[c][0], ty = cand[c][1];
          if (tx < 2 || tx + bw > W - 2 || ty < 2 || ty + bh > H - 2) continue;
          var hit = false;
          for (var i = 0; i < placed.length; i++){
            var o = placed[i];
            if (tx < o[0] + o[2] && o[0] < tx + bw && ty < o[1] + o[3] && o[1] < ty + bh){ hit = true; break; }
          }
          if (!hit){ bx = tx; by = ty; break; }
        }
        if (bx === null){ el.style.display = 'none'; return; }
        placed.push([bx, by, bw, bh]);
        /* 文字盒在碰撞盒内部居中：x 左对齐 + 半个 PAD，y 取垂直中心 */
        el.setAttribute('x', (vb[0] + (bx + PAD) / kx).toFixed(2));
        el.setAttribute('y', (vb[1] + (by + bh / 2) / ky).toFixed(2));
        el.setAttribute('font-size', (FS * upp).toFixed(2));
        el.style.display = '';
      });
    }
    function apply(){
      full.setAttribute('viewBox', vb.map(function(v){ return v.toFixed(2); }).join(' '));
      scheduleLayout();
    }
    function fitAspect(b){
      var r = stage.clientWidth / Math.max(1, stage.clientHeight);
      var cx = b[0] + b[2]/2, cy = b[1] + b[3]/2, w = b[2], h = b[3];
      if (w / h < r) w = h * r; else h = w / r;
      return [cx - w/2, cy - h/2, w, h];
    }
    var vbFit = fitAspect(vbR);
    vb = vbFit.slice(); apply();
    /* 缩放下限要覆盖“初始适配视野”和整张图，否则长线路放大后缩不回去 */
    var MINW = 60, MAXW = Math.max(vbFit[2], vb0[2]) * 1.6;
    function zoomAt(f, px, py){        /* px,py: stage 内像素 */
      var w = Math.min(MAXW, Math.max(MINW, vb[2] * f)); f = w / vb[2];
      var ux = vb[0] + vb[2] * px / stage.clientWidth, uy = vb[1] + vb[3] * py / stage.clientHeight;
      vb = [ux - (ux - vb[0]) * f, uy - (uy - vb[1]) * f, vb[2] * f, vb[3] * f]; apply();
    }
    function panPx(dx, dy){
      vb[0] -= dx * vb[2] / stage.clientWidth; vb[1] -= dy * vb[3] / stage.clientHeight; apply();
    }
    function rel(e){ var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    stage.addEventListener('wheel', function(e){
      e.preventDefault(); var q = rel(e); zoomAt(Math.exp(e.deltaY * 0.0015), q[0], q[1]);
    }, {passive:false});

    var ptrs = {}, last = null, lastDist = 0, lastMid = null, moved = 0;
    stage.addEventListener('pointerdown', function(e){
      stage.setPointerCapture(e.pointerId); ptrs[e.pointerId] = rel(e); moved = 0;
      var ids = Object.keys(ptrs);
      if (ids.length === 1) last = ptrs[ids[0]];
      if (ids.length === 2){
        var a = ptrs[ids[0]], b = ptrs[ids[1]];
        lastDist = Math.hypot(a[0]-b[0], a[1]-b[1]); lastMid = [(a[0]+b[0])/2, (a[1]+b[1])/2];
      }
    });
    stage.addEventListener('pointermove', function(e){
      if (!ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = rel(e);
      var ids = Object.keys(ptrs);
      if (ids.length === 1 && last){
        var c = ptrs[ids[0]]; panPx(c[0]-last[0], c[1]-last[1]);
        moved += Math.abs(c[0]-last[0]) + Math.abs(c[1]-last[1]); last = c;
      } else if (ids.length === 2){
        var a = ptrs[ids[0]], b = ptrs[ids[1]];
        var d = Math.hypot(a[0]-b[0], a[1]-b[1]), m = [(a[0]+b[0])/2, (a[1]+b[1])/2];
        if (lastDist > 0) zoomAt(lastDist / d, m[0], m[1]);
        if (lastMid) panPx(m[0]-lastMid[0], m[1]-lastMid[1]);
        lastDist = d; lastMid = m; moved = 99;
      }
    });
    function up(e){
      delete ptrs[e.pointerId];
      var ids = Object.keys(ptrs);
      last = ids.length === 1 ? ptrs[ids[0]] : null; lastDist = 0; lastMid = null;
    }
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
    stage.addEventListener('dblclick', function(e){ var q = rel(e); zoomAt(0.5, q[0], q[1]); });

    /* 点站名：pointer capture 会把 click 目标劫持成 stage，这里在抬起时按坐标命中 */
    var tip = document.createElement('div'); tip.className = 'map-tip'; stage.appendChild(tip);
    function hitStation(x, y){
      var el = document.elementFromPoint(x, y);
      return el && el.closest ? el.closest('circle.mstop') : null;
    }
    full.addEventListener('click', function(e){
      if (moved > 6){ tip.classList.remove('on'); return; }
      var c = hitStation(e.clientX, e.clientY);
      if (!c){ tip.classList.remove('on'); return; }
      var t = c.querySelector('title'), r = stage.getBoundingClientRect();
      tip.textContent = t ? t.textContent : '';
      tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
      tip.classList.add('on');
    });

    var midBtn = ov.querySelector('.mapv-mid');
    midBtn.addEventListener('click', function(){
      var g = full.querySelector('.mids');
      if (!g) return;
      var on = g.style.display === 'none';
      g.style.display = on ? '' : 'none';
      midBtn.classList.toggle('on', on);
      midBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      scheduleLayout();
    });
    var netBtn = ov.querySelector('.mapv-net');
    if (netBtn) netBtn.addEventListener('click', function(){
      var on = !netBtn.classList.contains('on');
      netBtn.classList.toggle('on', on);
      netBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (NETLAYER) NETLAYER.style.display = on ? '' : 'none';
      scheduleLayout();
    });
    ov.querySelectorAll('.mapv-btn').forEach(function(b){
      if (b.classList.contains('mapv-mid') || b.classList.contains('mapv-net')) return;
      b.addEventListener('click', function(){
        var z = b.getAttribute('data-z'), cx = stage.clientWidth/2, cy = stage.clientHeight/2;
        if (z === 'in') zoomAt(0.7, cx, cy);
        else if (z === 'out') zoomAt(1/0.7, cx, cy);
        else { vb = fitAspect(vb0); apply(); }
      });
    });
    function close(){
      ov.remove(); document.body.classList.remove('map-zoom-open');
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.querySelector('.mapv-close').addEventListener('click', close);
    window.addEventListener('resize', function rs(){ if (!ov.isConnected){ window.removeEventListener('resize', rs); return; } vb = fitAspect(vb); apply(); });
  }

  function wireMap(box){
    var zbtn = box.querySelector('.map-zoom');
    if (zbtn) zbtn.addEventListener('click', function(ev){
      ev.stopPropagation();
      openMapViewer(zbtn.closest('.metromap').querySelector('svg'));
    });
    var wrap = box.querySelector('.metromap');
    if (!wrap) return;
    var svg = wrap.querySelector('svg');
    var tip = document.createElement('div');
    tip.className = 'map-tip';
    wrap.appendChild(tip);
    var current = null;
    function hide(){ tip.classList.remove('on'); current = null; }
    svg.addEventListener('click', function(e){
      var c = e.target.closest ? e.target.closest('circle.mstop') : null;
      if (!c) { hide(); return; }
      if (c === current) { hide(); return; }
      current = c;
      var t = c.querySelector('title');
      var name = t ? t.textContent : '';
      var r = c.getBoundingClientRect(), pr = wrap.getBoundingClientRect();
      tip.textContent = name;
      tip.style.left = (r.left - pr.left + r.width/2) + 'px';
      tip.style.top = (r.top - pr.top) + 'px';
      tip.classList.add('on');
    });
    document.addEventListener('click', function(e){ if (!wrap.contains(e.target)) hide(); });
  }

  function renderMapBox(G, segs, from, to){
    var groups = routePts(G, segs);
    if (!groups.length) return '';
    var vb = mapViewBox(groups);
    var vbW = parseFloat(vb.split(' ')[2]);
    var k = Math.max(vbW / 820, 0.18);
    return '<div class="metromap">'
      + '<div class="map-cap"><span>线路图</span><span class="map-hint">高亮为官方推荐路径 · 悬停或点击站点看站名</span><button type="button" class="map-zoom" aria-label="放大线路图">⤢ 放大</button></div>'
      + '<svg viewBox="' + vb + '" data-full="0 0 1000 1400" preserveAspectRatio="xMidYMid slice" role="img" aria-label="上海地铁线路图，高亮 ' + from + ' 至 ' + to + ' 的官方路径">'
      + mapBase(G, k) + mapRoute(G, segs, k) + mapStops(G, segs, from, to, k) + mapMidStops(G, segs, k)
      + mapStopLabels(G, segs, from, to, k, vb)
      + '</svg></div>';
  }

  /* 站名按屏幕像素定字号（SVG 会被缩放） */
  function fitMapLabels(root){
    var scope = root || document;
    var list = scope.querySelectorAll('.metromap svg');
    Array.prototype.forEach.call(list, function(svg){
      var vb = svg.getAttribute('viewBox').split(' ').map(Number);
      var cw = svg.clientWidth || 700;
      var fs = 11 * vb[2] / cw;
      Array.prototype.forEach.call(svg.querySelectorAll('.mlab-sm'), function(t){
        t.setAttribute('font-size', fs.toFixed(2));
        t.setAttribute('stroke-width', (fs * 0.32).toFixed(2));
      });
    });
  }
  window.__fitMapLabels = fitMapLabels;
  window.addEventListener('resize', function(){ fitMapLabels(); });

  /* ---------- 官方实测数据：按起点站懒加载分片 ---------- */
  var OFFICIAL = { index: null, req: null, cache: {} };

  function officialIndex(){
    if (OFFICIAL.index) return Promise.resolve(OFFICIAL.index);
    if (!OFFICIAL.req) {
      OFFICIAL.req = fetch('data/stations.json', {cache:'force-cache'})
        .then(function(r){ return r.json(); })
        .then(function(d){ OFFICIAL.index = d.index || {}; return OFFICIAL.index; })
        .catch(function(){ OFFICIAL.index = {}; return OFFICIAL.index; });
    }
    return OFFICIAL.req;
  }

  function officialPair(fromName, toName){
    return officialIndex().then(function(idx){
      var fi = idx[fromName], ti = idx[toName];
      if (fi === undefined || ti === undefined) return null;
      /* 分片按单向 i<j 存储：文件名为较小的站序号，键为较大者 */
      var a = Math.min(fi, ti), b = Math.max(fi, ti);
      if (!OFFICIAL.cache[a]) {
        OFFICIAL.cache[a] = fetch('data/paths/' + a + '.json', {cache:'force-cache'})
          .then(function(r){ return r.ok ? r.json() : {}; })
          .catch(function(){ return {}; });
      }
      return OFFICIAL.cache[a].then(function(m){ return m[b] || null; });
    });
  }

  /* "1号线人民广场至陕西南路， 换乘10号线至四川北路。" -> 分段 */
  function parseOfficialPath(desc){
    var segs = [], prevTo = null;
    String(desc || '').replace(/[。\s]+$/,'').split(/[，,]/).forEach(function(raw){
      var t = raw.trim();
      var walk = /^出站换乘/.test(t);            /* 出站换乘：仍按后续线路着色 */
      t = t.replace(/^(出站)?换乘/, '');
      var m = t.match(/^(.+?线)(.*?)至(.+)$/);
      if (!m) return;
      var from = (m[2] || prevTo || '').trim(), to = m[3].trim();
      if (!to) return;
      segs.push({ line: m[1].trim(), from: from, to: to, walk: walk });
      prevTo = to;
    });
    return segs;
  }

  var LA_CACHE = {}, LOOP_LINES = { '4号线': true };
  /* 线内邻接：官方边为主，再用站序补共线段（边被记到别的线），环线首尾闭合 */
  function lineAdj(ln){
    if (LA_CACHE[ln]) return LA_CACHE[ln];
    var seq = METRO_DATA.lines[ln] || [], adj = {};
    function add(a, b){
      if (!a || !b || a === b) return;
      (adj[a] = adj[a] || []).push(b);
      (adj[b] = adj[b] || []).push(a);
    }
    (METRO_DATA.edges || []).forEach(function(e){ if (e.l === ln) add(e.a, e.b); });
    for (var i = 0; i < seq.length - 1; i++){
      if (graph[seq[i]] && graph[seq[i]][seq[i+1]]) add(seq[i], seq[i+1]);
    }
    if (LOOP_LINES[ln] && seq.length > 2) add(seq[0], seq[seq.length-1]);
    return (LA_CACHE[ln] = adj);
  }

  /* 单条线路内的最短站序：环线走短弧、分叉走对应支线 */
  function lineSlice(line, from, to){
    if (!from || !to) return [];
    if (from === to) return [from];
    var adj = lineAdj(line);
    if (adj[from] && adj[to]) {
      var prev = {}, seen = {}, q = [from];
      seen[from] = 1;
      while (q.length){
        var u = q.shift();
        if (u === to) break;
        var ns = adj[u] || [];
        for (var i = 0; i < ns.length; i++){
          if (!seen[ns[i]]){ seen[ns[i]] = 1; prev[ns[i]] = u; q.push(ns[i]); }
        }
      }
      if (seen[to]) {
        var path = [to], c = to;
        while (c !== from){ c = prev[c]; path.push(c); }
        return path.reverse();
      }
    }
    /* 站不在该线（出站换乘接续段）：退回线性序列 */
    var arr = METRO_DATA.lines[line];
    if (!arr) return [];
    var i2 = arr.indexOf(from), j2 = arr.indexOf(to);
    if (i2 < 0 || j2 < 0) return [];
    return i2 <= j2 ? arr.slice(i2, j2+1) : arr.slice(j2, i2+1).reverse();
  }

  function lineColor(line){
    return LINE_COLORS[line] || (METRO_DATA.lines[line] ? '#8a8a8a' : '#b0b0b0');
  }

  /* 竖排行程图：起点 ● — 线路段 — ◉换乘 — … — 终点 ● */
  function renderJourney(segs, opts){
    var html = '<div class="jny">';
    segs.forEach(function(seg, i){
      var color = lineColor(seg.line);
      var sts = lineSlice(seg.line, seg.from, seg.to);
      var hops = sts.length > 1 ? sts.length - 1 : null;
      html += '<div class="jny-stop"><span class="jny-dot" style="--c:' + color + '"></span>'
            + '<span class="jny-name">' + seg.from + '</span>'
            + (i === 0 ? '<span class="jny-tagline">起点</span>'
                       : '<span class="jny-badge' + (seg.walk ? ' walk' : '') + '">' + (seg.walk ? '出站换乘' : '换乘') + '</span>')
            + '</div>';
      html += '<div class="jny-leg" data-leg="' + i + '" tabindex="0" role="button" aria-expanded="false">'
            + '<span class="jny-line" style="--c:' + color + '"></span>'
            + '<span class="jny-info"><span class="jny-chip" style="--c:' + color + '">' + seg.line + '</span>'
            + (hops ? '<span class="jny-hops">' + hops + ' 站</span>' : '')
            + '<span class="jny-more">途经站</span></span>'
            + '<span class="jny-stations">' + (sts.length ? sts.join(' · ') : '（站序未知）') + '</span>'
            + '</div>';
    });
    var last = segs[segs.length - 1];
    if (last) {
      var lc = lineColor(last.line);
      html += '<div class="jny-stop"><span class="jny-dot end" style="--c:' + lc + '"></span>'
            + '<span class="jny-name">' + last.to + '</span>'
            + '<span class="jny-tagline">终点</span></div>';
    }
    html += '</div>';
    return html;
  }

  function wireJourney(box){
    box.querySelectorAll('.jny-leg').forEach(function(el){
      function toggle(){
        var open = el.classList.toggle('open');
        el.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      el.addEventListener('click', toggle);
      el.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
      });
    });
  }

  function renderRoute(){
    var fromName = epFrom.get(), toName = epTo.get();
    var box = document.getElementById('routeResult');
    if(!graph[fromName] || !graph[toName]){
      box.innerHTML = '<div class="no-route">无法计算该站对间的路径。</div>'; lastKm=null; renderCostS2s(); return;
    }
    if(fromName === toName){
      box.innerHTML = '<div class="no-route">起点和终点相同。</div>'; lastKm=null; renderCostS2s(); return;
    }

    /* 本地最短里程路径（算里程/站数，也作为官方数据缺失时的兜底） */
    var r = dijkstra(fromName);
    var path = [], cur = toName;
    if(!(toName in r.dist)){
      box.innerHTML = '<div class="no-route">无法计算该站对间的路径。</div>'; lastKm=null; renderCostS2s(); return;
    }
    while(cur){ path.push(cur); cur = r.prev[cur]; }
    path.reverse();
    var km = r.dist[toName] / 1000;
    lastKm = km;

    var token = (renderRoute.tk = (renderRoute.tk || 0) + 1);

    Promise.all([officialPair(fromName, toName), loadMapXY()]).then(function(res){
      var off = res[0]; window.__mapXY = res[1];
      if (token !== renderRoute.tk) return;
      var idxMap = OFFICIAL.index || {};
      var fi0 = idxMap[fromName], ti0 = idxMap[toName];
      var official = off && off.r && off.r.length ? off : null;

      if (!official) {
        renderEstimate(box, path, km, fromName, toName);
        maybeShowS2sModal();
        return;
      }

      var plan = off.r[0];
      var opts = (plan.opts || []).filter(function(o){ return o.desc; });
      if (!opts.length) { renderEstimate(box, path, km, fromName, toName); return; }

      var reversed = (fi0 !== undefined && ti0 !== undefined && fi0 > ti0);  /* 分片按小序号→大序号存储 */
      var active = 0;
      function paint(idx){
        var o = opts[idx];
        var segs = parseOfficialPath(o.desc);
        if (reversed) {
          segs = segs.slice().reverse().map(function(x){ return {line:x.line, from:x.to, to:x.from}; });
        }
        var fare = Number(off.p);
        var fareTxt = Number.isInteger(fare) ? fare : fare.toFixed(2);

        var html = '<div class="fare-head">'
          + '<div class="fare-big">' + fareTxt + '<span class="u">元</span></div>'
          + '<div class="fare-meta">'
          +   '<div class="fm-1">官方实测票价' + (off.lt && off.lt !== 'URBAN' ? ' · ' + off.lt : '') + '</div>'
          +   '<div class="fm-2">' + (o.min ? '约 ' + o.min + ' 分钟' : '')
          +      (o.min ? ' · ' : '') + (o.tr ? '换乘 ' + o.tr + ' 次' : '无需换乘')
          +      ' · 计价里程约 ' + km.toFixed(1) + ' 公里（本页按站间距推算）</div>'
          + '</div></div>';

        if (opts.length > 1) {
          html += '<div class="plan-switch">';
          opts.forEach(function(x, i){
            html += '<button class="plan-btn' + (i===idx?' active':'') + '" data-plan="' + i + '">'
                  + x.name + (x.tr ? '（' + x.tr + ' 次换乘）' : '') + '</button>';
          });
          html += '</div>';
        }

        html += renderJourney(segs, o);
        html += '<div class="map-row">';
        if (window.__mapXY) html += renderMapBox(window.__mapXY, segs, fromName, toName);

        /* 票价对比卡：官方实测 + 各方案按里程推算，放在地图右侧 */
        html += '<div class="cards mini">';
        var curFare = fareCurrent(km);
        activeFares().forEach(function(f){
          var isOff = (f.key === 'final');
          var p = isOff ? Number(off.p) : f.fn(km);
          var diff = Math.round((p - curFare) * 10) / 10;
          var deltaTxt, deltaCls;
          if (f.key === 'cur') { deltaTxt = '基准（2005 版推算）'; deltaCls = 'eq'; }
          else if (diff === 0) { deltaTxt = '与老方案相同'; deltaCls = 'eq'; }
          else { deltaTxt = '比老方案 ' + (diff > 0 ? '+' : '') + diff + ' 元'; deltaCls = diff > 0 ? 'up' : 'down'; }
          if (isOff) deltaTxt = '官方实测 · ' + deltaTxt;
          html += '<div class="card ' + f.key + '">'
            + '<div class="name">' + f.name.replace(/^(.+?)（(.+)）$/, '<span class="nm-main">$1</span><span class="nm-sub">$2</span>') + '</div>'
            + '<div class="price">' + p + '<span class="u">元</span></div>'
            + '<div class="delta ' + deltaCls + '">' + deltaTxt + '</div>'
            + '</div>';
        });
        html += '</div></div>';

        html += '<div class="fare-foot"><span>里程按公开站间距推算最短路径 · 老方案（2005 版）票价按旧规则与站间距推算，可能与实际扣费有差异，仅供参考</span></div>';

        box.innerHTML = html;
        if (window.__fitMapLabels) window.__fitMapLabels(box);
        wireJourney(box);
        wireMap(box);
        box.querySelectorAll('.plan-btn').forEach(function(b){
          b.addEventListener('click', function(){ paint(parseInt(b.getAttribute('data-plan'),10)); });
        });
        renderCostS2s();
      }
      paint(active);
    });
  }

  /* 官方库没有这对站时：按站间距里程 + 规则价估算 */
  function renderEstimate(box, path, km, fromName, toName){
    var segs = [], curLine = null, segStart = path[0];
    for(var i=0;i<path.length-1;i++){
      var e = graph[path[i]][path[i+1]];
      if(e.l !== curLine){
        if(curLine) segs.push({line:curLine, from:segStart, to:path[i]});
        curLine = e.l; segStart = path[i];
      }
    }
    if(curLine) segs.push({line:curLine, from:segStart, to:path[path.length-1]});

    var html = '<div class="fare-head">'
      + '<div class="fare-big est">—</div>'
      + '<div class="fare-meta"><div class="fm-1">官方库未收录这一站对</div>'
      + '<div class="fm-2">以下为按站间距推算的里程与规则票价，仅供参考</div></div></div>'
      + renderJourney(segs, null)
      + '<div class="cards" style="margin-top:18px">';
    var curFare = fareCurrent(km);
    activeFares().forEach(function(f){
      var p = f.fn(km);
      var diff = p - curFare;
      var deltaTxt = f.key==='cur' ? '基准（2005 版推算）' : (diff===0 ? '与老方案相同' : '比老方案 ' + (diff>0?'+':'') + diff + ' 元');
      html += '<div class="card ' + f.key + '"><div class="name">' + f.name + '</div>'
        + '<div class="price">' + p + '<span class="u">元</span></div>'
        + '<div class="delta ' + (f.key==='cur'?'eq':(diff>0?'up':(diff===0?'eq':'down'))) + '">' + deltaTxt + '</div></div>';
    });
    html += '</div><div class="fare-foot"><span class="src">估算：' + km.toFixed(2) + ' 公里 · ' + path.length + ' 站</span></div>';
    box.innerHTML = html;
    if (window.__fitMapLabels) window.__fitMapLabels(box);
    wireJourney(box);
    wireMap(box);
    renderCostS2s();
  }

  epFrom.onchange = renderRoute;
  epTo.onchange = renderRoute;
  ridesS2s.addEventListener('input', renderCostS2s);
  discS2s.addEventListener('change', renderCostS2s);

  var ridesS2sRange = document.getElementById('ridesS2sRange');
  ridesS2sRange.addEventListener('input', function(){ ridesS2s.value = ridesS2sRange.value; renderCostS2s(); });
  ridesS2s.addEventListener('input', function(){ ridesS2sRange.value = ridesS2s.value; });
  function chipsOff(t){ document.querySelectorAll('.ride-chips[data-target="' + t + '"] button.on').forEach(function(x){ x.classList.remove('on'); }); }
  ridesS2sRange.addEventListener('input', function(){ chipsOff('s2s'); });
  ridesS2s.addEventListener('input', function(){ chipsOff('s2s'); });
  document.querySelectorAll('.ride-chips[data-target="s2s"] button').forEach(function(b){
    b.addEventListener('click', function(){
      var v = b.getAttribute('data-rides');
      ridesS2s.value = v; ridesS2sRange.value = v;
      b.parentNode.querySelectorAll('button').forEach(function(x){ x.classList.toggle('on', x===b); });
      renderCostS2s();
    });
  });

  var showHearingS2sEl = document.getElementById('showHearingS2s');
  if (showHearingS2sEl) {
    showHearingS2sEl.addEventListener('change', function(){
      SHOW_HEARING = showHearingS2sEl.checked;
      document.body.classList.toggle('show-hearing', SHOW_HEARING);
      var sh = document.getElementById('showHearing');
      if (sh) sh.checked = SHOW_HEARING;
      renderRoute();
      if (window.__renderDist) window.__renderDist();
    });
  }
  window.__renderRoute = renderRoute;
  document.getElementById('swapBtn').addEventListener('click', function(){
    var a = epFrom.get(), b = epTo.get();
    epFrom.set(b); epTo.set(a);
  });
  document.querySelectorAll('#s2sPresets button').forEach(function(b){
    b.addEventListener('click', function(){
      var pair = b.getAttribute('data-pair').split(',');
      epFrom.set(pair[0]); epTo.set(pair[1]);
    });
  });

  renderRoute();
})();

(function(){
  var TIERS = [[4,3],[8,4],[12,5],[16,6],[23,7],[30,8],[40,9],[50,10],[65,11],[80,12],[95,13],[110,14],[125,15]];
  var cmp = document.querySelector('#cmpTable tbody');
  if (cmp) {
    function maxKm(fn, price){
      var best = 0;
      for (var d = 1; d <= 220; d++) if (fn(d) <= price) best = d;
      return best;
    }
    var rows = '';
    for (var p = 3; p <= 15; p++){
      var ko = maxKm(fareCurrent, p), kn = maxKm(fareFinal, p), diff = kn - ko;
      var cls = diff === 0 ? 'dzero' : (diff < 0 ? 'dneg' : '');
      var txt = diff === 0 ? '不变' : (diff > 0 ? '+' + diff + ' 公里' : diff + ' 公里');
      rows += '<tr><td>' + p + ' 元</td><td>≤ ' + ko + ' 公里</td><td>≤ ' + kn + ' 公里</td>'
            + '<td class="' + cls + '">' + txt + '</td></tr>';
    }
    cmp.innerHTML = rows;
  }

  var g = document.querySelector('#ticketGrid');
  if (g) {
    var html = [{n:35,p:190},{n:45,p:210},{n:60,p:270},{n:90,p:390}].map(function(t){
      return '<div class="ticket"><div class="tk-name">计次票 ' + t.n + ' 次</div>'
        + '<div class="tk-price">' + t.p + '<small>元</small></div>'
        + '<div class="tk-per">折合 <b>' + (t.p / t.n).toFixed(2) + '</b> 元/次</div></div>';
    }).join('');
    html += '<div class="ticket"><div class="tk-name">一日票</div><div class="tk-price">24<small>元</small></div><div class="tk-per">首次进站起 24 小时不限次</div></div>';
    html += '<div class="ticket"><div class="tk-name">三日票</div><div class="tk-price">60<small>元</small></div><div class="tk-per">72 小时内不限次</div></div>';
    html += '<div class="ticket"><div class="tk-name">联程日票（随申行）</div><div class="tk-price">26<small>元</small></div><div class="tk-per">24 小时地铁 + 公交 + 轮渡</div></div>';
    html += '<div class="ticket"><div class="tk-name">联程三日票（随申行）</div><div class="tk-price">62<small>元</small></div><div class="tk-per">72 小时地铁 + 公交 + 轮渡</div></div>';
    html += '<div class="ticket"><div class="tk-name">联程七日票（随申行）</div><div class="tk-price">112<small>元</small></div><div class="tk-per">168 小时地铁 + 公交 + 轮渡</div></div>';
    g.innerHTML = html;
  }
})();


/* 亮暗色切换：默认跟随系统，手动选择存在本地 */
(function(){
  var KEY = 'mc_theme';
  var btn = document.getElementById('themeBtn');
  function effective(t){
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function apply(t){
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    if (btn) btn.textContent = effective(t) === 'dark' ? '☀️' : '🌙';
  }
  var saved = '';
  try { saved = localStorage.getItem(KEY) || ''; } catch(e){}
  apply(saved);
  if (btn) btn.addEventListener('click', function(){
    var next = effective(saved) === 'dark' ? 'light' : 'dark';
    saved = next;
    try { localStorage.setItem(KEY, next); } catch(e){}
    apply(next);
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function(){ if (!saved) apply(''); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
})();

/* 回到顶部 */
(function(){
  var btn = document.getElementById('toTop');
  if (!btn) return;
  function upd(){ btn.classList.toggle('on', window.scrollY > 360); }
  window.addEventListener('scroll', upd, {passive:true});
  btn.addEventListener('click', function(){ window.scrollTo({top:0, behavior:'smooth'}); });
  upd();
})();

/* 打赏浮窗 */
(function(){
  var box = document.getElementById('tipFloat');
  var fab = document.getElementById('tipFab');
  var close = document.getElementById('tipClose');
  if(!box) return;
  var KEY = 'mc_tip_hidden';
  var hidden = false;
  try { hidden = localStorage.getItem(KEY) === '1'; } catch(e){}
  var wide = window.matchMedia('(min-width: 901px)').matches;
  if(!hidden && wide) box.classList.add('on');
  if(fab) fab.addEventListener('click', function(){ box.classList.toggle('on'); });
  if(close) close.addEventListener('click', function(e){
    e.stopPropagation();
    box.classList.remove('on');
    try { localStorage.setItem(KEY, '1'); } catch(err){}
  });
})();
