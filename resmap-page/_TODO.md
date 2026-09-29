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

## 3. 논문 쪽 확인

- [ ] non-temporal original-split clean mAP가 Tab. 6에서는 **82.8**, Tab. 7에서는 **82.9**. 카메라 레디 전에 통일할 것
      (페이지에는 이 수치가 없음)

## 4. 배포 전 체크

```sh
sh tools/check.sh && git push
```

- 숫자 교차검증, 도로 스트립, 영상 칸, 제목 효과 테스트를 실제 종료 코드로 돌림
- 결과를 `| tail` 같은 파이프로 넘기지 말 것. 실패가 가려짐
- CSS/JS를 고치면 `index.html`의 `?v=N`을 올릴 것 (Pages 캐시 10분)
