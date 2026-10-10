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
  firestore: Object.assign(() => ({}), { FieldValue: { arrayUnion: x => x, delete: () => null, serverTimestamp: () => new Date() } }),
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

const tabs = { admin: ['home', 'in', 'toss', 'share', 'more', 'sup', 'acd', 'set', 'inv', 'evt', 'conf'], artist: ['home', 'in', 'toss', 'share', 'more', 'sup', 'evt', 'acd'] };
for (const [who, list] of Object.entries(tabs)) {
  run(who === 'admin' ? `me=users.a` : `me=Object.assign({},users.w1);shareOK=true`);
  for (const k of list) {
    try { run(`tab='${k}';draw()`); ok(`${who} ${k} 화면`, out().length > 100); }
    catch (e) { ok(`${who} ${k} 화면 (${e.message})`, false); }
  }
}
run(`tab='conf'`); for (const c of ['user', 'prod', 'toss', 'note']) { try { run(`cs='${c}';draw()`); ok(`설정 ${c}`, out().length > 100); } catch (e) { ok(`설정 ${c} (${e.message})`, false); } }
try { run(`me=users.s1;draw()`); ok('수강생 화면', /오늘도 화이팅/.test(out())); } catch (e) { ok('수강생 화면 (' + e.message + ')', false); }

console.log(fail ? `\n실패 ${fail}건` : '\n모두 통과');
process.exit(fail ? 1 : 0);
