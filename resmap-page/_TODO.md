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

### Teaser — 완료 (2026-10-06)

- `assets/video/teaser.mp4` (720p, crf 24, 4.3 MB, 52초) + `teaser.jpg`. 아래 배속 버튼(0.5–2×) 있음
- 세 장면, 모두 geo split val이면서 original val이라 어떤 모델도 학습에 안 쓴 장면:
  scene-0795 Front-1 → scene-0963 Front-3 → scene-0558 All
- 패널: 위성 타일 | MapTracker | SatforHDMap | ReSMap (회색 바탕, GT 연하게). 숫자는 Table 2 전체 val 값
- 생성: `min_ws/teaser_draft/make_teaser.py` (resmap env). 예측은 turing `resmap_lrsqrt/teaser/run_scene.sh <scene>`,
  SatforHDMap은 `teaser_draft/satforhdmap/run_satforhdmap_scene.py --scene_token ...`
- 주의: 가진 SatforHDMap 체크포인트는 original split 모델이라, 장면은 original train에 없는 것만 써야 함
- 남은 것: 폰 폭에서 패널 글자가 작음 (탭해서 크게 보기 또는 세로 버전 검토)

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
| Table 1 | Argoverse 2 · geo split | 로그의 클래스별 AP 3행 + 평가 예정 칸 | 공개 (빈 칸은 `–`) |
| Table 2 | Argoverse 2 · geo split | 리부탈 3행 + 평가 예정 칸 | 공개 (빈 칸은 `–`) |

### Argoverse 2 탭에서 채울 것

(ReSMap non-temporal은 AV2에서 돌리지 않음. 행 없음.)
**채우기 전에 `min_ws/ReSMap_numbers_inconsistencies.md` E4·E5를 먼저 볼 것**: 위성 baseline이 카메라 고장에서 ReSMap보다 덜 떨어진 기존 측정이 있고, SatMap/SatforHDMap 이름이 섞여 있음.

평가가 끝나면 `index.html`에서 해당 행의 `class="pending"`을 빼고, 위 행들과 같은 형식(mAP, 자기 Clean 대비 하락률)으로 적으면 됩니다.

- [ ] **DAMap (C+L)**: Clean / Front-1 / Front-3 / All
- SatforHDMap: AV2 행 삭제 (2026-10-07, 사용자 결정). 이유: 공개 평가가 임계값 2/4/6 m라 재평가 필요한데 현 기준으로도 낮고, 위성에 과적합돼 카메라 드롭에 거의 안 떨어짐. 카메라레디 부록에 생략 이유 한 줄 필요 (리부탈 "remaining baselines" 약속)
- [ ] 모든 행의 **Ep.** (지금 `–`)
- [ ] 하락률 계산 방식을 논문 표와 통일할지 결정 (리부탈은 반올림 전 값 기준)

## 4. 논문 쪽 확인 (카메라 레디 전)

전체 목록과 근거는 **`min_ws/ReSMap_numbers_inconsistencies.md`**에 정리돼 있습니다.
`tools/check-numbers.js`가 논문 내부 불일치를 매번 경고로 보여주고, 논문을 고치면 페이지 표와 체커의 `IN_THE_PAPER` 목록도 같이 고칠 것.

## 5. 배포 전 체크

```sh
sh tools/check.sh && git push
```

- 숫자 교차검증(표끼리, 표↔walkthrough, mAP=AP 평균 포함), 도로 스트립, 영상 칸·표 탭, 제목 효과 테스트를 실제 종료 코드로 돌림
- 결과를 `| tail` 같은 파이프로 넘기지 말 것. 실패가 가려짐
- CSS/JS를 고치면 `index.html`의 `?v=N`을 올릴 것 (Pages 캐시 10분)
