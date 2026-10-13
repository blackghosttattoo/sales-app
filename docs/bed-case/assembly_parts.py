import os,sys,numpy as np,trimesh
D='/home/user/sales-app/docs/bed-case/'
os.chdir(D);g={'__file__':D+'make_case.py'};exec(open(D+'make_case.py',encoding='utf8').read(),g);globals().update(g)
def tm(mf,col):
    me=mf.to_mesh();t=trimesh.Trimesh(vertices=np.array(me.vert_properties)[:,:3],faces=np.array(me.tri_verts));t.metadata['col']=col;return t
P={}
P['body']=tm(body,[120,95,170,255])
# ESP32 (NodeMCU: 검은 기판)
pcb=box(C,ey0+C,ZPCB,C+EW,ey0+C+EL,ZPCB+PCB);P['esp_pcb']=tm(pcb,[25,25,30,255])
P['esp_mod']=tm(box(IW/2-8,ey0+C+0.5,ZPCB+PCB,IW/2+8,ey0+C+25.5,ZPCB+PCB+3.2),[200,200,205,255])
P['esp_ant']=tm(box(IW/2-8,ey0+C+0.5,ZPCB+PCB,IW/2+8,ey0+C+6,ZPCB+PCB+0.8),[30,30,35,255])
P['esp_usb']=tm(box(IW/2-4.5,IL-6.5,ZPCB+PCB,IW/2+4.5,IL+1.0,ZPCB+PCB+3.2),[190,190,195,255])
P['esp_chip']=tm(box(IW/2-3,IL-16,ZPCB+PCB,IW/2+3,IL-10,ZPCB+PCB+1),[15,15,15,255])
hd=None;pins=None
for side in (0,1):
    pc=(C+PINROW) if side==0 else IW-(C+PINROW)
    h=box(pc-1.27,ey0+C+1.85,ZPCB-PLAST,pc+1.27,ey0+C+EL-1.85,ZPCB);hd=h if hd is None else hd+h
    for i in range(19):
        y=ey0+C+(EL-45.72)/2+i*2.54;p=box(pc-0.32,y-0.32,ZPCB-PLAST-6.5,pc+0.32,y+0.32,ZPCB+PCB+1.5);pins=p if pins is None else pins+p
P['esp_hdr']=tm(hd,[10,10,10,255]);P['esp_pins']=tm(pins,[215,180,90,255])
# 레이더 (파란 기판, 22mm가 가로, 핀 줄이 ESP32 쪽 가장자리, 핀 위로)
rz0=-(FLOOR-WIN)+0.01
P['rad_pcb']=tm(box(rx0+C,ry0+C,rz0,rx0+C+RW,ry0+C+RL,rz0+1.2),[40,110,210,255])
P['rad_ic']=tm(box(rx0+C+12,ry0+C+4,rz0+1.2,rx0+C+17,ry0+C+9,rz0+2.2),[15,15,15,255])
ry1=ry0+C+RL-1.6
P['rad_hdr']=tm(box(rx0+C+4.6,ry1-1.27,rz0+1.2,rx0+C+4.6+12.7,ry1+1.27,rz0+3.7),[10,10,10,255])
rp=None
for i in range(5):
    x=rx0+C+4.6+1.27+i*2.54;p=box(x-0.32,ry1-0.32,rz0+1.2,x+0.32,ry1+0.32,rz0+3.7+6);rp=p if rp is None else rp+p
P['rad_pins']=tm(rp,[215,180,90,255])
# 점퍼선 커넥터(듀폰) + 선: 레이더 VIN·GND·OUT → ESP32 5V·GND·P13 (USB쪽 왼쪽 줄)
cols={'5V':[220,40,40,255],'GND':[30,30,30,255],'OUT':[240,200,30,255]}
pcl=C+PINROW
def yp(k):return ey0+C+(EL-45.72)/2+(18-k)*2.54    # k: USB쪽 끝에서 몇 번째(0=5V)
rad_x={'5V':rx0+C+4.6+1.27+0*2.54,'GND':rx0+C+4.6+1.27+1*2.54,'OUT':rx0+C+4.6+1.27+2*2.54}
esp_y={'5V':yp(0),'GND':yp(5),'OUT':yp(4)}
import math
def tube(a,b,r=0.6):
    a=np.array(a,float);b=np.array(b,float);v=b-a;L=np.linalg.norm(v);t=trimesh.creation.cylinder(radius=r,height=L,sections=10)
    t.apply_translation([0,0,L/2]);z=np.array([0,0,1.0]);ax=np.cross(z,v/L);an=math.acos(np.clip(z@(v/L),-1,1))
    if np.linalg.norm(ax)>1e-6:t.apply_transform(trimesh.transformations.rotation_matrix(an,ax))
    t.apply_translation(a);return t
for k,col in cols.items():
    du=box(rad_x[k]-1.27,ry1-1.27,rz0+3.7,rad_x[k]+1.27,ry1+1.27,rz0+3.7+14);P['dr_'+k]=tm(du,[20,20,20,255])
    de=box(pcl-1.27,esp_y[k]-1.27,ZPCB-PLAST-14,pcl+1.27,esp_y[k]+1.27,ZPCB-PLAST);P['de_'+k]=tm(de,[20,20,20,255])
    a=[rad_x[k],ry1,rz0+3.7+14];m1=[rad_x[k],ry1+6,rz0+20];m2=[IW/2,ey0+20,4];m3_=[pcl+4,esp_y[k],3];e=[pcl,esp_y[k],ZPCB-PLAST-14]
    ts=[tube(p,q) for p,q in zip([a,m1,m2,m3_],[m1,m2,m3_,e])];w=trimesh.util.concatenate(ts);w.metadata['col']=col;P['w_'+k]=w
# USB 케이블
P['cable']=tm(box(IW/2-5.5,IL+1,ZPCB+PCB-1.8,IW/2+5.5,IL+16,ZPCB+PCB+5),[235,235,235,255])
P['cable2']=tm(m3.Manifold.cylinder(30,2,2,24).rotate([-90,0,0]).translate([IW/2,IL+16,ZPCB+PCB+1.6]),[235,235,235,255])
P['lid']=tm(lid,[200,120,90,255])
sc=trimesh.Scene()
for k,v in P.items():
    c=v.metadata.get('col');v.visual=trimesh.visual.ColorVisuals(v);v.metadata['col']=c
for k,v in P.items():sc.add_geometry(v,node_name=k,geom_name=k)
import json
for k,v in P.items():
    v.visual=trimesh.visual.ColorVisuals(v)
sc.export(sys.argv[1]);json.dump({k:v.metadata.get('col',[150,150,150,255]) for k,v in P.items()},open(sys.argv[1]+'.json','w'));print('ok',len(P))
