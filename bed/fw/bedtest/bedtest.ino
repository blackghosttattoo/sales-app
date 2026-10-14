// 블랙고스트 베드 센서 — 1단계 동작 시험 프로그램
// 레이더(LD2410C) OUT → 보드 P13. 사람이 있으면 보드의 파란 불(P2)이 켜지고, 없으면 꺼짐.
// 와이파이·앱 연결 없음. 시작할 때 파란 불이 3번 깜빡이면 프로그램이 잘 들어간 것.
const int RADAR_OUT = 13;
const int LED = 2;

void setup() {
  Serial.begin(115200);
  pinMode(RADAR_OUT, INPUT_PULLDOWN);
  pinMode(LED, OUTPUT);
  for (int i = 0; i < 3; i++) { digitalWrite(LED, HIGH); delay(200); digitalWrite(LED, LOW); delay(200); }
  Serial.println("BG bed sensor test start");
}

void loop() {
  static int last = -1;
  int p = digitalRead(RADAR_OUT);
  digitalWrite(LED, p);
  if (p != last) { Serial.println(p ? "person: YES" : "person: no"); last = p; }
  delay(50);
}
