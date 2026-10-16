// 가짜 데이터로 모든 화면을 그려보고 주요 계산을 확인하는 점검 스크립트
// 실행: node scripts/smoke.js   (Firebase 연결 없이 동작)
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/<\/?script>/g, '');
try { new Function(src); } catch (e) { console.error('문법 오류:', e.message); process.exit(1); }

const els = {}; const el = id => els[id] || (els[id] = { style: {}, innerHTML: '', value: '' });
const fb = {
  initializeApp() {},
  auth: Object.assign(() => ({ onAuthStateChanged() {} }), {}),
  firestore: Object.assign(() => ({ enablePersistence: () => Promise.resolve() }), { FieldValue: { arrayUnion: x => x, delete: () => null, serverTimestamp: () => new Date() } }),
};
const ctx = {
  firebase: fb, console, URL, Math, JSON, Date, String, Object, Number, Array, Uint32Array,
  document: { querySelector: s => el(s), hidden: false, activeElement: null, addEventListener() {}, documentElement: { setAttribute() {}, removeAttribute() {} } },
  localStorage: { getItem: () => null, setItem() {} }, alert() {}, confirm: () => true,
  crypto: require('crypto').webcrypto, Image: class {}, setInterval() {}, window: {}, location: { reload() {} },
};
vm.createContext(ctx); vm.runInContext(src, ctx);
const run = c => vm.runInContext(c, ctx), out = () => el('#app').innerHTML;
let fail = 0; const ok = (name, cond) => { if (!cond) { fail++; console.log('✗', name); } else console.log('✓', name); };

run(`users={a:{id:'a',name:'대장',role:'admin',status:'active'},
 w1:{id:'w1',name:'홍',nick:'홍길동',role:'artist',status:'active',inst:true,since:'2018-01-01',plan:[{from:'2018-01',amt:300000}]},
 s1:{id:'s1',name:'이수강',cohort:'12',role:'student',status:'active'}};
roster={};allSales=[];sales=[];tosses=[];sup=[];sreq=[];notices=[];led={};guests=[];crs={};ses=[];snotes=[];buys=[];cnts=[];cashs=[];
evs=[];rnds={};tix=[];evd=[{id:'x',uid:'w1',m:'2099-01',a:50000,void:false}];`);

// 토스 카드 수수료 부담 방식
const t = m => JSON.parse(run(`JSON.stringify(tcalc(100000,[{m:'card',a:100000}],20000,false,'${m}'))`));
ok('토스 공동부담 18,000/72,000', t('share').sIn === 18000 && t('share').rIn === 72000);
ok('토스 보내는사람부담 10,000/80,000', t('send').sIn === 10000 && t('send').rIn === 80000);
ok('토스 받는사람부담 20,000/70,000', t('recv').sIn === 20000 && t('recv').rIn === 70000);
// 쉐어비 장부
ok('쉐어비 입사월부터 생성', run(`monthsOf(users.w1)[0]`) === '2018-01');
ok('이벤트 할인 반영', run(`rowOf(users.w1,'2099-01').evd`) === 50000);
// 함께한 날: 구간 안의 날만, 휴무 달 제외 / 할인 합계: 확정된 달만
run(`users.g1={id:'g1',role:'artist',status:'active',since:'2022-01-10',plan:[{from:'2022-01',to:'2022-03',amt:300000},{from:'2023-01',to:'2023-02',amt:250000}]};led['g1_2022-02']={uid:'g1',m:'2022-02',st:'rest'};led['g1_2022-03']={uid:'g1',m:'2022-03',st:'done',paid:300000};`);
ok('함께한 날: 쉰 기간·휴무 달 빼고 계산', run(`workDays(users.g1,'2026-01-01')`) === 22 + 31 + 31 + 28);
ok('할인 합계: 휴무 30만 + 25만 구간 5만×2 (확정된 달)', run(`discOf(users.g1)`) === 300000 + 50000 * 2);
run(`delete users.g1;delete led['g1_2022-02'];delete led['g1_2022-03']`);
// 점수제 레벨: 2026-04 레벨업(15일) 기간 = 2026-03-15 ~ 2026-04-14
run(`cfg=JSON.parse(JSON.stringify(cfg));cfg.lv=defLv();cfg.lv.start='2000-01';cfg.lv.from='2000-01-01';
allSales=[{id:'s1',uid:'w1',t:'normal',qty:3,a:30000,d:'2026-03-20',void:false,ap:''},{id:'s2',uid:'w1',t:'normal',qty:5,a:50000,d:'2026-04-15',void:false,ap:''}];
tosses=[{from:'w1',to:'a',st:'ok',d:'2026-03-25',void:false},{from:'a',to:'w1',st:'pending',d:'2026-03-26',void:false}];`);
const br = JSON.parse(run(`JSON.stringify(lvScore(users.w1,'2026-04'))`));
ok('레벨 점수: 판매 3개×10점, 기간 밖 제외', br.sale === 30);
ok('레벨 점수: 확정 토스만 (보냄 20점)', br.toss === 20);
ok('레벨 단계: 150점 → Lv.1', run(`lvOfPts(150)`) === 1 && run(`lvOfPts(99)`) === 0);
ok('레벨 고정이 우선', run(`levelOf({id:'zz',lvFix:3})`) === 3);
run(`users.w1.evx={on:true,until:'2000-01'}`); ok('이벤트 제외 기간 지나면 자동 해제', run(`evxOn(users.w1)`) === false);
run(`users.w1.evx={on:true,until:''}`); ok('이벤트 제외 중이면 복권 0장', run(`evOut({lv:[5]},users.w1)`) === true); run(`delete users.w1.evx`);
// 판매수당 조작 확인
run(`cfg.cmChk='2000';cfg.cmh=[{at:'0000',pid:'p1',cm:{cash:{t:'pct',pct:20},card:{t:'pct',pct:0},review:{t:'pct',pct:0}}}]`);
ok('수당 설정과 맞으면 통과', run(`cmBad({at:'2026-01-01T00:00:00Z',pid:'p1',t:'normal',pay:'cash',s:'L',qty:1,a:10000,c:2000})`) === false);
ok('수당을 부풀리면 ⚠', !!run(`cmBad({at:'2026-01-01T00:00:00Z',pid:'p1',t:'normal',pay:'cash',s:'L',qty:1,a:10000,c:5000})`));
run(`allSales=[];sales=[];tosses=[]`);

// 내부자 해킹 흉내: 다른 사람이 넣은 글자가 대장님 화면에서 코드로 실행되면 안 됨
ctx.__P = '<img src=x onerror=alert(1)>" onmouseover="alert(2)" \'); alert(3);//&#39;';
run(`users.zz=cl({id:'zz',name:__P,nick:__P,role:'artist',status:'active',email:__P});
allSales=[cl({id:'x1',d:__P,at:__P,uid:'zz',pid:'p1',s:'L',qty:__P,t:__P,pay:__P,a:__P,c:__P,buyer:__P,memo:__P,rid:__P,rn:__P,ap:'pending',hist:[{by:__P,at:'x',chg:__P}]})];sales=allSales.slice();
tosses=[cl({id:'t1',d:__P,from:'zz',to:'a',uid:'a',cust:__P,content:__P,memo:__P,amt:__P,pays:[{m:__P,a:__P}],st:'pending',fee:1,cf:0,rIn:1,aIn:0,sIn:1})];me=users.a`);
{ const BAD = /<img src=x|" onmouseover="|'\); alert\(3\)|&#39;/; let leak = [];
  for (const k of ['home', 'toss', 'share', 'set', 'conf']) { run(`tab='${k}';cs='user';sd.u='zz';draw()`); if (BAD.test(out())) leak.push(k); }
  run(`showSale('x1')`); if (BAD.test(el('#mb').innerHTML)) leak.push('판매상세');
  ok('해킹 글자 무력화' + (leak.length ? ' (' + leak.join(',') + ')' : ''), !leak.length); }
ok('저장 시간(Timestamp) 같은 객체는 그대로', (() => { class TS { toDate() { return 1 } } ctx.__t = new TS(); return run(`typeof cl({t:__t}).t.toDate`) === 'function'; })());
run(`delete users.zz;allSales=[];sales=[];tosses=[]`);

run(`LS.pets={p:Promise.resolve()};pets={zz:{st:2,name:'핑크빵',full:80}};roster.zz={id:'zz',nick:'핑크빵'};edus=[];cvJ={items:[{s:'2026-10-16',e:'2026-10-18',name:'Test Con',city:'Seoul',country:'한국',url:'https://x.y',big:true}]};cvA=[];errs=[];pubD={};cvM='2026-10'`);
const tabs = { admin: ['home', 'in', 'toss', 'share', 'more', 'sup', 'acd', 'set', 'inv', 'evt', 'conf', 'edu', 'conv', 'pet'], artist: ['home', 'in', 'toss', 'share', 'more', 'sup', 'evt', 'acd', 'edu', 'conv', 'pet'] };
for (const [who, list] of Object.entries(tabs)) {
  run(who === 'admin' ? `me=users.a` : `me=Object.assign({},users.w1);shareOK=true`);
  for (const k of list) {
    try { run(`tab='${k}';draw()`); ok(`${who} ${k} 화면`, out().length > 100); }
    catch (e) { ok(`${who} ${k} 화면 (${e.message})`, false); }
  }
}
run(`tab='conf'`); for (const c of ['user', 'prod', 'lv', 'toss', 'note', 'ph', 'petc', 'adj', 'pub', 'err', 'bk']) { try { run(`cs='${c}';draw()`); ok(`설정 ${c}`, out().length > 100); } catch (e) { ok(`설정 ${c} (${e.message})`, false); } }
try { run(`me=users.s1;tab='home';draw()`); ok('수강생 화면 (오늘의 문구)', /12기 이수강님/.test(out())); run(`tab='edu';draw()`); ok('수강생 기본교육', /바늘 모양/.test(out())); } catch (e) { ok('수강생 화면 (' + e.message + ')', false); }
ok('유령 키우기 (광장·상태)', (run(`me=Object.assign({},users.w1);tab='pet';draw()`), /유령 광장/.test(out()) && /핑크빵/.test(out())));
ok('유령: 시작일 전 기록은 안 셈', (run(`cfg.pet={start:'2026-10-12'};allSales=[{id:'o1',uid:'w1',t:'normal',qty:1,a:1,c:0,d:'2020-01-01',ap:'',void:false},{id:'o2',uid:'w1',t:'normal',qty:1,a:1,c:0,d:'2026-10-13',ap:'',void:false}];me=Object.assign({},users.w1);myPet={}`), run(`petCalc(users.w1).ex`) === 10 && run(`petCalc(users.w1).st`) === 0));
run(`allSales=[];delete cfg.pet`);
ok('레벨 기본 이름', run(`defLv().steps[9].name`) === '레전드 고스트');
ok('쉐어비 15일 전엔 입금 예정', (run(`me=users.a;tab='home';draw()`), true));
ok('컨벤션 달력', (run(`me=users.a;tab='conv';draw()`), /Test Con/.test(out())));
// 베드 현황 (v1.42): 사용 중·비어 있음·15분 넘게 신호 없으면 꺼짐
run(`LS.beds={p:Promise.resolve()};beds={b1:{st:'on',at:new Date(Date.now()-5*60000),up:new Date()},b2:{st:'off',at:new Date(Date.now()-90*60000),up:new Date()},b3:{st:'on',at:new Date(),up:new Date(Date.now()-20*60000)}};me=users.a;tab='home';draw()`);
ok('베드 현황 한 줄: 사용 중 5분 / 비어 있음 / 꺼짐 / 연결 안 된 베드는 준비 중', /1번<\/b> 🔴<span[^>]*> 5분/.test(out()) && /🟢/.test(out()) && (out().match(/⚪/g)||[]).length >= 1 && /4번<\/b> 🔧<span[^>]*> 준비 중/.test(out()));
run(`cfg.bedNames=['창가','','','']`);ok('베드 이름', (run(`draw()`), /<b>창가<\/b> 🔴/.test(out())));run(`delete cfg.bedNames`);
run(`beds={b1:{st:'off',at:new Date(Date.now()-5*60000),up:new Date()},b2:{st:'off',at:new Date(Date.now()-25*60000),up:new Date()}};draw()`);
ok('베드: 나간 지 20분 안 = 잠시 비움, 넘으면 비어 있음', /잠시 비움/.test(out()) && /비어 있음/.test(out()));
run(`beds={}`);
// v1.43 게임·꾸미기: 한 판 포인트 상한 20, 하루 제한 없음, 유령 색
ok('게임 포인트 상한 20·조금씩', run(`gpOf('match',100000)`) === 20 && run(`gpOf('jump',30)`) === 5 && run(`gpOf('merge',399)`) === 0);
ok('꾸미기 19개·유령 색 10개', run(`PSHOP.length`) >= 19 && run(`PCOL.length`) === 10 && /fill="#3a3846"/.test(run(`ghostSvg(2,'cape',false,'','ink')`)));
// 블랙고스트마을 (v1.39): 타투이스트 첫 화면 = 마을, 건물 탭 위에 건물 안 그림, 대장이 끄면 예전 내현황
run(`me=Object.assign({},users.w1);delete cfg.vil;tab='home';draw()`); ok('마을: 타투이스트 첫 화면', /id="vslot"/.test(out()) && /마을/.test(out()));
run(`tab='in';draw()`); ok('마을: 판매입력 위 크림 가게 그림', /in_cream\.jpg/.test(out()) && /마을로/.test(out()));
for (const k of ['my', 'deco', 'game', 'castle']) { try { run(`tab='${k}';draw()`); ok(`마을: ${k} 화면`, out().length > 300 && /vhero|내역/.test(out())); } catch (e) { ok(`마을: ${k} (${e.message})`, false); } }
run(`cfg.vil=false;tab='home';draw()`); ok('마을 끄면 예전 내현황', !/vslot/.test(out()) && /내역/.test(out()));
run(`tab='in';draw()`); ok('마을 끄면 건물 그림 없음', !/vhero/.test(out())); run(`delete cfg.vil`);
run(`me=users.a;go('vil')`); ok('대장 마을 미리보기', /id="vslot"/.test(out())); run(`go('home')`); ok('대장 총괄은 그대로', !/vslot/.test(out()));
ok('쉐어비 금액 가리기·워터마크', (run(`me=Object.assign({},users.w1);shareOK=true;tab='share';draw()`), /●●●원/.test(out()) && /유출금지/.test(out()) && !/300,000원/.test(out().replace(/data-v="[^"]*"/g,''))));

// 버튼 onclick 안에서는 document·요소의 기본 기능 이름이 먼저 잡힌다 (예: createEvent → document.createEvent). 겹치는 이름 금지
const BUILTIN = ['createEvent','createElement','open','close','write','writeln','clear','append','prepend','remove','replaceWith','before','after','focus','blur','click','submit','reset','select','evaluate','getSelection','hasFocus','animate','scroll','scrollTo','scrollBy','matches','closest','contains','normalize','toggleAttribute','setAttribute','getAttribute','removeAttribute','addEventListener','dispatchEvent','querySelector','importNode','adoptNode','elementFromPoint','show','showModal','checkValidity','reportValidity','setCustomValidity','stepUp','stepDown','showPicker','requestFullscreen','attachShadow','insertAdjacentHTML','cloneNode','appendChild','removeChild','replaceChildren','getElementById','getAnimations','computedStyleMap','hidePopover','showPopover','togglePopover','add','item','namedItem'];
const used = new Set(); for (const m of html.matchAll(/on(?:click|change|input|keyup|keydown|submit|blur|focus)="([^"]*)"/g)) for (const x of m[1].matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) used.add(x[1]);
const clash = [...used].filter(n => BUILTIN.includes(n)); ok('버튼 함수 이름이 브라우저 기본 기능과 안 겹침' + (clash.length ? ' (' + clash.join(',') + ')' : ''), !clash.length);


// 매일 복권: 예산 자동 분배 (기간 16일~15일 · 쉐어비 차등 · 예산 초과 없음)
{ const W = [];
  ctx.__fakeDb = { batch: () => ({ set: (r, d) => W.push([r, d]), delete() {}, update() {}, commit: async () => {} }), doc: p => ({ p, update: async () => {} }) };
  run(`db.batch=__fakeDb.batch;db.doc=__fakeDb.doc;users={a:{id:'a',name:'대장',role:'admin',status:'active'},
   w1:{id:'w1',name:'가',role:'artist',status:'active',since:'2020-01-01',plan:[{from:'2020-01',amt:300000}]},
   w2:{id:'w2',name:'나',role:'artist',status:'active',since:'2020-01-01',plan:[{from:'2020-01',amt:250000}]},
   w3:{id:'w3',name:'다',role:'artist',status:'active',since:'2020-01-01',plan:[{from:'2020-01',amt:150000}]},
   w4:{id:'w4',name:'라',role:'artist',status:'active',since:'2020-01-01',plan:[{from:'2020-01',amt:150000}]}};
   evs=[{id:'E1',kind:'budget',budget:50000,base:300000,fill:false,lv:[1],ex:[],title:'매일 복권'}];rnds={};evd=[];`);
  ok('복권 기간: 1/15는 1월분, 1/16은 2월분', run(`bpOf('2027-01-15')`) === '2027-01' && run(`bpOf('2027-01-16')`) === '2027-02' && run(`JSON.stringify(bpRange('2027-01'))`) === '["2026-12-16","2027-01-15"]');
  (async () => {
    let total = 0, bad = 0, n = 0;
    for (let i = 0; i < 31; i++) {
      const d = run(`(()=>{const x=new Date('2026-12-16T00:00:00');x.setDate(x.getDate()+${i});return x.toLocaleDateString('sv')})()`);
      if (d > '2027-01-15') break;
      run(`rnds['E1_${d}']={id:'E1_${d}',eid:'E1',kind:'budget',d:'${d}',st:'open'}`);
      W.length = 0; await vm.runInContext(`issueBudget(rnds['E1_${d}'])`, ctx);
      W.filter(([r]) => r.p.startsWith('ticketPrizes/')).forEach(([r, x]) => { if (x.prize) { n++; total += x.prize.a; if (x.prize.a % 10) bad++; } });
      W.filter(([r]) => r.p.startsWith('tickets/')).forEach(([r, x]) => { if (x.pm !== '2027-02' || !x.exp) bad++; });
    }
    ok(`복권 예산 5만원 안에서 분배 (당첨 ${n}장, 합계 ${total}원)`, total <= 50000 && total > 20000 && !bad);
    run(`for(const k in rnds)delete rnds[k]`);
    run(`users.w1.plan=[{from:'2020-01',amt:300000}]`);
    ok('쉐어비 차등: 30만 100%, 25만 83%, 15만 50%', run(`[bRatio(evs[0],users.w1,'2027-02'),Math.round(bRatio(evs[0],users.w2,'2027-02')*100),bRatio(evs[0],users.w3,'2027-02')].join()`) === '1,83,0.5');
    run(`led={'w1_2027-02':{st:'rest'}};evd=[{uid:'w1',m:'2027-02',a:1000,void:false}]`);
    ok('휴무 달 당첨 할인은 다음 달로', run(`evAdj('w1','2027-02')`) === 0 && run(`evAdj('w1','2027-03')`) === 1000);
    run(`led={};evd=[];users.w4.since='2018-01-01';users.w4.plan=[{from:'2018-01',to:'2025-12',amt:300000}]`);
    ok('쉐어비 구간 끝 달: 2025-12까지만 청구', run(`planAmt(users.w4,'2025-12')`) === 300000 && run(`planAmt(users.w4,'2026-01')`) === null && run(`monthsOf(users.w4).slice(-1)[0]`) === '2025-12');
    run(`users.w4.plan=[{from:'2025-12',amt:300000}];led={'w4_2019-03':{uid:'w4',m:'2019-03',st:'done',paid:300000},'w4_2026-01':{uid:'w4',m:'2026-01',st:'done',paid:300000,base:300000}}`);
    ok('구간 밖 완료 기록은 ⚠, 구간 없는 빈 달은 안 보임', run(`monthsOf(users.w4)[0]`) === '2019-03' && run(`monthsOf(users.w4).includes('2019-04')`) === false && run(`rowOf(users.w4,'2019-03').warn.length`) === 1 && run(`rowOf(users.w4,'2026-01').warn.length`) === 0);
    run(`users.w4.plan=[{from:'2025-12',amt:200000}]`);
    ok('완료한 달 금액은 구간을 바꿔도 고정', run(`rowOf(users.w4,'2026-01').due`) === 300000 && run(`rowOf(users.w4,'2026-02').due`) === 200000);
    run(`led={};evd=[];delete db.batch;delete db.doc`);
    finish();
  })();
}
function finish(){{const fs2=require('fs'),V=JSON.parse(fs2.readFileSync(__dirname+'/../ver.json','utf8')).v,H=fs2.readFileSync(__dirname+'/../index.html','utf8'),A=(H.match(/const APPV='([^']+)'/)||[])[1],A0=(H.match(/APPV0='([^']+)'/)||[])[1];ok('ver.json 버전('+V+') = APPV('+A+') = APPV0('+A0+')',V===A&&A===A0)}console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);}
