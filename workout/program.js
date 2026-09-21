/* =========================================================================
   매일 맨몸운동 — 프로그램 데이터
   목표: 근육량 ↑, 골반전방경사 교정, 어깨/등 프레임 확장, 유연성 회복.
   장비 없이 집에서, 하루 30~60분.
   ========================================================================= */

/* 목표 태그 ------------------------------------------------------------- */
const GOALS = {
  apt:   { label: '골반교정', color: '#B4432F', desc: '골반전방경사: 엉덩이·햄스트링·복근을 깨우고 고관절 앞쪽을 늘립니다.' },
  frame: { label: '프레임',   color: '#1F4E9C', desc: '어깨·등·가슴을 키워 상체를 넓히고 옷태를 만듭니다.' },
  mass:  { label: '근육량',   color: '#0F766E', desc: '점진적 과부하로 근육량을 늘립니다.' },
  flex:  { label: '유연성',   color: '#8A5A00', desc: '햄스트링·고관절·흉추·어깨 가동범위를 넓힙니다.' },
  core:  { label: '코어',     color: '#5B3FA6', desc: '골반을 중립으로 잡아주는 몸통 근육을 만듭니다.' },
};

/* 장비 ------------------------------------------------------------------ */
const EQUIP = {
  chair:  { label: '의자',           hint: '딥스·박스 스쿼트·발 올리기용. 거의 모든 집에 있음.' },
  table:  { label: '튼튼한 책상/식탁', hint: '테이블 로우(등 운동)용. 몸무게를 걸어도 흔들리지 않아야 함.' },
  bottle: { label: '물병·가방 (1~4kg)', hint: '2L 물병 두 개면 충분. 어깨 옆쪽(측면삼각근) 운동에 씀.' },
  bar:    { label: '문틀 철봉',       hint: '선택. 있으면 등이 훨씬 빨리 넓어짐. 2~3만원.' },
  band:   { label: '저항 밴드',       hint: '선택. 풀어파트·페이스풀 등 등 상부 운동에 좋음.' },
  towel:  { label: '수건',           hint: '문 손잡이 로우, 슬라이더 햄스트링 컬에 씀.' },
};

/* 운동 사전 ------------------------------------------------------------- */
/* type: reps | reps_side | hold | hold_side
   target: [min, max] (reps) | seconds (hold)
   goals: 태그 | equip: 필요한 장비 | yt: 유튜브 검색어                    */
const EX = {

  /* ---- 워밍업 -------------------------------------------------------- */
  breath90: {
    name: '90/90 호흡', en: '90/90 breathing', type: 'reps', target: [6, 8], unit: '호흡',
    goals: ['apt', 'core'],
    cue: ['등을 바닥에 대고 눕고, 종아리를 의자나 소파 위에 올려 무릎·고관절을 90도로.',
          '코로 4초 들이마시고 입으로 6초 길게 내쉬며 갈비뼈를 아래로 내립니다.',
          '내쉴 때 허리가 바닥에 붙는 느낌(골반 후방경사)을 찾는 게 핵심.'],
    why: '골반전방경사의 첫 단추. 갈비뼈가 들리고 허리가 뜨는 습관을 호흡으로 리셋합니다.',
    yt: '90/90 breathing 골반전방경사',
  },
  catcow: {
    name: '캣카우', en: 'Cat-cow', type: 'reps', target: [10, 12],
    goals: ['flex'],
    cue: ['네발기기 자세. 손은 어깨 아래, 무릎은 골반 아래.',
          '숨 내쉬며 등을 최대한 둥글게(고양이), 들이마시며 배를 내리고 가슴을 엽니다(소).',
          '골반이 앞뒤로 구르는 걸 느끼며 천천히.'],
    why: '척추 전체를 깨우고 골반이 움직이는 감각을 익힙니다.',
    yt: '캣카우 스트레칭',
  },
  bridge_act: {
    name: '글루트 브릿지 (활성화)', en: 'Glute bridge', type: 'reps', target: [15, 15],
    goals: ['apt'],
    cue: ['무릎 세우고 누워 발은 엉덩이 가까이.',
          '허리로 들지 말고 엉덩이를 꽉 조여서 골반을 들어올립니다. 위에서 2초 정지.',
          '허리가 아프면 골반을 먼저 뒤로 말고(허리 바닥에 붙이기) 시작.'],
    why: '잠들어 있는 엉덩이 근육을 깨워야 이후 다리 운동이 허리로 안 갑니다.',
    yt: '글루트 브릿지 자세',
  },
  deadbug_w: {
    name: '데드버그 (워밍업)', en: 'Dead bug', type: 'reps_side', target: [8, 8],
    goals: ['apt', 'core'],
    cue: ['누워서 팔은 천장, 무릎은 90도로 들어 올립니다.',
          '허리를 바닥에 꾹 붙인 채 반대쪽 팔과 다리를 천천히 뻗습니다.',
          '허리가 뜨는 순간이 실패 지점. 뜨지 않는 범위까지만.'],
    why: '골반 중립을 유지한 채 팔다리를 움직이는 법을 배우는 최고의 운동.',
    yt: '데드버그 운동',
  },
  wgs: {
    name: '월드 그레이티스트 스트레치', en: "World's greatest stretch", type: 'reps_side', target: [5, 5],
    goals: ['flex', 'apt'],
    cue: ['런지 자세로 앞발 옆에 양손을 짚습니다.',
          '앞발 쪽 팔꿈치를 바닥으로 내렸다가, 그 팔을 천장으로 돌려 흉추를 엽니다.',
          '뒷다리 고관절 앞쪽이 늘어나는 걸 느끼며.'],
    why: '고관절·흉추·햄스트링을 한 번에 여는 전신 워밍업.',
    yt: "world's greatest stretch",
  },
  armcircle: {
    name: '암 서클 + 어깨 CARs', en: 'Arm circles', type: 'reps', target: [10, 10],
    goals: ['flex'],
    cue: ['팔을 크게 앞으로 10회, 뒤로 10회 돌립니다.',
          '한 팔씩, 몸통을 고정한 채 어깨로만 그릴 수 있는 가장 큰 원을 천천히 그립니다.'],
    why: '어깨 관절을 데우고 가동범위를 매일 확인합니다.',
    yt: 'shoulder CARs',
  },
  hipcars: {
    name: '고관절 CARs', en: 'Hip CARs', type: 'reps_side', target: [5, 5],
    goals: ['flex', 'apt'],
    cue: ['네발기기 또는 서서 벽을 짚고, 한쪽 무릎을 들어 옆으로, 뒤로 크게 원을 그립니다.',
          '허리를 비틀지 말고 고관절만 움직입니다. 느릴수록 좋음.'],
    why: '굳은 고관절의 가동범위를 매일 조금씩 넓힙니다.',
    yt: 'hip CARs',
  },

  /* ---- 푸시 (가슴·어깨·삼두) -------------------------------------------- */
  wall_pushup: {
    name: '벽 푸시업', en: 'Wall push-up', type: 'reps', target: [12, 20],
    goals: ['mass', 'frame'],
    cue: ['벽에서 한 걸음 떨어져 손을 어깨 높이에.', '몸을 일자로 유지하며 가슴을 벽에 가깝게.',
          '엉덩이가 뒤로 빠지지 않게 배와 엉덩이에 힘.'],
    why: '푸시업의 시작. 몸을 일자로 유지하는 감각을 익힙니다.', yt: '벽 푸시업',
  },
  incline_pushup: {
    name: '인클라인 푸시업 (책상)', en: 'Incline push-up', type: 'reps', target: [10, 15], equip: ['table'],
    goals: ['mass', 'frame'],
    cue: ['책상이나 식탁 모서리를 잡고 몸을 일자로.', '팔꿈치는 몸통에서 45도, 가슴이 모서리에 닿을 때까지.',
          '내려갈 때 2초, 올라올 때 1초.'],
    why: '각도를 낮출수록 어려워집니다. 낮은 의자 → 바닥으로 진행.', yt: '인클라인 푸시업',
  },
  knee_pushup: {
    name: '무릎 푸시업', en: 'Knee push-up', type: 'reps', target: [10, 15],
    goals: ['mass', 'frame'],
    cue: ['무릎을 바닥에 대고 무릎부터 머리까지 일자.', '가슴이 바닥에 거의 닿을 때까지 내려갑니다.',
          '엉덩이를 뒤로 빼면 안 됨. 배꼽을 등쪽으로 당기고.'],
    why: '풀 푸시업 전 단계. 가동범위를 끝까지 쓰는 습관을.', yt: '무릎 푸시업',
  },
  pushup: {
    name: '푸시업', en: 'Push-up', type: 'reps', target: [8, 15],
    goals: ['mass', 'frame'],
    cue: ['손은 어깨보다 조금 넓게, 손가락은 살짝 바깥.', '엉덩이 조이고 허리 뜨지 않게. 골반전방경사 있으면 특히 골반을 뒤로 말고 시작.',
          '가슴이 주먹 하나 높이까지 내려갔다 올라옵니다.'],
    why: '가슴·앞어깨·삼두를 한 번에. 골반 중립 유지 자체가 코어 운동.', yt: '푸시업 정확한 자세',
  },
  decline_pushup: {
    name: '디클라인 푸시업 (발 올리기)', en: 'Decline push-up', type: 'reps', target: [8, 15], equip: ['chair'],
    goals: ['mass', 'frame'],
    cue: ['발을 의자나 소파에 올리고 손은 바닥.', '상부 가슴과 어깨에 자극이 갑니다.',
          '허리가 꺾이기 쉬우니 엉덩이를 꽉 조인 채.'],
    why: '윗가슴을 키우면 쇄골 라인이 살아나 옷태가 달라집니다.', yt: '디클라인 푸시업',
  },
  diamond_pushup: {
    name: '다이아몬드 푸시업', en: 'Diamond push-up', type: 'reps', target: [8, 12],
    goals: ['mass'],
    cue: ['양 엄지와 검지를 붙여 다이아몬드 모양.', '팔꿈치를 몸통에 붙인 채 가슴을 손 위로.',
          '삼두에 집중.'],
    why: '팔 뒤쪽(삼두)이 팔 굵기의 2/3를 만듭니다.', yt: '다이아몬드 푸시업',
  },
  archer_pushup: {
    name: '아처 푸시업', en: 'Archer push-up', type: 'reps_side', target: [5, 10],
    goals: ['mass', 'frame'],
    cue: ['손을 아주 넓게 벌리고 한쪽 팔로 내려가며 반대 팔은 옆으로 쭉 뻗습니다.',
          '한 팔 푸시업으로 가는 길.'],
    why: '한 팔에 체중 대부분을 싣는 고강도 진행 단계.', yt: 'archer push up',
  },

  pike_hold: {
    name: '파이크 홀드', en: 'Pike hold', type: 'hold', target: 30,
    goals: ['frame', 'flex'],
    cue: ['엉덩이를 높이 든 역V자(다운독) 자세.', '팔로 바닥을 밀어 귀와 어깨를 멀리, 등은 일자로.',
          '햄스트링이 당기면 무릎을 살짝 굽혀도 됩니다.'],
    why: '어깨로 체중을 지탱하는 감각 + 햄스트링 스트레칭.', yt: 'pike hold',
  },
  pike_pushup: {
    name: '파이크 푸시업', en: 'Pike push-up', type: 'reps', target: [6, 12],
    goals: ['frame', 'mass'],
    cue: ['역V자 자세에서 정수리가 손 앞쪽 바닥을 향하도록 팔꿈치를 굽힙니다.',
          '엉덩이를 최대한 높게 유지할수록 어깨에 실립니다.',
          '팔꿈치는 45도 정도로 벌리고, 머리가 바닥에 닿기 직전까지.'],
    why: '맨몸 오버헤드 프레스. 어깨를 앞·옆으로 키워 프레임을 넓히는 핵심 운동.', yt: '파이크 푸시업',
  },
  pike_pushup_elev: {
    name: '발 올린 파이크 푸시업', en: 'Elevated pike push-up', type: 'reps', target: [6, 12], equip: ['chair'],
    goals: ['frame', 'mass'],
    cue: ['발을 의자에 올리고 몸을 최대한 수직에 가깝게.', '정수리를 바닥에 찍고 올라옵니다.'],
    why: '체중이 더 실려 물구나무 푸시업에 근접합니다.', yt: 'elevated pike push up',
  },
  wall_hs_hold: {
    name: '벽 물구나무 홀드', en: 'Wall handstand hold', type: 'hold', target: 30,
    goals: ['frame', 'core'],
    cue: ['가슴이 벽을 향하게(chest-to-wall) 발로 벽을 타고 올라갑니다.',
          '갈비뼈를 넣고 엉덩이 조이고, 손바닥으로 바닥을 밀어 어깨를 귀에서 멀리.',
          '무서우면 처음엔 배가 벽을 보게 발차기로.'],
    why: '어깨 안정성과 삼각근 전체 자극. 코어까지 한 번에.', yt: '벽 물구나무 서기',
  },
  wall_hspu: {
    name: '벽 물구나무 푸시업 (부분)', en: 'Wall HSPU', type: 'reps', target: [3, 8],
    goals: ['frame', 'mass'],
    cue: ['벽 물구나무에서 머리가 바닥에 닿기 전까지만 내려갔다 올라옵니다.',
          '베개나 책을 놓고 가동범위를 조절.'],
    why: '맨몸 어깨 운동의 최종 단계.', yt: 'wall handstand push up progression',
  },

  chair_dip_bent: {
    name: '의자 딥스 (무릎 굽힘)', en: 'Bench dip', type: 'reps', target: [10, 15], equip: ['chair'],
    goals: ['mass'],
    cue: ['의자 끝에 손을 짚고 엉덩이를 앞으로 빼서 무릎 굽힌 채 지지.',
          '팔꿈치가 90도 될 때까지만 내려갑니다. 어깨가 아프면 얕게.',
          '어깨를 귀에서 멀리, 가슴을 편 채.'],
    why: '삼두 고립. 팔 굵기와 푸시업 힘을 같이 올립니다.', yt: '의자 딥스',
  },
  chair_dip_straight: {
    name: '의자 딥스 (다리 펴기)', en: 'Bench dip straight', type: 'reps', target: [10, 15], equip: ['chair'],
    goals: ['mass'],
    cue: ['다리를 쭉 펴고 뒤꿈치만 바닥.', '팔꿈치 90도까지. 어깨가 앞으로 말리지 않게.'],
    why: '체중이 더 실려 삼두 부하가 커집니다.', yt: 'bench dips straight legs',
  },
  chair_dip_elev: {
    name: '발 올린 의자 딥스', en: 'Feet-elevated dip', type: 'reps', target: [8, 12], equip: ['chair'],
    goals: ['mass'],
    cue: ['발을 다른 의자나 소파에 올리고 딥스.', '내려갈 때 3초.'],
    why: '거의 전 체중이 팔에 실립니다.', yt: 'feet elevated bench dips',
  },
  tri_incline: {
    name: '클로즈그립 인클라인 푸시업', en: 'Close-grip incline push-up', type: 'reps', target: [10, 15], equip: ['table'],
    goals: ['mass'],
    cue: ['책상 모서리를 잡되 손을 어깨너비보다 좁게.', '팔꿈치를 몸에 붙이고 내려갑니다.'],
    why: '의자 없이 삼두를 노리는 대체 운동.', yt: 'close grip incline push up',
  },

  lat_raise_bottle: {
    name: '물병 레터럴 레이즈', en: 'Lateral raise', type: 'reps', target: [12, 20], equip: ['bottle'],
    goals: ['frame'],
    cue: ['양손에 물병(또는 가방)을 들고 팔꿈치를 살짝 굽힌 채 옆으로 어깨 높이까지.',
          '새끼손가락이 엄지보다 살짝 높게. 승모근이 들리면 무게를 줄이기.',
          '내릴 때 3초. 마지막 5회는 위에서 1초 정지.'],
    why: '어깨 옆쪽(측면삼각근)은 맨몸으로 치기 어려운 부위인데, 프레임을 넓히는 데 가장 중요합니다.', yt: '레터럴 레이즈 자세',
  },
  prone_t: {
    name: '엎드려 T 레이즈', en: 'Prone T raise', type: 'reps', target: [12, 15],
    goals: ['frame'],
    cue: ['엎드려 팔을 양옆으로 T자. 엄지를 천장 쪽으로.',
          '견갑골을 모으며 팔을 바닥에서 최대한 들어 2초 정지.'],
    why: '후면·측면 삼각근과 등 상부. 어깨를 뒤로 열어 넓어 보이게.', yt: 'prone T raise',
  },

  /* ---- 풀 (등·후면어깨·이두) --------------------------------------------- */
  door_row: {
    name: '문 손잡이 로우', en: 'Door handle row', type: 'reps', target: [12, 15],
    goals: ['frame', 'mass'],
    cue: ['문을 반쯤 열고 문 옆면을 마주 본 채, 양쪽 손잡이를 한 손씩 잡습니다. 발은 문 아래 양옆에.',
          '몸을 뒤로 기울여 팔을 편 뒤, 팔꿈치를 뒤로 당겨 가슴을 손잡이 쪽으로. 견갑골을 먼저 모으기.',
          '발을 문에 가까이 둘수록(몸이 눕는 각도) 어렵습니다. 문이 튼튼한지 먼저 확인.'],
    why: '장비 없이 등을 당기는 가장 쉬운 방법. 수건이 있으면 손잡이에 수건을 걸어도 됩니다.', yt: 'door row bodyweight',
  },
  door_row_under: {
    name: '문 손잡이 언더핸드 로우', en: 'Underhand door row', type: 'reps', target: [10, 15],
    goals: ['mass'],
    cue: ['문 손잡이 로우와 같은 자세에서 손바닥이 위(나를 향하게)를 보도록 잡습니다.',
          '팔꿈치를 옆구리에 붙인 채 당기고, 내려갈 때 3초.'],
    why: '이두를 노리는 로우. 장비가 하나도 없을 때의 팔 운동.', yt: 'underhand door row',
  },
  table_row_bent: {
    name: '테이블 로우 (무릎 굽힘)', en: 'Table row', type: 'reps', target: [8, 12], equip: ['table'],
    goals: ['frame', 'mass'],
    cue: ['식탁 아래 누워 모서리를 잡고 무릎을 굽혀 발바닥을 바닥에.',
          '몸을 일자로 유지하며 가슴을 모서리까지 당깁니다.',
          '견갑골을 먼저 모으고 그 다음 팔꿈치. 내려갈 때 2초.'],
    why: '풀업의 형제. 광배근과 등 상부를 두껍게 만들어 뒤태와 프레임을 만듭니다.', yt: '테이블 로우',
  },
  table_row_straight: {
    name: '테이블 로우 (다리 펴기)', en: 'Table row straight', type: 'reps', target: [8, 12], equip: ['table'],
    goals: ['frame', 'mass'],
    cue: ['다리를 쭉 펴고 뒤꿈치만 바닥.', '몸 전체가 판자처럼. 엉덩이 처지면 안 됨.'],
    why: '체중 부하가 늘어 등 두께가 붙습니다.', yt: 'inverted row',
  },
  table_row_elev: {
    name: '발 올린 테이블 로우', en: 'Feet-elevated row', type: 'reps', target: [6, 12], equip: ['table', 'chair'],
    goals: ['frame', 'mass'],
    cue: ['발을 의자에 올려 몸을 수평보다 높게.', '위에서 1초 정지.'],
    why: '풀업에 가까운 강도.', yt: 'feet elevated inverted row',
  },
  table_row_onearm: {
    name: '한 팔 테이블 로우', en: 'One-arm row', type: 'reps_side', target: [5, 10], equip: ['table'],
    goals: ['frame', 'mass'],
    cue: ['한 손으로만 잡고 반대 손은 가슴에.', '몸이 회전하지 않게 코어로 버팁니다.'],
    why: '한쪽 등에 집중 부하. 좌우 균형까지.', yt: 'one arm inverted row',
  },
  dead_hang: {
    name: '데드 행', en: 'Dead hang', type: 'hold', target: 30, equip: ['bar'],
    goals: ['flex', 'frame'],
    cue: ['철봉에 매달려 어깨를 귀에서 살짝 멀리(액티브 행) 유지.', '악력이 빠지면 끝.'],
    why: '풀업 전 단계. 어깨·광배근 스트레칭에도 최고.', yt: '데드행',
  },
  neg_pullup: {
    name: '네거티브 풀업', en: 'Negative pull-up', type: 'reps', target: [4, 8], equip: ['bar'],
    goals: ['frame', 'mass'],
    cue: ['의자를 딛고 올라가 턱을 봉 위에 두고, 5초에 걸쳐 천천히 내려옵니다.',
          '팔이 다 펴질 때까지 버티고, 다시 의자를 딛고 올라가 반복.'],
    why: '내려가는 동작만으로 풀업 근력이 만들어집니다.', yt: '네거티브 풀업',
  },
  pullup: {
    name: '풀업', en: 'Pull-up', type: 'reps', target: [4, 10], equip: ['bar'],
    goals: ['frame', 'mass'],
    cue: ['어깨너비보다 조금 넓게 잡고 견갑골을 먼저 내린 뒤 당깁니다.',
          '가슴을 봉 쪽으로. 반동 금지. 내려갈 때 2초.',
          '개수가 안 나오면 세트 사이에 네거티브를 섞기.'],
    why: '등 넓이의 왕. 프레임을 넓히는 가장 빠른 운동.', yt: '풀업 자세',
  },
  pullup_weighted: {
    name: '풀업 (템포/가방 추가)', en: 'Weighted pull-up', type: 'reps', target: [5, 8], equip: ['bar'],
    goals: ['frame', 'mass'],
    cue: ['가방에 책이나 물병을 넣어 메고 풀업.', '또는 내려갈 때 4초 템포.'],
    why: '풀업 10개 이상이면 부하를 늘려야 계속 큽니다.', yt: 'weighted pull up',
  },
  chinup: {
    name: '친업', en: 'Chin-up', type: 'reps', target: [4, 10], equip: ['bar'],
    goals: ['mass'],
    cue: ['손바닥이 나를 보게 잡고 당깁니다.', '이두에 더 실립니다.'],
    why: '이두 + 광배. 팔 앞쪽 두께.', yt: '친업',
  },
  bottle_curl: {
    name: '물병 컬', en: 'Bottle curl', type: 'reps', target: [12, 20], equip: ['bottle'],
    goals: ['mass'],
    cue: ['가방이나 물병을 들고 팔꿈치를 옆구리에 고정한 채 컬.', '내릴 때 3초. 마지막 반복은 절반만 올렸다 내리기 5회 추가.'],
    why: '이두는 가볍더라도 느리게 하면 충분히 자극됩니다.', yt: '물병 컬',
  },
  towel_curl: {
    name: '수건 아이소 컬', en: 'Towel iso curl', type: 'hold_side', target: 20, equip: ['towel'],
    goals: ['mass'],
    cue: ['수건 한쪽 끝을 발로 밟고 반대 끝을 잡아 팔꿈치 90도에서 발로 저항하며 버팁니다.',
          '발로 누르는 힘을 조절해 20초 버티기.'],
    why: '장비 없이 이두를 고립하는 방법.', yt: 'towel bicep curl isometric',
  },
  underhand_row: {
    name: '언더핸드 테이블 로우', en: 'Underhand row', type: 'reps', target: [8, 12], equip: ['table'],
    goals: ['mass', 'frame'],
    cue: ['손바닥이 나를 보게 모서리를 잡고 로우.', '이두와 광배 하부.'],
    why: '이두 + 등.', yt: 'underhand inverted row',
  },

  ytw: {
    name: '엎드려 Y-T-W', en: 'Prone Y-T-W', type: 'reps', target: [8, 10], unit: '세트(각 자세)',
    goals: ['frame', 'apt'],
    cue: ['엎드려 팔을 Y자로 뻗고 엄지를 천장으로 들어 2초 → T자 → W자(팔꿈치 굽혀 뒤로 당기기).',
          '각 자세에서 견갑골을 아래·안쪽으로 모읍니다. 목은 길게, 이마는 바닥을 봄.',
          'Y·T·W 한 바퀴가 1회.'],
    why: '하부 승모근·능형근·후면삼각근. 말린 어깨를 펴서 넓어 보이게 하고, 라운드숄더를 고칩니다.', yt: 'prone YTW',
  },
  superman: {
    name: '슈퍼맨 홀드', en: 'Superman hold', type: 'hold', target: 20,
    goals: ['apt', 'core'],
    cue: ['엎드려 팔다리를 동시에 들어 버팁니다.', '허리를 과하게 꺾지 말고 엉덩이를 조여서 다리를 듭니다.',
          '목은 중립(바닥을 봄).'],
    why: '등 전체와 엉덩이. 골반전방경사엔 엉덩이로 드는 게 포인트.', yt: '슈퍼맨 홀드',
  },
  swimmer: {
    name: '프론 스위머', en: 'Prone swimmer', type: 'reps', target: [8, 10],
    goals: ['frame', 'flex'],
    cue: ['엎드려 팔을 앞으로 뻗고 들어올린 채, 팔을 옆으로 크게 돌려 엉덩이 옆까지 보냈다가 다시 앞으로.',
          '팔이 바닥에 닿지 않게.'],
    why: '어깨 가동범위 전체를 근력으로 통과. 후면 어깨 두께.', yt: 'prone swimmers exercise',
  },
  wall_angel: {
    name: '벽 천사', en: 'Wall angel', type: 'reps', target: [10, 12],
    goals: ['flex', 'frame', 'apt'],
    cue: ['벽에 뒤통수·등·엉덩이를 붙이고 허리와 벽 사이 공간을 최소로(골반 뒤로 말기).',
          '팔을 W자로 벽에 붙이고 위로 Y자까지 밀어 올렸다 내립니다.',
          '손목·팔꿈치가 벽에서 떨어지지 않는 범위까지만.'],
    why: '흉추 신전 + 어깨 가동 + 골반 중립을 동시에. 이거 하나가 자세 교정의 요약본.', yt: '벽 천사 운동',
  },
  band_pullapart: {
    name: '밴드 풀어파트', en: 'Band pull-apart', type: 'reps', target: [15, 20], equip: ['band'],
    goals: ['frame'],
    cue: ['밴드를 어깨 높이에서 양손으로 잡고 가슴 쪽으로 벌립니다.', '견갑골을 모으며 2초 정지.'],
    why: '후면 삼각근·능형근. 어깨를 뒤로 열어줍니다.', yt: '밴드 풀어파트',
  },

  /* ---- 하체 (스쿼트·힌지·엉덩이) ---------------------------------------- */
  box_squat: {
    name: '박스 스쿼트 (의자)', en: 'Box squat', type: 'reps', target: [10, 15], equip: ['chair'],
    goals: ['mass', 'apt'],
    cue: ['의자 앞에 서서 엉덩이를 뒤로 빼며 앉았다가 엉덩이가 닿으면 바로 일어납니다.',
          '무릎은 발끝 방향. 발 전체로 바닥을 밀기.',
          '허리를 과하게 세우지 말고 갈비뼈를 넣은 채.'],
    why: '스쿼트 깊이와 엉덩이 사용을 배우는 시작점.', yt: '박스 스쿼트',
  },
  air_squat: {
    name: '에어 스쿼트', en: 'Bodyweight squat', type: 'reps', target: [12, 20],
    goals: ['mass', 'apt', 'flex'],
    cue: ['발은 어깨너비, 발끝 살짝 바깥.', '허벅지가 바닥과 평행 이하까지. 뒤꿈치가 뜨면 발뒤꿈치에 책을 깔기.',
          '내려갈 때 3초 템포.'],
    why: '하체 전체. 깊이 내려갈수록 발목·고관절 유연성도 같이 늘어납니다.', yt: '스쿼트 자세',
  },
  tempo_squat: {
    name: '템포 스쿼트 (3-1-1)', en: 'Tempo squat', type: 'reps', target: [10, 15],
    goals: ['mass'],
    cue: ['3초 내려가고, 바닥에서 1초 정지, 1초에 올라옵니다.', '정지 시 무릎이 안으로 모이지 않게.'],
    why: '맨몸으로 부하를 올리는 가장 쉬운 방법은 느리게 하는 것.', yt: 'tempo squat',
  },
  split_squat: {
    name: '불가리안 스플릿 스쿼트', en: 'Bulgarian split squat', type: 'reps_side', target: [8, 12], equip: ['chair'],
    goals: ['mass', 'apt', 'flex'],
    cue: ['뒷발을 의자나 소파에 올리고 앞발은 한 걸음 반 앞.',
          '몸통을 살짝 앞으로 기울인 채 뒷무릎이 바닥 가까이 갈 때까지.',
          '뒷다리 고관절 앞쪽이 늘어나는 느낌 = 골반전방경사 교정 보너스.'],
    why: '한 다리 운동 중 최고. 엉덩이·허벅지 근육량 + 고관절 굴곡근 스트레칭.', yt: '불가리안 스플릿 스쿼트',
  },
  pistol_box: {
    name: '박스 피스톨 스쿼트', en: 'Box pistol squat', type: 'reps_side', target: [5, 8], equip: ['chair'],
    goals: ['mass'],
    cue: ['한 발로 서서 의자에 앉았다가 한 발로 일어납니다.', '반대 다리는 앞으로 뻗기. 손은 앞으로.'],
    why: '한 다리 스쿼트로 가는 단계.', yt: 'box pistol squat',
  },

  hip_hinge: {
    name: '힙 힌지 (벽 터치)', en: 'Wall hip hinge', type: 'reps', target: [12, 15],
    goals: ['apt', 'flex'],
    cue: ['벽을 등지고 한 발 앞에 서서, 무릎을 살짝만 굽힌 채 엉덩이를 뒤로 밀어 벽에 닿게.',
          '등은 일자. 햄스트링이 당기는 지점까지.', '닿으면 엉덩이를 조여 일어납니다.'],
    why: '허리 대신 엉덩이로 숙이는 법. 골반전방경사의 핵심 패턴.', yt: '힙 힌지 운동',
  },
  sl_rdl: {
    name: '싱글레그 RDL (맨몸)', en: 'Single-leg RDL', type: 'reps_side', target: [8, 12],
    goals: ['apt', 'mass', 'flex'],
    cue: ['한 발로 서서 반대 다리를 뒤로 뻗으며 상체를 앞으로 숙입니다. 몸이 T자.',
          '골반이 열리지 않게(뒷발 발끝이 바닥을 향하게).', '햄스트링이 늘어나면 엉덩이 조여 올라오기.'],
    why: '햄스트링·엉덩이 강화 + 균형. 골반전방경사엔 햄스트링이 강해야 합니다.', yt: '싱글레그 RDL',
  },
  slider_curl: {
    name: '슬라이더 햄스트링 컬', en: 'Slider hamstring curl', type: 'reps', target: [8, 12], equip: ['towel'],
    goals: ['apt', 'mass'],
    cue: ['맨바닥에 수건을 깔고 뒤꿈치를 올린 채 브릿지 자세.',
          '엉덩이를 든 채로 뒤꿈치를 멀리 밀었다가 당깁니다.', '엉덩이가 떨어지면 안 됨.'],
    why: '햄스트링 고립. 골반을 뒤로 당겨주는 근육.', yt: 'slider hamstring curl towel',
  },
  nordic_neg: {
    name: '노르딕 컬 (네거티브)', en: 'Nordic curl negative', type: 'reps', target: [4, 6],
    goals: ['mass', 'apt'],
    cue: ['무릎 꿇고 발을 소파 밑이나 침대 밑에 고정. 엉덩이 조여 몸을 일자로.',
          '햄스트링으로 버티며 최대한 천천히 앞으로 넘어집니다. 손으로 받기.',
          '무릎 아래 쿠션 필수.'],
    why: '맨몸 햄스트링 운동의 끝판왕.', yt: '노르딕 컬',
  },

  glute_bridge: {
    name: '글루트 브릿지', en: 'Glute bridge', type: 'reps', target: [15, 20],
    goals: ['apt', 'mass'],
    cue: ['위에서 2초 정지. 엉덩이를 꽉.', '허리가 아니라 엉덩이가 타는 느낌이어야 함.'],
    why: '골반전방경사 = 약한 엉덩이. 매일 엉덩이를 깨웁니다.', yt: '글루트 브릿지',
  },
  hip_thrust: {
    name: '힙 쓰러스트 (소파)', en: 'Hip thrust', type: 'reps', target: [12, 20], equip: ['chair'],
    goals: ['apt', 'mass'],
    cue: ['등 상부를 소파나 의자에 기대고 발은 무릎 아래.', '턱을 당기고 갈비뼈를 넣은 채 엉덩이를 밀어 올려 몸을 수평으로.',
          '위에서 엉덩이 2초 조이기. 허리를 꺾어 올리면 안 됨.'],
    why: '엉덩이 근육량의 왕. 가동범위가 브릿지보다 큽니다.', yt: '맨몸 힙쓰러스트',
  },
  sl_bridge: {
    name: '싱글레그 글루트 브릿지', en: 'Single-leg bridge', type: 'reps_side', target: [10, 15],
    goals: ['apt', 'mass'],
    cue: ['한 다리를 가슴 쪽으로 들고 반대 다리로만 골반을 들어올립니다.',
          '골반이 기울지 않게 수평 유지.'],
    why: '좌우 엉덩이 불균형까지 잡습니다.', yt: '싱글레그 글루트 브릿지',
  },
  sl_thrust: {
    name: '싱글레그 힙 쓰러스트', en: 'Single-leg hip thrust', type: 'reps_side', target: [8, 12], equip: ['chair'],
    goals: ['apt', 'mass'],
    cue: ['소파에 기댄 힙 쓰러스트를 한 다리로.', '위에서 2초.'],
    why: '맨몸으로 엉덩이에 줄 수 있는 최대 부하.', yt: 'single leg hip thrust',
  },

  rev_lunge: {
    name: '리버스 런지', en: 'Reverse lunge', type: 'reps_side', target: [10, 12],
    goals: ['mass', 'apt', 'flex'],
    cue: ['한 발을 뒤로 크게 빼며 뒷무릎을 바닥 가까이.', '앞발 뒤꿈치로 밀어 일어납니다.',
          '몸통은 살짝 앞으로, 뒷다리 고관절 앞쪽을 느끼며.'],
    why: '앞으로 나가는 런지보다 무릎에 편하고 엉덩이에 더 실립니다.', yt: '리버스 런지',
  },
  walking_lunge: {
    name: '워킹 런지', en: 'Walking lunge', type: 'reps_side', target: [10, 15],
    goals: ['mass'],
    cue: ['앞으로 걸어가며 런지. 무릎이 발끝을 크게 넘지 않게.'],
    why: '하체 전반 + 균형.', yt: '워킹 런지',
  },
  jump_lunge: {
    name: '점프 런지', en: 'Jump lunge', type: 'reps_side', target: [8, 12],
    goals: ['mass'],
    cue: ['런지 자세에서 점프해 다리를 바꿉니다. 착지는 조용하게.'],
    why: '파워와 심폐까지.', yt: '점프 런지',
  },
  calf_raise: {
    name: '카프 레이즈 (계단)', en: 'Calf raise', type: 'reps', target: [15, 25],
    goals: ['mass', 'flex'],
    cue: ['계단이나 책 위에 발 앞쪽만 올리고 뒤꿈치를 최대한 내렸다가 최대한 올립니다.',
          '아래에서 2초 스트레칭, 위에서 1초 정지.'],
    why: '종아리 + 발목 가동범위. 스쿼트 깊이에 직접 영향.', yt: '카프 레이즈',
  },
  sl_calf_raise: {
    name: '싱글레그 카프 레이즈', en: 'Single-leg calf raise', type: 'reps_side', target: [12, 20],
    goals: ['mass', 'flex'],
    cue: ['한 발로 카프 레이즈. 벽을 살짝 짚어 균형만.'],
    why: '부하 2배.', yt: 'single leg calf raise',
  },

  /* ---- 코어 (골반 중립 유지) ------------------------------------------- */
  deadbug: {
    name: '데드버그', en: 'Dead bug', type: 'reps_side', target: [8, 12],
    goals: ['apt', 'core'],
    cue: ['허리를 바닥에 붙인 채 반대 팔·다리를 뻗습니다.', '내쉬면서 뻗고, 들이마시며 돌아오기.'],
    why: '골반전방경사 교정 코어 운동 1순위.', yt: '데드버그',
  },
  hollow_hold: {
    name: '홀로우 홀드', en: 'Hollow hold', type: 'hold', target: 20,
    goals: ['apt', 'core'],
    cue: ['누워서 허리를 바닥에 붙이고 어깨와 다리를 살짝 띄웁니다.',
          '허리가 뜨면 무릎을 굽히거나 다리를 높이기.', '바나나 모양.'],
    why: '골반 후방경사를 힘으로 유지하는 훈련. 푸시업·물구나무의 기초.', yt: '홀로우 홀드',
  },
  rkc_plank: {
    name: 'RKC 플랭크', en: 'RKC plank', type: 'hold', target: 20,
    goals: ['apt', 'core'],
    cue: ['일반 플랭크에서 엉덩이를 꽉 조이고 골반을 뒤로 말아 팔꿈치를 발쪽으로 당기는 힘을 줍니다.',
          '온몸이 떨릴 정도로. 20초면 충분.'],
    why: '오래 버티는 플랭크보다 골반을 말고 세게 조이는 짧은 플랭크가 골반전방경사에 효과적.', yt: 'RKC plank',
  },
  hollow_rock: {
    name: '홀로우 락', en: 'Hollow rock', type: 'reps', target: [10, 15],
    goals: ['core'],
    cue: ['홀로우 자세 그대로 앞뒤로 흔듭니다.', '자세가 풀리면 정지.'],
    why: '홀로우를 동적으로.', yt: 'hollow rocks',
  },
  leg_raise: {
    name: '레그 레이즈 (골반 말기)', en: 'Leg raise', type: 'reps', target: [10, 15],
    goals: ['apt', 'core'],
    cue: ['누워 손을 엉덩이 옆에. 다리를 들어올리며 끝에서 골반을 바닥에서 살짝 말아 올립니다.',
          '내릴 때 허리가 뜨기 직전에서 멈추기.'],
    why: '하복부 + 골반 후방경사 동작.', yt: 'leg raise posterior pelvic tilt',
  },
  rev_crunch: {
    name: '리버스 크런치', en: 'Reverse crunch', type: 'reps', target: [12, 15],
    goals: ['apt', 'core'],
    cue: ['무릎을 굽힌 채 골반을 말아 올려 무릎을 가슴 쪽으로.', '내릴 때 천천히, 허리가 뜨지 않게.'],
    why: '골반을 뒤로 마는 동작 자체가 운동.', yt: '리버스 크런치',
  },
  side_plank_knee: {
    name: '무릎 사이드 플랭크', en: 'Knee side plank', type: 'hold_side', target: 20,
    goals: ['core'],
    cue: ['옆으로 누워 팔꿈치와 무릎으로 지지, 골반을 들어 몸을 일자로.'],
    why: '옆구리·엉덩이 옆쪽. 골반 좌우 안정.', yt: '무릎 사이드 플랭크',
  },
  side_plank: {
    name: '사이드 플랭크', en: 'Side plank', type: 'hold_side', target: 25,
    goals: ['core'],
    cue: ['팔꿈치와 발로 지지. 골반이 처지지 않게 위쪽 엉덩이를 조입니다.'],
    why: '복사근·중둔근. 허리 통증 예방의 핵심.', yt: '사이드 플랭크',
  },
  side_plank_dip: {
    name: '사이드 플랭크 힙 딥', en: 'Side plank hip dip', type: 'reps_side', target: [10, 15],
    goals: ['core'],
    cue: ['사이드 플랭크에서 골반을 바닥 가까이 내렸다 올립니다.'],
    why: '옆구리를 동적으로.', yt: 'side plank hip dips',
  },
  copenhagen: {
    name: '코펜하겐 플랭크', en: 'Copenhagen plank', type: 'hold_side', target: 15, equip: ['chair'],
    goals: ['core'],
    cue: ['위쪽 다리를 의자에 올리고 아래 다리는 공중. 팔꿈치로 지지.', '내전근이 강하게 잡힙니다.'],
    why: '내전근 + 옆구리. 고급 단계.', yt: 'copenhagen plank',
  },
  birddog: {
    name: '버드독', en: 'Bird dog', type: 'reps_side', target: [8, 10],
    goals: ['apt', 'core'],
    cue: ['네발기기에서 반대 팔·다리를 뻗어 2초 정지.', '허리가 꺾이지 않게 골반 수평. 다리는 골반 높이까지만.'],
    why: '허리 안정 + 엉덩이. 골반 중립 유지 연습.', yt: '버드독',
  },

  /* ---- 스트레칭 / 가동성 ------------------------------------------------ */
  couch: {
    name: '카우치 스트레치', en: 'Couch stretch', type: 'hold_side', target: 45,
    goals: ['apt', 'flex'],
    cue: ['벽이나 소파 앞에 무릎 꿇고 한쪽 정강이를 벽에 세워 발이 위로.',
          '반대 발은 앞에 두고, 엉덩이를 꽉 조이고 골반을 뒤로 말면 뒷다리 앞쪽이 강하게 늘어납니다.',
          '허리를 꺾어 버티면 효과 없음. 골반을 말고 상체를 세우는 만큼만.'],
    why: '골반전방경사 스트레칭의 1순위. 짧아진 대퇴직근·장요근을 늘립니다.', yt: '카우치 스트레치',
  },
  hf_kneel: {
    name: '무릎 꿇은 고관절 굴곡근 스트레치', en: 'Kneeling hip flexor stretch', type: 'hold_side', target: 40,
    goals: ['apt', 'flex'],
    cue: ['런지 자세로 뒷무릎을 바닥에.', '엉덩이를 조이고 골반을 뒤로 말면 앞쪽이 늘어납니다. 그 다음 같은 쪽 팔을 위로 뻗어 옆으로 살짝 기울이기.',
          '앞으로 밀지 말고 골반부터 말기.'],
    why: '장요근이 짧으면 골반이 앞으로 당겨집니다. 매일 풀어야 합니다.', yt: '고관절 굴곡근 스트레칭',
  },
  ham_stretch: {
    name: '햄스트링 스트레치 (수건)', en: 'Hamstring stretch', type: 'hold_side', target: 40, equip: ['towel'],
    goals: ['flex'],
    cue: ['누워서 한 발바닥에 수건을 걸고 다리를 편 채 천장 쪽으로 당깁니다.',
          '반대 다리는 바닥에 붙이기. 무릎을 살짝 굽혀도 됨.', '길게 내쉬며 조금씩 더.'],
    why: '누운 자세는 허리에 부담 없이 햄스트링만 늘립니다. 전굴 안 되는 사람의 시작점.', yt: '누워서 햄스트링 스트레칭',
  },
  fwd_fold: {
    name: '전굴 (무릎 굽혀도 됨)', en: 'Forward fold', type: 'hold', target: 40,
    goals: ['flex'],
    cue: ['서서 무릎을 살짝 굽히고 상체를 떨어뜨립니다. 손이 바닥에 안 닿으면 의자나 책을 잡기.',
          '허리를 둥글게 말지 말고 골반을 앞으로 기울여(엉덩이를 뒤로) 접기.',
          '매주 손 위치를 기록.'],
    why: '유연성 진행을 가장 쉽게 확인하는 동작.', yt: '전굴 스트레칭 방법',
  },
  pigeon: {
    name: '피죤 (비둘기) 자세', en: 'Pigeon pose', type: 'hold_side', target: 45,
    goals: ['flex', 'apt'],
    cue: ['한 다리를 앞에 접어 정강이를 몸 앞에 두고 뒷다리는 뒤로 쭉.',
          '골반이 기울면 앞쪽 엉덩이 밑에 쿠션.', '상체를 앞으로 숙이면 더 깊게.'],
    why: '엉덩이 바깥쪽(이상근·중둔근). 고관절이 굳은 사람은 여기가 제일 답답합니다.', yt: '피죤 자세',
  },
  ninety: {
    name: '90/90 힙 스트레치', en: '90/90 hip stretch', type: 'hold_side', target: 40,
    goals: ['flex', 'apt'],
    cue: ['앉아서 앞다리 무릎·고관절 90도, 뒷다리도 90도로 옆에.',
          '등을 펴고 앞다리 쪽으로 상체를 숙입니다.', '양쪽 엉덩이가 바닥에 붙어있게.'],
    why: '고관절 내회전·외회전 둘 다. 골반 위치 교정에 직접 연결.', yt: '90 90 힙 스트레칭',
  },
  adductor: {
    name: '내전근 스트레치 (프로그)', en: 'Frog stretch', type: 'hold', target: 45,
    goals: ['flex'],
    cue: ['네발기기에서 무릎을 최대한 벌리고 발끝은 바깥. 팔꿈치를 바닥에.',
          '엉덩이를 뒤로 천천히 밀었다 돌아오길 반복하다 마지막에 정지.'],
    why: '허벅지 안쪽. 딥 스쿼트와 다리 벌리기의 열쇠.', yt: '프로그 스트레칭',
  },
  deep_squat: {
    name: '딥 스쿼트 홀드', en: 'Deep squat hold', type: 'hold', target: 45,
    goals: ['flex', 'apt'],
    cue: ['발을 어깨너비보다 넓게, 끝까지 앉아 팔꿈치로 무릎을 밀어 벌립니다.',
          '뒤꿈치가 뜨면 뒤꿈치 아래 책. 넘어지면 문틀이나 책상다리를 잡기.', '등을 최대한 펴고 호흡.'],
    why: '발목·고관절·내전근·흉추를 한 번에 여는 자세. 목표: 이 자세로 2분 편하게 앉기.', yt: '딥 스쿼트 홀드',
  },
  ankle_wall: {
    name: '발목 무릎-벽 터치', en: 'Knee-to-wall ankle', type: 'reps_side', target: [10, 12],
    goals: ['flex'],
    cue: ['벽에서 한 뼘 떨어져 발을 놓고 뒤꿈치를 떼지 않은 채 무릎으로 벽을 터치.',
          '되면 발을 조금 더 뒤로. 벽에서 발끝까지 거리를 기록.'],
    why: '발목이 안 꺾이면 스쿼트가 안 내려가고 골반이 더 앞으로 기웁니다.', yt: 'knee to wall ankle mobility',
  },
  tspine_rot: {
    name: '흉추 회전 (오픈북)', en: 'Open book', type: 'reps_side', target: [8, 10],
    goals: ['flex'],
    cue: ['옆으로 누워 무릎을 90도로 굽히고 양손을 앞에 모읍니다.',
          '위쪽 팔을 책 펴듯 반대편으로 열며 시선이 손을 따라가게. 무릎은 바닥에 붙인 채.',
          '끝에서 2초, 숨 내쉬기.'],
    why: '흉추가 굳으면 허리가 대신 움직여 골반이 무너집니다. 상체 회전을 되찾기.', yt: '오픈북 스트레칭',
  },
  tspine_ext: {
    name: '흉추 신전 (의자)', en: 'Thoracic extension', type: 'hold', target: 30, equip: ['chair'],
    goals: ['flex', 'frame'],
    cue: ['의자 앞에 무릎 꿇고 팔꿈치를 의자에 올려 두 손을 목 뒤에.',
          '엉덩이를 뒤로 빼며 가슴을 바닥 쪽으로 내립니다. 허리가 아니라 등 위쪽이 늘어나야 함.',
          '갈비뼈를 넣고 겨드랑이가 늘어나는 느낌.'],
    why: '굽은 등을 펴면 어깨가 저절로 넓어 보입니다.', yt: '흉추 신전 스트레칭',
  },
  doorway: {
    name: '문틀 가슴 스트레치', en: 'Doorway pec stretch', type: 'hold', target: 40,
    goals: ['flex', 'frame'],
    cue: ['문틀에 양 팔꿈치를 어깨 높이(그리고 조금 높게)로 대고 한 발 앞으로 내딛어 가슴을 엽니다.',
          '허리를 꺾지 말고 갈비뼈를 넣은 채.'],
    why: '짧아진 가슴 근육이 어깨를 앞으로 말아 좁아 보이게 합니다.', yt: '문틀 가슴 스트레칭',
  },
  lat_stretch: {
    name: '광배근 스트레치 (책상 잡고)', en: 'Lat stretch', type: 'hold', target: 40, equip: ['table'],
    goals: ['flex', 'frame'],
    cue: ['책상 모서리를 잡고 뒤로 물러나 엉덩이를 뒤로 빼며 가슴을 바닥 쪽으로.',
          '겨드랑이가 늘어나야 함. 무릎을 살짝 굽히기.'],
    why: '광배근이 짧으면 팔이 머리 위로 안 올라가고 허리가 꺾입니다.', yt: '광배근 스트레칭',
  },
  child: {
    name: '차일드 포즈', en: "Child's pose", type: 'hold', target: 40,
    goals: ['flex'],
    cue: ['무릎 꿇고 앉아 팔을 앞으로 멀리 뻗으며 이마를 바닥에.', '길게 내쉬며 허리를 둥글게.'],
    why: '허리 긴장 풀기. 골반전방경사로 늘 긴장한 허리를 쉬게 합니다.', yt: '차일드 포즈',
  },
  downdog: {
    name: '다운독', en: 'Downward dog', type: 'hold', target: 40,
    goals: ['flex'],
    cue: ['역V자. 뒤꿈치를 바닥 쪽으로 누르고 등을 일자로.', '한 발씩 뒤꿈치를 번갈아 눌러 종아리 스트레칭.'],
    why: '햄스트링·종아리·어깨를 한 번에.', yt: '다운독',
  },
  neck_stretch: {
    name: '목·승모근 스트레치', en: 'Neck stretch', type: 'hold_side', target: 25,
    goals: ['flex'],
    cue: ['한 손으로 머리를 옆으로 부드럽게 당기고 반대 어깨를 아래로.', '힘 주지 말고 무게만.'],
    why: '거북목·긴장된 승모근을 풀어야 어깨가 내려가고 목이 길어 보입니다.', yt: '승모근 스트레칭',
  },
  cobra: {
    name: '코브라 (부드럽게)', en: 'Cobra', type: 'hold', target: 20,
    goals: ['flex'],
    cue: ['엎드려 팔꿈치를 굽힌 채 가슴만 살짝 들어 올립니다.',
          '골반전방경사가 있으면 허리를 과하게 꺾지 말고 엉덩이를 조인 채 짧게. 아프면 생략.'],
    why: '복근 앞쪽을 늘리는 정도로만. 허리를 젖히는 게 목적이 아님.', yt: '코브라 자세',
  },
  walk: {
    name: '가벼운 걷기 / 제자리 걷기', en: 'Easy walk', type: 'hold', target: 300,
    goals: ['flex'],
    cue: ['밖에서 5분 걷기나 제자리 걷기. 팔을 크게 흔들며.'],
    why: '회복일 심박수 올리기.', yt: '',
  },
};

/* 진행 체인 -------------------------------------------------------------- */
/* 각 체인은 레벨 배열. 현재 레벨의 운동을 오늘 루틴에 넣습니다. */
const CHAINS = {
  pushup:   { name: '푸시업',            levels: ['wall_pushup', 'incline_pushup', 'knee_pushup', 'pushup', 'decline_pushup', 'diamond_pushup', 'archer_pushup'], start: 2 },
  shoulder: { name: '어깨 프레스',        levels: ['pike_hold', 'pike_pushup', 'pike_pushup_elev', 'wall_hs_hold', 'wall_hspu'], start: 0 },
  dips:     { name: '삼두',               levels: ['chair_dip_bent', 'chair_dip_straight', 'chair_dip_elev'], start: 0, alt: 'tri_alt' },
  tri_alt:  { name: '삼두 (의자 없음)',   levels: ['tri_incline', 'diamond_pushup'], start: 0 },
  latraise: { name: '측면 삼각근',        levels: ['lat_raise_bottle'], start: 0, alt: 'prone_t_chain' },
  prone_t_chain: { name: '측면/후면 삼각근', levels: ['prone_t'], start: 0 },

  pull_bar:   { name: '풀업',             levels: ['dead_hang', 'neg_pullup', 'pullup', 'pullup_weighted'], start: 0 },
  pull_table: { name: '테이블 로우',      levels: ['table_row_bent', 'table_row_straight', 'table_row_elev', 'table_row_onearm'], start: 0 },
  pull_door:  { name: '문 손잡이 로우',   levels: ['door_row'], start: 0 },
  posture:    { name: '등 상부/자세',     levels: ['ytw', 'swimmer'], start: 0 },
  backext:    { name: '등 신전',          levels: ['superman'], start: 0 },
  biceps_bar:   { name: '이두 (철봉)',    levels: ['chinup'], start: 0 },
  biceps_table: { name: '이두 (테이블)',  levels: ['underhand_row'], start: 0 },
  biceps_bottle:{ name: '이두 (물병)',    levels: ['bottle_curl'], start: 0 },
  biceps_towel: { name: '이두 (수건)',    levels: ['towel_curl'], start: 0 },
  biceps_door:  { name: '이두 (문 손잡이)', levels: ['door_row_under'], start: 0 },

  squat:  { name: '스쿼트',              levels: ['box_squat', 'air_squat', 'tempo_squat', 'split_squat', 'pistol_box'], start: 1 },
  hinge:  { name: '힌지 (햄스트링)',      levels: ['hip_hinge', 'sl_rdl', 'slider_curl', 'nordic_neg'], start: 0 },
  glute:  { name: '엉덩이',              levels: ['glute_bridge', 'hip_thrust', 'sl_bridge', 'sl_thrust'], start: 0 },
  lunge:  { name: '런지',                levels: ['rev_lunge', 'walking_lunge', 'jump_lunge'], start: 0 },
  calf:   { name: '종아리',              levels: ['calf_raise', 'sl_calf_raise'], start: 0 },

  antiext:  { name: '코어 (앞)',          levels: ['deadbug', 'hollow_hold', 'rkc_plank', 'hollow_rock', 'leg_raise'], start: 0 },
  antilat:  { name: '코어 (옆)',          levels: ['side_plank_knee', 'side_plank', 'side_plank_dip', 'copenhagen'], start: 0 },
  lowerabs: { name: '하복부',            levels: ['rev_crunch', 'leg_raise'], start: 0 },
  birddog_c:{ name: '버드독',            levels: ['birddog'], start: 0 },
};

/* 요일별 루틴 ------------------------------------------------------------ */
/* slot: 체인 선택 규칙. pick()이 장비에 맞춰 체인을 고릅니다.             */
const WARMUP = ['breath90', 'catcow', 'bridge_act', 'deadbug_w', 'wgs', 'armcircle'];

const DAYS = {
  push: {
    key: 'push', name: '푸시', sub: '가슴 · 어깨 · 삼두 · 코어', color: '#1F4E9C',
    intro: '어깨와 윗가슴을 키우는 날. 프레임이 넓어지는 건 어깨 옆쪽과 등이 커질 때입니다.',
    main: [
      { slot: 'shoulder' }, { slot: 'pushup' }, { slot: 'latraise' }, { slot: 'dips' },
    ],
    core: [{ slot: 'antiext' }],
    cooldown: ['doorway', 'tspine_ext', 'couch', 'child'],
  },
  pull: {
    key: 'pull', name: '풀', sub: '등 · 후면어깨 · 이두 · 코어', color: '#0F766E',
    intro: '등을 넓히고 말린 어깨를 뒤로 여는 날. 옷태는 등에서 나옵니다.',
    main: [
      { slot: 'pull' }, { slot: 'posture' }, { slot: 'wall_angel_fixed' }, { slot: 'biceps' },
    ],
    core: [{ slot: 'antilat' }, { slot: 'backext' }],
    cooldown: ['lat_stretch', 'tspine_rot', 'hf_kneel', 'neck_stretch'],
  },
  legs: {
    key: 'legs', name: '하체', sub: '엉덩이 · 햄스트링 · 허벅지 · 골반', color: '#B4432F',
    intro: '골반전방경사를 고치는 날. 엉덩이와 햄스트링이 강해져야 골반이 제자리로 돌아옵니다.',
    main: [
      { slot: 'squat' }, { slot: 'hinge' }, { slot: 'glute' }, { slot: 'lunge' }, { slot: 'calf' },
    ],
    core: [{ slot: 'lowerabs' }],
    cooldown: ['couch', 'ham_stretch', 'pigeon', 'ninety', 'adductor'],
  },
  mobility: {
    key: 'mobility', name: '유연성', sub: '회복 · 긴 스트레칭 · 가동성', color: '#8A5A00',
    intro: '쉬는 날이 아니라 늘리는 날. 홀드를 길게 가져가며 호흡에 집중하세요. 통증은 안 되고 뻐근함은 됩니다.',
    main: [],
    core: [],
    flow: ['walk', 'catcow', 'hipcars', 'deep_squat', 'couch', 'hf_kneel', 'pigeon', 'ninety', 'adductor',
           'ham_stretch', 'fwd_fold', 'ankle_wall', 'tspine_rot', 'tspine_ext', 'doorway', 'wall_angel', 'downdog', 'child', 'neck_stretch'],
  },
};

/* 월~일. 0=일요일(JS getDay) */
const WEEK = ['mobility', 'push', 'pull', 'legs', 'push', 'pull', 'legs'];

/* 시간별 세트/휴식/홀드 배수 */
const DURATION = {
  30: { sets: 2, rest: 45, coolMult: 0.75, flowMult: 0.7, coreSets: 2, label: '30분 · 바쁜 날' },
  45: { sets: 3, rest: 60, coolMult: 1,    flowMult: 1,   coreSets: 2, label: '45분 · 기본' },
  60: { sets: 4, rest: 75, coolMult: 1.3,  flowMult: 1.4, coreSets: 3, label: '60분 · 여유' },
};

/* 장비에 따라 슬롯 → 체인 */
function pickChain(slot, eq) {
  switch (slot) {
    case 'pull':
      if (eq.bar) return 'pull_bar';
      if (eq.table) return 'pull_table';
      return 'pull_door';
    case 'biceps':
      if (eq.bar) return 'biceps_bar';
      if (eq.table) return 'biceps_table';
      if (eq.bottle) return 'biceps_bottle';
      if (eq.towel) return 'biceps_towel';
      return 'biceps_door';
    case 'dips':
      return eq.chair ? 'dips' : 'tri_alt';
    case 'latraise':
      return eq.bottle ? 'latraise' : 'prone_t_chain';
    case 'wall_angel_fixed':
      return null; // 고정 운동
    default:
      return slot;
  }
}

/* 체인 안에서 장비가 없어 못 하는 레벨을 건너뜁니다. */
function usable(exId, eq) {
  const ex = EX[exId];
  if (!ex.equip) return true;
  return ex.equip.every((e) => eq[e]);
}

/* 유연성 테스트 정의 ------------------------------------------------------ */
const TESTS = [
  { id: 'fold', name: '전굴', unit: 'cm', hint: '무릎 편 채 선 전굴. 손끝이 바닥에 닿기까지 남은 거리(cm). 닿으면 0, 그 이상 내려가면 음수(-).', lowerBetter: true },
  { id: 'ankle', name: '발목 (무릎-벽)', unit: 'cm', hint: '뒤꿈치 떼지 않고 무릎이 벽에 닿는 최대 발끝-벽 거리(cm). 10cm 이상이 목표.', lowerBetter: false },
  { id: 'squat', name: '딥 스쿼트 홀드', unit: '초', hint: '뒤꿈치 붙이고 끝까지 앉아 편하게 버틴 시간(초).', lowerBetter: false },
  { id: 'pushup', name: '푸시업 최대', unit: '회', hint: '현재 레벨 푸시업 한 세트 최대 개수.', lowerBetter: false },
  { id: 'wallangel', name: '벽 천사', unit: '점', hint: '0: 손목이 벽에서 많이 뜸 · 1: 손목만 뜸 · 2: 어깨 높이까지 붙음 · 3: 머리 위까지 다 붙음.', lowerBetter: false },
];

/* 프로그램 설명 ---------------------------------------------------------- */
const PRINCIPLES = [
  { h: '왜 이 순서인가', p: '주 6일 운동 + 1일 유연성. 푸시·풀·하체를 이틀 간격으로 반복해 각 부위를 주 2회 자극합니다. 근육량을 늘리려면 주 2회 이상, 세트당 마지막 2~3회가 힘든 강도가 필요합니다.' },
  { h: '골반전방경사', p: '원인은 대체로 짧은 고관절 굴곡근(장요근·대퇴직근) + 약한 엉덩이·햄스트링·복근. 그래서 매일 워밍업에 90/90 호흡·브릿지·데드버그가 들어가고, 하체 날은 힌지와 엉덩이 중심이며, 쿨다운마다 카우치 스트레치를 넣었습니다. 모든 운동에서 "엉덩이 조이고 갈비뼈 넣기"를 반복하세요.' },
  { h: '프레임 넓히기', p: '어깨는 옆쪽(측면삼각근)이 커져야 넓어지고, 등은 광배근이 커져야 V자가 나옵니다. 파이크 푸시업·레터럴 레이즈·로우(또는 풀업)가 그 역할입니다. 문틀 철봉 하나 사면 속도가 두 배가 됩니다.' },
  { h: '유연성', p: '유연성은 근력 운동 뒤 따뜻할 때 30~60초 홀드로 늡니다. 통증 직전의 뻐근함에서 길게 내쉬는 게 핵심. 2주마다 전굴·발목·딥스쿼트를 측정해 기록하세요. 수치가 변하면 계속됩니다.' },
  { h: '진행 (레벨업)', p: '목표 반복 상한을 모든 세트에서 2회 연속 달성하면 다음 단계를 제안합니다. 근육은 "지난번보다 조금 더"에서만 자랍니다. 개수가 안 나오면 템포를 느리게(내려갈 때 3초) 해도 같은 효과.' },
  { h: '먹는 것', p: '근육량이 적으면 단백질이 부족한 경우가 대부분입니다. 체중 1kg당 1.6g(60kg이면 약 100g) — 계란 3개·닭가슴살 1팩·우유 500ml 정도. 운동보다 이게 더 중요할 수 있습니다.' },
  { h: '통증', p: '허리가 "뻐근"하면 골반 후방경사(허리 바닥에 붙이기)를 다시 확인. "찌릿"하면 그 동작은 중단하고 한 단계 아래로. 관절 통증은 참는 게 아닙니다.' },
];

window.PROGRAM = { GOALS, EQUIP, EX, CHAINS, WARMUP, DAYS, WEEK, DURATION, pickChain, usable, TESTS, PRINCIPLES };
