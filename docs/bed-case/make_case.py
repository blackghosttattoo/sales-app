# 베드 센서 케이스 (ESP32 DevKitC 38핀 USB-C + LD2410C) — 천장/조명 레일에 붙이고 레이더가 아래(베드)를 봄
# 실행: pip install manifold3d trimesh && python3 make_case.py  → body.stl, lid.stl
# 단위 mm. 숫자만 바꿔서 다시 만들 수 있게 맨 위에 모아 둠.
import manifold3d as m3, trimesh, numpy as np, os
C = 0.3            # 부품 여유(한쪽)
# 부품 실측(사진·규격 기준 추정 — 실제와 다르면 여기만 고치기)
EW, EL = 28.5, 52.0          # ESP32 보드 폭·길이
PCB = 1.6                    # 보드 두께
PLAST = 2.5                  # 핀 헤더 검은 플라스틱 높이
PINROW = 1.27                # 보드 가장자리 ~ 핀 줄 중심
RW, RL = 22.0, 16.0          # LD2410C 폭·길이
# 케이스
WALL, FLOOR, WIN = 2.0, 1.6, 1.2   # 벽, 바닥(=레이더가 보는 면), 레이더 밑 바닥
IW = EW + 2*C + 0.3               # 안쪽 폭
RZ = RL + 2*C + 1.0 + 2.0         # 레이더 칸 길이
IL = RZ + EL + 2*C                # 안쪽 길이
IH = 30.0                         # 안쪽 높이
ZPCB = 22.0                       # 바닥 윗면 ~ ESP32 보드 밑면 (아래로 꽂는 점퍼선 공간)
LIP, LIPT, LIPC = 4.0, 1.2, 0.15  # 뚜껑 턱 깊이·두께·여유
def box(x0, y0, z0, x1, y1, z1):
    return m3.Manifold.cube([x1-x0, y1-y0, z1-z0]).translate([x0, y0, z0])
def cyl(x, y, z0, h, r, n=48):
    return m3.Manifold.cylinder(h, r, r, n).translate([x, y, z0])
# 좌표: 안쪽 바닥 윗면 z=0, 안쪽 공간 x 0~IW, y 0~IL. 레이더 칸 y 0~RZ, ESP32는 y RZ~IL(USB 쪽이 y=IL 벽)
OX0, OY0, OZ0 = -WALL, -WALL, -FLOOR
body = box(OX0, OY0, OZ0, IW+WALL, IL+WALL, IH) - box(0, 0, 0, IW, IL, IH+1)
# 레이더 자리: 바닥을 얇게(WIN) 파서 자리 잡기 + 낮은 테두리
rx0, ry0 = (IW-(RW+2*C))/2, 1.0
body -= box(rx0, ry0, -(FLOOR-WIN), rx0+RW+2*C, ry0+RL+2*C, 0.01)
rim = box(rx0-1.2, ry0-1.2, 0, rx0+RW+2*C+1.2, ry0+RL+2*C+1.2, 1.5) - box(rx0, ry0, -1, rx0+RW+2*C, ry0+RL+2*C, 2)
rim -= box(rx0+3, ry0+RL+2*C-0.5, -1, rx0+RW+2*C-3, ry0+RL+2*C+2, 3)   # ESP32 쪽 테두리는 터서 선 지나가게
body += rim
# ESP32 받침: 양쪽 벽에 홈 파인 레일(핀 줄이 홈에 들어가고 검은 플라스틱이 레일 위에 얹힘). 안테나 쪽 30mm만(USB 쪽은 점퍼선 자리)
ey0 = RZ                       # 보드 안테나 쪽 끝
RTOP = ZPCB - PLAST
for side in (0, 1):
    xw = 0 if side == 0 else IW
    pc = (C + PINROW) if side == 0 else IW - (C + PINROW)       # 핀 줄 중심 x
    r0, r1 = (0, 4.2) if side == 0 else (IW-4.2, IW)
    rail = box(r0, ey0, 0, r1, ey0+30, RTOP) - box(pc-0.8, ey0-1, RTOP-7.5, pc+0.8, ey0+31, RTOP+1)
    body += rail
# USB 쪽 끝: 보드 모서리 받침 턱 두 개 + USB 구멍(위가 열린 U자 — 케이블 꽂고 뚜껑 덮기)
uc = IW/2; uw, ub = 13.0, ZPCB - 0.4
for x0 in (3.2, IW-8.0):
    body += box(x0, IL-1.5, ZPCB-3, x0+4.8, IL, ZPCB)
body -= box(uc-uw/2, IL-1, ub, uc+uw/2, IL+WALL+1, IH+1)
# 통풍구: 긴 벽에 가로 슬롯
for x in (OX0-1, IW-0.5):
    for i in range(5):
        y = RZ + 8 + i*8
        body -= box(x, y, 6, x+WALL+1.5, y+4, 16)
# 뚜껑 고정용 작은 구멍(뚜껑 턱의 돌기가 딸깍 들어감)
for y in (IL*0.25, IL*0.75):
    for x in (OX0-1, IW-0.5):
        body -= box(x, y-2, IH-LIP/2-0.8, x+WALL+1.5, y+2, IH-LIP/2+0.8)
# ---- 뚜껑(천장에 붙는 면) ----
lw, ll = IW-2*LIPC, IL-2*LIPC
lid = box(OX0, OY0, 0, IW+WALL, IL+WALL, 2.0)
lip = box(LIPC, LIPC, -LIP, LIPC+lw, LIPC+ll, 0.01) - box(LIPC+LIPT, LIPC+LIPT, -LIP-1, LIPC+lw-LIPT, LIPC+ll-LIPT, 1)
lip -= box(uc-uw/2-0.5, IL-3, -LIP-1, uc+uw/2+0.5, IL+1, 1)              # USB 구멍 자리 비움
for y in (IL*0.25, IL*0.75):                                               # 딸깍 돌기
    lip += box(LIPC-0.45, y-1.8, -LIP/2-0.6, LIPC+0.3, y+1.8, -LIP/2+0.6)
    lip += box(LIPC+lw-0.3, y-1.8, -LIP/2-0.6, LIPC+lw+0.45, y+1.8, -LIP/2+0.6)
lid += lip
# ESP32 모듈(은색 덮개) 누름 기둥: 보드가 들뜨지 않게
mz = IH - (ZPCB + PCB + 3.2) - 0.3
lid += box(uc-5, ey0+4, -mz, uc+5, ey0+14, 0.01)
# 천장 나사 구멍 2개(접시머리), 양면테이프만 써도 됨
for y in (6, IL-6):
    lid -= cyl(uc, y, -LIP-1, 10, 1.75)
    lid -= m3.Manifold.cylinder(1.8, 3.6, 1.75, 48).translate([uc, y, -0.01])   # 안쪽 면에서 나사 머리가 묻히게
def save(mf, name, flip=False):
    me = mf.to_mesh(); t = trimesh.Trimesh(vertices=np.array(me.vert_properties)[:, :3], faces=np.array(me.tri_verts))
    if flip: t.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0]))
    t.apply_translation(-t.bounds[0]); t.export(os.path.join(os.path.dirname(os.path.abspath(__file__)), name)); return t
b = save(body, 'body.stl'); l = save(lid, 'lid.stl', flip=True)   # 뚜껑은 넓은 면이 바닥에 오게(출력용)
print('몸통', np.round(b.extents, 1), '뚜껑', np.round(l.extents, 1), 'watertight', b.is_watertight, l.is_watertight)
print('안쪽', round(IW, 1), round(IL, 1), IH)
# ---- 맞춤 점검: 가짜 부품을 넣어 케이스와 겹치는지 확인 ----
esp = box(C, ey0+C, ZPCB, C+EW, ey0+C+EL, ZPCB+PCB) + box(IW/2-9, ey0+C, ZPCB+PCB, IW/2+9, ey0+C+25.5, ZPCB+PCB+3.2)
for side in (0, 1):
    pc = (C + PINROW) if side == 0 else IW - (C + PINROW)
    esp += box(pc-1.27, ey0+C+1.85, ZPCB-PLAST, pc+1.27, ey0+C+EL-1.85, ZPCB)          # 헤더 플라스틱
    esp += box(pc-0.32, ey0+C+1.85, ZPCB-PLAST-6, pc+0.32, ey0+C+EL-1.85, ZPCB-PLAST)   # 핀
usb = box(IW/2-4.5, IL-7, ZPCB+PCB, IW/2+4.5, IL+1.0, ZPCB+PCB+3.2)
rad = box(rx0+C, ry0+C, -(FLOOR-WIN)+0.01, rx0+C+RW, ry0+C+RL, 1.2-(FLOOR-WIN))
lidp = lid.translate([0, 0, IH])
for nm, part in (('ESP32', esp), ('USB', usb), ('레이더', rad)):
    print(nm, '케이스와 겹침', round((part ^ body).volume(), 2), '뚜껑과 겹침', round((part ^ lidp).volume(), 2))
print('뚜껑-몸통 겹침', round((lidp ^ body).volume(), 2))
