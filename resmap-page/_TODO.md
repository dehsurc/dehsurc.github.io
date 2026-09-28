# ReSMap 프로젝트 페이지 TODO

파일명이 `_`로 시작해서 Jekyll이 배포하지 않습니다. 레포에만 있고 사이트에는 안 올라갑니다.

## 1. 영상 (최우선)

지금 영상은 §4에만 있고, 그마저 파일이 하나도 없습니다(`assets/video/` 없음).
X·슬랙으로 들어온 방문자는 첫 화면만 보고 나가는 경우가 많아서, 결과 영상은 맨 위로 올려야 합니다.
다만 파일이 나오기 전에 섹션만 올리면 첫 화면에 빈 칸이 생기니, 영상이 준비된 뒤에 옮깁니다.

### 목표 배치

1. **Hero 비교 영상**: 제목·링크 바로 아래, walkthrough 위
   - 자리는 `index.html`의 `Hero figure slot` 주석에 준비돼 있음. 파일 넣고 주석 풀면 됨
   - 자동재생, 음소거, 반복 (`autoplay muted loop playsinline`)
2. **Walkthrough**: 그 다음. 영상으로 "이렇게 된다"를 보여준 뒤 수치로 뒷받침하는 순서
3. **§4 장면 선택기**: 상세 비교용으로 그대로 뒤에 둠

### Hero 영상 내용

- [ ] 모델: **ReSMap, SatforHDMap, MapTracker, GT** (가능하면 SDTagNet 포함)
- [ ] **SatforHDMap은 꼭 넣을 것.** 같은 위성 입력인데 clean 27.0에서 all-drop 14.3으로 떨어집니다.
      이 모델이 옆에 있어야 성능 차이가 위성 입력이 아니라 방법론에서 나온다는 게 보입니다
- [ ] 클립 중간부터 카메라를 0으로 만들어서 전후 대비가 보이게 (§4 캡션과 같은 설정)
- [ ] 길이 10–15초 안쪽, fps 5 (fps 10은 너무 짧다는 피드백 있었음)

### 파일 규격

| 용도 | 경로 | 비고 |
|---|---|---|
| Hero 영상 | `assets/video/teaser.mp4` | H.264, `yuv420p`, `+faststart`, 무음 |
| Hero 포스터 | `assets/video/teaser.jpg` | 첫 프레임, 로딩 전 표시 |
| §4 장면 | `assets/video/<scene>.mp4` | picker 버튼의 `data-scene` 값과 파일명이 같아야 함 |
| §4 포스터 | `assets/video/<scene>.jpg` | |

웹용 인코딩 예시:

```sh
ffmpeg -i in.mp4 -c:v libx264 -pix_fmt yuv420p -crf 23 -preset slow \
       -movflags +faststart -an assets/video/teaser.mp4
ffmpeg -i assets/video/teaser.mp4 -frames:v 1 -q:v 3 assets/video/teaser.jpg
```

### §4 장면 선택기 정리

- [ ] **picker 버튼과 실제 장면이 안 맞음.** 지금 버튼은 `scene-0369 / scene-0100 / scene-0796`인데,
      렌더링해 본 장면은 scene-0369, scene-0739(boston), onenorth `4efbf4c0`·`54cdaaae`, boston `373bf99c`.
      실제 파일에 맞춰 버튼을 고칠 것
- [ ] 캡션 "Left to right: MapTracker, SatforHDMap, ReSMap, ground truth"가 실제 영상의 열 순서와 맞는지 확인
- [ ] 새 장면은 **onenorth / boston만** 가능 (100×50 위성 타일을 재생성한 도시가 이 둘뿐)

### 제작 파이프라인 / 막힌 부분

- 스크립트: `min_ws/make_teaser_video.py` (resmap conda env). 지금 버전은 **ReSMap 단독**
  (GT + ReSMap × 60×30 clean / Front-3 drop / 100×50)이라 모델 비교 영상이 아님. 비교 열 추가 필요
- 예전 출력 `min_ws/teaser_vis/`는 현재 없음. 다시 돌려야 함
- **MapTracker**: 체크포인트/예측 json이 OneDrive에만 있음. `rclone config reconnect onedrive:`로
  토큰 재연결해야 받을 수 있음
- **SDTagNet**: 예측 json이 없어서 `tools/test.py --format-only`로 재추론해야 함
- 세부 위치(체크포인트, submission json, 위성 타일 재생성 과정)는 Claude 메모리 `scene0369-video-assets`에 정리돼 있음

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

- 숫자 교차검증(표 ↔ walkthrough ↔ 본문)과 도로 스트립 동작 테스트를 실제 종료 코드로 돌림
- 결과를 `| tail` 같은 파이프로 넘기지 말 것. 실패가 가려짐
- CSS/JS를 고치면 `index.html`의 `?v=N`을 올릴 것 (Pages 캐시 10분)
