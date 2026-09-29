# ReSMap 프로젝트 페이지 TODO

파일명이 `_`로 시작해서 Jekyll이 배포하지 않습니다. 레포에만 있고 사이트에는 안 올라갑니다.

## 1. 영상 (최우선)

두 칸 모두 **이미 페이지에 만들어져 있습니다.** 파일만 넣으면 HTML 수정 없이 나타납니다.

- 파일이 없을 때 공개 화면: teaser 칸은 숨김, §4는 "The videos are on their way." 한 줄
- 주소 뒤에 `?draft`를 붙이면 두 칸 모두 기다리는 파일명이 적힌 자리표시가 보임 (레이아웃 확인용)
- 동작 검증: `node tools/check-video.js`

### Teaser와 §4의 역할 구분

둘 다 여러 모델 비교이지만, 역할이 다릅니다. teaser는 **광고**, §4는 **자료실**입니다.

| | Teaser (hero) | §4 Qualitative results |
|---|---|---|
| 보는 사람 | 첫 화면만 보고 나갈 수도 있는 방문자 | 끝까지 내려온, 확인하고 싶은 사람 |
| 목적 | 한 문장을 한눈에: 카메라가 죽어도 ReSMap은 맵을 그린다 | 증거: 골라서 보여준 게 아니라는 것 |
| 장면 | 가장 잘 보이는 한 장면 | 장면 5개 × 설정 3개, 탭으로 선택 |
| 화면 구성 | 단순하게: ReSMap vs SatforHDMap (+ 가능하면 카메라 전용 baseline) | 전부: 6개 카메라 + 위성 + 모든 모델 + GT |
| 조건 | clean → all-drop 전환 한 번 | 60×30 clean / Front-3 drop / 100×50 (논문 qualitative figure의 세 행) |
| 재생 | 자동재생, 음소거, 반복 | 컨트롤 있음 |
| 길이 | 10–15초 | 제한 없음 |

- teaser는 §4 렌더링에서 가장 좋은 장면을 잘라 만들면 됨. 파이프라인은 하나로 충분
- 여력이 하나뿐이면 **teaser 우선**

### Teaser

- [ ] 모델: **ReSMap vs SatforHDMap** 최소. MapTracker는 OneDrive가 풀리면 추가
- [ ] **SatforHDMap이 필수인 이유**: 같은 위성 입력인데 clean 27.0 → all-drop 14.3으로 무너짐.
      이게 옆에 있어야 성능이 위성 입력이 아니라 방법론에서 나온다는 게 보임.
      ReSMap 단독 영상은 "위성이 다 한 거 아니냐"는 질문에 답을 못 함
- [ ] SatforHDMap은 HF에 체크포인트가 있어서 OneDrive 없이도 가능 (재추론 필요)
- [ ] 클립 중간에 6개 카메라를 모두 0으로
- [ ] fps 5 (fps 10은 너무 짧다는 피드백)
- [ ] 캡션: 지금은 초안 ("Clean input, then all six cameras zeroed. SatforHDMap and ReSMap read the same satellite tile.")

### §4 장면 × 설정

- [ ] 장면 (버튼은 이미 이 다섯 개로 맞춰 둠):
  - onenorth: `scene-0369`, `scene-0368`, `scene-0963`
  - boston: `scene-0739`, `scene-0747`
  - 새 장면은 onenorth / boston만 가능 (100×50 위성 타일을 재생성한 도시가 이 둘뿐)
- [ ] 설정별 모델 구성이 다름에 주의:
  - 60×30 clean / Front-3 drop: MapTracker, SDTagNet, SatforHDMap, ReSMap
  - 100×50: SDTagNet(long-range 체크포인트 있음), ReSMap. SatforHDMap은 60×30 체크포인트뿐
- [ ] 캡션: 공통 문장은 `figcaption`의 `data-base`, 설정별 문장은 각 탭 버튼의 `data-caption`. 실제 영상의 열 순서에 맞게 고칠 것
- [ ] 15개를 다 채울 필요는 없음. 없는 조합은 "Not rendered for this scene and setting yet."으로 표시됨

### 파일 규격

| 용도 | 경로 |
|---|---|
| Teaser 영상 / 포스터 | `assets/video/teaser.mp4` / `teaser.jpg` |
| §4 영상 / 포스터 | `assets/video/<scene>_<setting>.mp4` / `.jpg` (`setting` = `clean`, `front3`, `long`) |

예: `scene-0369_front3.mp4`. 웹용 인코딩:

```sh
ffmpeg -i in.mp4 -c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow \
       -movflags +faststart -an assets/video/scene-0369_front3.mp4
ffmpeg -i assets/video/scene-0369_front3.mp4 -frames:v 1 -q:v 3 assets/video/scene-0369_front3.jpg
```

### 제작 파이프라인 / 막힌 부분

- 스크립트: `min_ws/make_teaser_video.py` (resmap conda env). 지금 버전은 **ReSMap 단독**
  (GT + ReSMap × 60×30 clean / Front-3 drop / 100×50)이라 모델 비교 열 추가가 필요
- 예전 출력 `min_ws/teaser_vis/`는 현재 없음. 다시 돌려야 함
- **MapTracker**: 체크포인트/예측이 OneDrive에만 있음. `rclone config reconnect onedrive:` 필요
- **SDTagNet**: 예측 json 없음. `tools/test.py --format-only`로 재추론
- **SatforHDMap**: HF 체크포인트로 재추론
- 세부 위치는 Claude 메모리 `scene0369-video-assets`에 있음

## 2. 링크

- [ ] **Paper** 버튼: arXiv 나오면 `href` 넣고 `aria-disabled`, `(soon)` 제거 (`index.html` 103행)
- [ ] **Code** 버튼: 공개 레포 나오면 같은 방식으로 (104행)

## 3. 결과 표 (탭)

Table 1(clean)과 Table 2(카메라 고장)는 표 위 탭으로 데이터셋을 바꿉니다.

| 표 | 탭 | 출처 | 상태 |
|---|---|---|---|
| Table 1 | nuScenes · geo split | 논문 Tab. 1 | 공개 |
| Table 1 | nuScenes · original split | 논문 Tab. 6 | 공개 |
| Table 2 | nuScenes · geo split | 논문 Tab. 2 | 공개 |
| Table 2 | nuScenes · original split | 논문 Tab. 7 (mRR/mCE 제외) | 공개 |
| Table 2 | Argoverse 2 · geo split | OpenReview 리부탈 | **`?draft`에서만** |

### Argoverse 2 탭 공개 전에 채울 것

- [ ] **DAMap (C+L)**, **SatforHDMap (C+SA)** 행: Clean / Front-1 / Front-3 / All
  - 리부탈 초안(pzup·Fu3u·ZrMF.md)에서도 빈칸이었음. 최종 게시본에 들어갔는지 확인 필요
  - 참고: OneDrive 체크포인트 이름상 clean mAP는 SatforHDMap 0.7088(ep20)/0.7056(ep24), DAMap 0.6232.
    단, DAMap은 "LiDAR 켜고 재실행" 메모가 있어서 0.6232가 C+L인지 불확실
- [ ] 다섯 행 모두 **Ep.** (지금 `–`)와 ReSMap의 **Temp.** 여부 확인 (74.6이 temporal인지)
- [ ] AV2 Front-1 / Front-3 정의 확인: 캡션에는 "nuScenes와 같은 전방 카메라, All은 7개 전부"로 적어 둠
- [ ] 다 채워지면 `index.html`의 AV2 탭 버튼과 패널에서 `data-draft`, `hidden`, `tr.pending` 제거

### AV2 추가 평가 (예정)

모달리티별 하나씩: **MapTracker (C), DAMap (C+L), SDTagNet (C+SD), SatforHDMap (C+SA)**.
nuScenes 표에 있는 MapTRv2(C+L), PriorDrive(보고치) 등은 AV2에서는 빠짐.

## 4. 논문 쪽 확인 (카메라 레디 전)

`tools/check-numbers.js`가 매번 경고로 보여줍니다. 페이지는 논문을 그대로 옮긴 상태라, 논문을 고치면 페이지와 체커의 `IN_THE_PAPER` 목록도 같이 고칠 것.

- [ ] **Tab. 6 vs Tab. 7**: non-temporal ReSMap original split clean mAP **82.8** vs **82.9**
      (Tab. 6 per-class AP 평균은 82.8, Tab. 7 하락률은 82.9 기준으로 계산돼 있음)
- [ ] **Tab. 1**: SDTagNet 100×50 m, AP 11.9 / 25.5 / 30.8의 평균은 22.7인데 mAP가 **22.5**
- [ ] **MapTracker 에폭**: 60×30 m에서 Tab. 1·6은 **72**, Tab. 2·7은 **70**
- [ ] PriorDrive 모달리티: 리부탈에서 "C+SD는 과소표기, Tab. 1·6 수정하겠다"고 약속함. 페이지도 같이 바꿀 것

## 5. 배포 전 체크

```sh
sh tools/check.sh && git push
```

- 숫자 교차검증(표끼리, 표↔walkthrough, mAP=AP 평균 포함), 도로 스트립, 영상 칸·표 탭, 제목 효과 테스트를 실제 종료 코드로 돌림
- 결과를 `| tail` 같은 파이프로 넘기지 말 것. 실패가 가려짐
- CSS/JS를 고치면 `index.html`의 `?v=N`을 올릴 것 (Pages 캐시 10분)
