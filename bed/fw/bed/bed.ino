// 블랙고스트 베드 센서 — 2단계 (와이파이 + 앱 연결)
// 연결: 레이더 VCC→5V, GND→GND, OUT→P13, TX→P16, RX→P17
// 처음 켜면(또는 IO0 버튼 5초) 임시 와이파이 "BG-BED-SETUP"이 생김 → 폰으로 접속해서 가게 와이파이·베드 번호·보드 비밀번호 입력
// 동작: 사람 있음/없음이 바뀌면 Firestore beds/b<번호>에 기록(st, at), 10분마다 생존 신호(up). 6시간마다 새 프로그램 확인(OTA).
// 보드 비밀번호 = bed@blackghost.app 계정 비밀번호 (이 파일엔 없음 — 공개 저장소라서).
// 계정이 아직 없으면 첫 보드가 설정 화면에서 넣은 비밀번호로 스스로 만듦(v3). 나머지 보드는 같은 비밀번호를 넣으면 됨.
#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include <ArduinoJson.h>

#define FWV "4"
const char* API_KEY = "AIzaSyBTqRIfhUzlsO2YOfaEBlMHWGlLW-R44Z4";   // 앱(index.html)과 같은 공개 값
const char* PROJECT = "tattoo-cream-ecacc";
const char* BED_EMAIL = "bed@blackghost.app";
const char* OTA_VER = "https://blackghosttattoo.github.io/sales-app/bed/bed.ver";
const char* OTA_BIN = "https://blackghosttattoo.github.io/sales-app/bed/bed-app.bin";
const int RADAR_OUT = 13, LED = 2, BOOT_BTN = 0, RX2PIN = 16, TX2PIN = 17;

Preferences pr;
String bedNo = "1", bedPw = "";
int gate = 2, hold = 10;            // 감지 거리 칸(1칸=0.75m, 2=1.5m), 사람 없어진 뒤 '없음'까지 초
String idTok, refTok;
unsigned long tokAt = 0, lastBeat = 0, lastTry = 0, stableAt = 0, lastOta = 0, btnAt = 0;
int sent = -1, raw = -1, failN = 0;

// ---------- 레이더 설정 (LD2410C, 시리얼 256000) ----------
void ldCmd(const uint8_t* d, uint8_t n) {
  const uint8_t H[] = {0xFD, 0xFC, 0xFB, 0xFA}, T[] = {0x04, 0x03, 0x02, 0x01}, L[] = {n, 0};
  Serial2.write(H, 4); Serial2.write(L, 2); Serial2.write(d, n); Serial2.write(T, 4);
  delay(200); while (Serial2.available()) Serial2.read();
}
void ldSetup() {
  Serial2.begin(256000, SERIAL_8N1, RX2PIN, TX2PIN); delay(300);
  const uint8_t en[] = {0xFF, 0x00, 0x01, 0x00}; ldCmd(en, 4);
  uint8_t g = (uint8_t)gate, h0 = hold & 0xFF, h1 = (hold >> 8) & 0xFF;
  const uint8_t p[] = {0x60, 0x00, 0x00, 0x00, g, 0, 0, 0, 0x01, 0x00, g, 0, 0, 0, 0x02, 0x00, h0, h1, 0, 0};
  ldCmd(p, sizeof p);
  const uint8_t ex[] = {0xFE, 0x00}; ldCmd(ex, 2);
  Serial.printf("radar: max %.2fm, hold %ds\n", gate * 0.75, hold);
}

// ---------- 인터넷 ----------
String jesc(const String& s) { String o; for (char c : s) { if (c == '"' || c == '\\') o += '\\'; o += c; } return o; }
int post(const String& url, const String& body, String& out, const String& auth = "") {
  WiFiClientSecure c; c.setInsecure(); HTTPClient h; h.setTimeout(10000);
  if (!h.begin(c, url)) return -1;
  h.addHeader("Content-Type", "application/json");
  if (auth.length()) h.addHeader("Authorization", "Bearer " + auth);
  int code = h.POST(body); out = h.getString(); h.end(); return code;
}
bool login() {
  String out; JsonDocument d;
  if (refTok.length() && post(String("https://securetoken.googleapis.com/v1/token?key=") + API_KEY,
      "{\"grant_type\":\"refresh_token\",\"refresh_token\":\"" + refTok + "\"}", out) == 200) {
    deserializeJson(d, out); idTok = d["id_token"].as<String>(); refTok = d["refresh_token"].as<String>(); tokAt = millis(); return true;
  }
  int code = post(String("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=") + API_KEY,
      "{\"email\":\"" + String(BED_EMAIL) + "\",\"password\":\"" + jesc(bedPw) + "\",\"returnSecureToken\":true}", out);
  if (code == 400 && (out.indexOf("EMAIL_NOT_FOUND") >= 0 || out.indexOf("INVALID_LOGIN_CREDENTIALS") >= 0 && !pr.getBool("made", false))) {
    // 계정이 없으면 한 번 만들어 봄 (이미 있으면 EMAIL_EXISTS로 실패 → 비밀번호가 틀린 것)
    int c2 = post(String("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=") + API_KEY,
        "{\"email\":\"" + String(BED_EMAIL) + "\",\"password\":\"" + jesc(bedPw) + "\",\"returnSecureToken\":true}", out);
    if (c2 == 200) { Serial.println("board account created"); pr.putBool("made", true); code = 200; }
  }
  if (code != 200) { Serial.printf("login fail %d %s\n", code, out.substring(0, 160).c_str()); return false; }
  deserializeJson(d, out); idTok = d["idToken"].as<String>(); refTok = d["refreshToken"].as<String>(); tokAt = millis();
  Serial.println("login ok"); return true;
}
bool sendSt(int st, bool changed) {
  if (WiFi.status() != WL_CONNECTED) return false;
  if (!idTok.length() || millis() - tokAt > 50UL * 60 * 1000) if (!login()) return false;
  String name = String("projects/") + PROJECT + "/databases/(default)/documents/beds/b" + bedNo;
  String body = "{\"writes\":[{\"update\":{\"name\":\"" + name + "\",\"fields\":{"
    "\"st\":{\"stringValue\":\"" + String(st ? "on" : "off") + "\"},"
    "\"v\":{\"stringValue\":\"" FWV "\"},"
    "\"rssi\":{\"integerValue\":\"" + String(WiFi.RSSI()) + "\"}}},"
    "\"updateMask\":{\"fieldPaths\":[\"st\",\"v\",\"rssi\"]},"
    "\"updateTransforms\":[{\"fieldPath\":\"up\",\"setToServerValue\":\"REQUEST_TIME\"}"
    + String(changed ? ",{\"fieldPath\":\"at\",\"setToServerValue\":\"REQUEST_TIME\"}" : "") + "]}]}";
  String out;
  int code = post(String("https://firestore.googleapis.com/v1/projects/") + PROJECT + "/databases/(default)/documents:commit", body, out, idTok);
  if (code != 200) { Serial.printf("write fail %d %s\n", code, out.substring(0, 200).c_str()); idTok = ""; return false; }
  Serial.printf("sent b%s %s%s\n", bedNo.c_str(), st ? "on" : "off", changed ? "" : " (beat)"); return true;
}
void otaCheck() {
  WiFiClientSecure c; c.setInsecure(); HTTPClient h;
  if (!h.begin(c, String(OTA_VER) + "?t=" + millis())) return;
  int code = h.GET(); String v = h.getString(); h.end(); v.trim();
  if (code != 200 || v.length() == 0 || v.length() > 10 || v == FWV) return;
  Serial.println("OTA -> " + v);
  WiFiClientSecure c2; c2.setInsecure();
  httpUpdate.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS); httpUpdate.rebootOnUpdate(true);
  httpUpdate.update(c2, OTA_BIN);
}

// ---------- 와이파이 설정 화면 ----------
void portal(bool force) {
  WiFiManager wm;
  char g[3]; snprintf(g, sizeof g, "%d", gate);
  WiFiManagerParameter pBed("bed", "베드 번호 (1~8)", bedNo.c_str(), 1);
  WiFiManagerParameter pPw("pw", "보드 비밀번호 (bed@blackghost.app)", bedPw.c_str(), 64, "type='password'");
  WiFiManagerParameter pGate("gate", "감지 거리 칸 (2=1.5m, 3=2.25m … 8=6m)", g, 1);
  wm.addParameter(&pBed); wm.addParameter(&pPw); wm.addParameter(&pGate);
  wm.setTitle("BLACKGHOST 베드 센서");
  wm.setConfigPortalTimeout(600);
  wm.setSaveParamsCallback([&]() {
    String b = pBed.getValue(); int n = b.toInt(); if (n >= 1 && n <= 8) bedNo = String(n);
    if (strlen(pPw.getValue())) bedPw = pPw.getValue();
    int gg = String(pGate.getValue()).toInt(); if (gg >= 2 && gg <= 8) gate = gg;
    pr.putString("bed", bedNo); pr.putString("pw", bedPw); pr.putInt("gate", gate);
  });
  digitalWrite(LED, HIGH);
  bool ok = force ? wm.startConfigPortal("BG-BED-SETUP") : wm.autoConnect("BG-BED-SETUP");
  digitalWrite(LED, LOW);
  if (!ok) ESP.restart();
}

void setup() {
  Serial.begin(115200);
  pinMode(RADAR_OUT, INPUT_PULLDOWN); pinMode(LED, OUTPUT); pinMode(BOOT_BTN, INPUT_PULLUP);
  for (int i = 0; i < 3; i++) { digitalWrite(LED, HIGH); delay(150); digitalWrite(LED, LOW); delay(150); }
  pr.begin("bg", false);
  bedNo = pr.getString("bed", "1"); bedPw = pr.getString("pw", ""); gate = pr.getInt("gate", 2);
  Serial.printf("BG bed sensor v%s, bed %s\n", FWV, bedNo.c_str());
  ldSetup();
  WiFi.setHostname(("bg-bed-" + bedNo).c_str());
  portal(bedPw.length() == 0);
  ldSetup();   // 설정에서 거리를 바꿨을 수 있어서 한 번 더
  WiFi.setAutoReconnect(true);
  lastOta = millis() - 6UL * 3600 * 1000 + 60000;   // 켜고 1분 뒤 첫 확인
}

void loop() {
  int p = digitalRead(RADAR_OUT);
  digitalWrite(LED, p);
  if (p != raw) { raw = p; stableAt = millis(); }
  unsigned long now = millis();
  bool due = raw != sent && now - stableAt > 2000;                 // 2초 이상 같은 상태면 바뀐 걸로
  bool beat = sent >= 0 && now - lastBeat > 10UL * 60 * 1000;     // 10분마다 생존 신호
  if ((due || beat) && now - lastTry > (failN ? 30000UL : 0UL)) {
    lastTry = now;
    if (sendSt(raw, due)) { sent = raw; lastBeat = now; failN = 0; } else failN++;
  }
  if (now - lastOta > 6UL * 3600 * 1000 && WiFi.status() == WL_CONNECTED) { lastOta = now; otaCheck(); }
  // IO0 버튼 5초 누르면 설정 화면 다시 열기
  if (digitalRead(BOOT_BTN) == LOW) { if (!btnAt) btnAt = now; else if (now - btnAt > 5000) { btnAt = 0; portal(true); } }
  else btnAt = 0;
  delay(50);
}
