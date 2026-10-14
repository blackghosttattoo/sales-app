# 베드 사용 현황 센서 프로젝트 (2026-10-12 시작)

블랙고스트 작업실 베드마다 사람 감지 센서를 달아 앱에 "1번 베드 사용 중 / 비어 있음 / 꺼짐"을 실시간 표시하는 계획.
사용자(대장님)는 개발 입문자 — 한국어로 쉽게 설명.

## 구매 완료 (쿠팡, 2026-10-12, 합계 23,500원) — 시험용 1세트
- 센서: 24GHz 레이더 LD2410C-P (핀 5개: TX RX OUT GND VCC) 9,900원
- 보드: ESP32 USB-C DevKitC 38핀 9,900원
- 점퍼선 암-암 20cm 40가닥 700원(+배송 3,000)
- 집에 있는 것: 데이터용 USB-C 케이블, 폰 충전기, 양면테이프

## 정한 방향
- 베드 1개당 센서 1 + 보드 1 (독립, 고장 격리). 늘릴 땐 같은 세트 추가(알리가 저렴).
- 연결: VCC(5V)·GND·OUT 3가닥만 (OUT = 사람 있음/없음 디지털 신호). 감지 거리는 1.5m 안쪽으로 제한(옆 베드 오감지 방지).
- 프로그램 넣기: 처음 한 번만 PC 크롬에서 웹 설치 페이지(버튼 클릭, 설치 프로그램 없음). 이후 와이파이 자동 업데이트(OTA).
- 와이파이 설정: 보드가 "BG-BED-1" 같은 임시 와이파이를 띄우면 폰으로 접속해 가게 와이파이 입력. 2.4GHz만 가능(_5G 아닌 쪽).
- 데이터: Firestore에 상태 바뀔 때만 기록. 보드 전용 계정(베드 상태만 쓰기 가능하게 규칙 제한). 무료 요금제 유지.
- 전원: 사용자는 조명 레일(조명 켤 때만 전기)에 연결할 생각 → 사용 중일 때만 10분마다 생존 신호, 15분 넘게 없으면 앱에 "꺼짐"(회색). 레일 콘센트/USB 어댑터 필요(KC 인증, 레일 사진 받아서 규격 확인 예정). 첫 시험은 일반 콘센트 권장.
- 케이스: 사용자가 뱀부랩 P2S 3D 프린터 보유 → 보드+센서 한 통 케이스 STL/3MF 제작 예정(약 6×4×2.5cm, USB-C 구멍, 버튼 구멍, 통풍, 끼움 뚜껑, 글자 음각 가능). 센서 앞 벽 2mm 이하, PLA/PETG만(메탈·실크·카본 필라멘트 금지).

## 진행 (2026-10-13)
- 부품 도착(사진 받음). 붙일 위치: **천장·조명 레일(레이더가 아래를 봄)**, 연결: **점퍼선 꽂기**(사용자 결정).
- 케이스 v1 만듦 → 보드가 NodeMCU-32S(25.5×48.5, 핀 줄 22.86)로 확인돼 v2로 수정: `docs/bed-case/`(bed-case.3mf, 맞춤 시험 조각 fit-test.3mf, 설계 파이썬, README). 시험 조각 결과 받기.
- 배선: VCC→5V, GND→GND, OUT→GPIO13.

- 2026-10-14 부품 도착. 레이더 핀 순서 TX RX OUT GND VCC, 금색 안테나 면 = 케이스 바닥(아래) 쪽.
- **1단계 동작 시험**: `bed/fw/bedtest/bedtest.ino`(OUT→P13 읽어 보드 파란 불 P2), 웹 설치 페이지 https://blackghosttattoo.github.io/sales-app/bed/ (`bed/index.html`, ESP Web Tools, `bed/bedtest.json`).
- 빌드: 이 작업 환경은 Arduino·PlatformIO 서버가 막혀 있어서 GitHub Actions(`.github/workflows/bedfw.yml`)가 `bed/fw/*/`를 arduino-cli(esp32 3.0.7, fqbn nodemcu-32s)로 빌드해 `bed/<이름>.bin`(merged, 0x0부터)을 커밋. 소스만 push하면 자동.

- 2026-10-14 **첫 설치 성공**(espressif.github.io/esptool-js, 115200, 0x0, bedtest.bin, 16초). 겪은 문제: ESP Web Tools가 'Preparing installation'에서 멈춤 → 이 보드는 자동 받기 모드 전환이 잘 안 됨. 해결: 다른 탭 닫기(포트 점유 'Failed to open'), CP210x 드라이버(v6.7.6 설치 파일), **IO0 누른 채 EN 눌렀다 떼고 IO0 떼기** 후 Connect, 설치 땐 레이더 선 빼기(Flash ID ffffff 오류). 칩 ESP32-D0WD-V3, Flash ID 1640c8.

- 1단계 결과: 프로그램 동작(빨간 전원 불 + 사람 감지 시 파란 불 P2). 가게 와이파이 2.4GHz 있음. **베드 총 4개**.
- 2단계 계획(사용자 확인 대기): 레이더 TX→P16·RX→P17 추가(감지 거리 1.5m 설정용), 폰으로 'BG-BED-설정' 임시 와이파이에서 가게 와이파이·베드 번호 입력, 보드 전용 계정으로 상태 바뀔 때 + 10분마다 생존 신호 기록, 15분 없으면 '꺼짐', 규칙 추가, 앱 '베드 현황'(총괄·마을), OTA.

- **2단계 만듦(10-14)**: `bed/fw/bed/bed.ino`(FWV "2") — WiFiManager 설정 화면 'BG-BED-SETUP'(가게 와이파이, 베드 번호, 보드 비밀번호, 감지 거리 칸; Preferences 'bg' 저장, IO0 5초=다시 설정), LD2410C 시리얼(256000, P16/P17) 설정 명령으로 최대 거리 칸·무인 시간(10초), OUT 2초 이상 유지되면 Firestore REST `documents:commit`으로 beds/b<번호> st·v·rssi + up(서버 시간) + 바뀌면 at, 10분 생존 신호, 실패 시 30초 뒤 재시도, Firebase Auth REST(signInWithPassword → refresh). OTA: 6시간마다 bed/bed.ver ≠ FWV면 bed/bed-app.bin으로 httpUpdate. 빌드 fqbn esp32:esp32:esp32:PartitionScheme=min_spiffs, 라이브러리 WiFiManager 2.0.17·ArduinoJson 7.2.1. **프로그램 고칠 땐 FWV를 올리면 4개 보드가 자동 업데이트.**
- 보드 계정: Firebase Auth `bed@blackghost.app`(v3부터 첫 보드가 accounts:signUp으로 스스로 생성 — 사용자가 콘솔 접속 불가해서, 비밀번호는 보드 설정 화면에만 — 공개 저장소에 넣지 않음). 규칙 `beds` 이 이메일만 쓰기.
- 앱 v1.42 '베드 현황'(브랜치에 준비, 배포 확인 대기).

- 10-14 오후: v2~v4 설치 후 레이더 5가닥 연결 상태에서 부팅 실패(invalid header 0xffffffff 반복)·파란 불 안 들어옴. 주황(OUT)이 SD2에 꽂혔던 적 있음(플래시 핀). Erase Flash 후 v4 다시 넣고 레이더 없이 켜니 BG-BED-SETUP 정상. 레이더 연결 후 다시 불 안 들어옴(원인 미확인 — TX/RX 선이거나 레이더 설정 명령 의심). 사용자 "처음부터 다시, 정리해놔".
- **v5 단순화**: TX·RX 안 씀(3가닥만), 레이더 설정 명령·감지 거리 칸 입력 제거(거리는 HLKRadarTool 블루투스 앱으로), 파란 불 상태 표시(설정 대기=켜짐, 와이파이 끊김=빠른 깜빡, 기록 실패=2번 깜빡). `bed/index.html`을 '처음부터' 0~5단계 한 장 안내로 새로 씀.

- **원인 찾음(10-14 저녁)**: 레이더 연결 시 'invalid header 0xffffffff' 부팅 실패는 **보드 실크 인쇄 오류** — 5V 옆 핀이 'GND'로 적혀 있지만 표준 38핀 배치상 **CMD(GPIO11, 플래시 명령선)**. 레이더 GND를 거기 꽂아서 플래시 통신이 막힘. 배선 확정: VCC→5V(1번째), OUT→P13(5번째), **GND→P13 다음 GND(6번째)**. (v5는 3가닥, 레이더 없이 설정 화면까지 정상 확인)

- 🎉 **1번 보드 성공(10-14 20시경)**: GND 핀 옮긴 뒤 로그 'BG bed sensor v5, bed 1 → AutoConnect SUCCESS → login ok(보드 계정 자동 생성됨) → sent b1 on'. Firestore beds/b1 기록 확인. 남은 것: 앱 v1.42 배포, 감지 거리 1.5m(HLKRadarTool), 케이스 출력, 나머지 3세트.

## 다음 단계 (사용자 응답 대기)
1. 부품 도착 후 사진(자 옆에서) + 실측 치수(mm) 받기 → 케이스 설계
2. 케이스 붙일 위치 결정(베드 밑 / 벽 / 레일 근처) — 질문해둔 상태
3. 베드 개수 확인
4. 연결 그림, ESP32 프로그램, 웹 설치 페이지, 앱 "베드 현황" 화면(대기 목록에 넣을지 확인)
