/* =========================================================================
   운동별 자세 프레임. 각 항목은 프레임 배열(1~3개). 각도 규칙은 figure.js 참고.
   ========================================================================= */
(function () {
  const STAND = { hip: [50, 37], torso: 90, arms: [[-80, -85], [-80, -85]], legs: [[-90, -90], [-90, -90]] };
  const STAND_F = { hip: [50, 37], torso: 90, front: true, arms: [[-80, -85], [-100, -95]], legs: [[-97, -92], [-83, -88]], feet: [-160, -20] };
  const SUPINE = { hip: [42, 59], torso: 180, head: 180, arms: [[20, 0], [20, 0]], legs: [[0, 0], [0, 0]], feet: [90, 90] };
  const PRONE = { hip: [45, 59], torso: 180, head: 180, arms: [[180, 180], [180, 180]], legs: [[0, 0], [0, 0]], feet: [0, 0] };
  const QUAD = { hip: [60, 49], torso: 164, head: 210, arms: [[-90, -90], [-90, -90]], legs: [[-90, 180], [-90, 180]], feet: [180, 180] };
  const TOP = { hip: [50, 52], torso: 90, front: true, legs: [[-97, -90], [-83, -90]], feet: [-150, -30], note: '위에서 본 모습' };
  const X = (base, o) => Object.assign({}, base, o);

  const chair = (x, w, top) => ({ t: 'box', x, y: top, w, h: 62 - top });
  const wallR = (x) => ({ t: 'wallR', x });
  const wallL = (x) => ({ t: 'wallL', x });

  /* 공통 프레임 */
  const pushupTop = { hip: [56.3, 51.5], torso: 155.2, arms: [[-90, -90], [-90, -90]], legs: [[-24.8, -24.8], [-24.8, -24.8]], feet: null };
  const pushupBot = { hip: [57.8, 57.9], torso: 170.6, arms: [[-33, -164], [-33, -164]], legs: [[-9.4, -9.4], [-9.4, -9.4]], feet: null };
  const pikeHold = { hip: [52, 40], torso: 217.7, head: 250, arms: [[-142.3, -142.3], [-142.3, -142.3]], legs: [[-61.6, -61.6], [-61.6, -61.6]], feet: null };
  const pikeBot = { hip: [48, 44], torso: 225, head: 235, arms: [[166, -115], [166, -115]], legs: [[-48.4, -48.4], [-48.4, -48.4]], feet: null };
  const bridgeDown = X(SUPINE, { arms: [[0, 0], [0, 0]], legs: [[72, -75], [72, -75]], feet: [-90, -90] });
  const bridgeUp = { hip: [39, 50], torso: 208, head: 180, arms: [[0, 0], [0, 0]], legs: [[30, -80], [30, -80]], feet: [-90, -90] };
  const hang = { hip: [50, 36.6], torso: 90, scale: 0.85, front: true, arms: [[111, 111], [69, 69]], legs: [[-95, -90], [-85, -90]], feet: [-120, -60], props: [{ t: 'bar', y: 6, x1: 30, x2: 70 }] };
  const hangTop = { hip: [50, 35.3], torso: 90, scale: 0.85, front: true, arms: [[-150, 100], [-30, 80]], legs: [[-100, -140], [-80, -40]], feet: [-150, -30], props: [{ t: 'bar', y: 14, x1: 30, x2: 70 }] };
  const hsHold = { hip: [50, 31.4], torso: 90, head: -90, scale: 0.85, front: true, arms: [[-110, -80], [-70, -100]], legs: [[104, 94], [76, 86]], feet: [170, 10], props: ['bg'] };
  const squatDown = { hip: [46, 50], torso: 65, arms: [[0, 0], [0, 0]], legs: [[-5, -100], [-5, -100]] };
  const lungeDown = { hip: [50, 48], torso: 85, arms: [[-80, -85], [-80, -85]], legs: [[-10, -90], [-130, 180]], feet: [0, -60] };
  const rowTable = [chair(30, 50, 36)];
  const rowHang = { hip: [67, 57.5], torso: 191.6, head: 191.6, arms: [[90, 90], [90, 90]], legs: [[40, -80], [40, -80]], feet: [-90, -90], props: [{ t: 'box', x: 30, y: 34, w: 50, h: 2.5 }] };
  const rowUp = { hip: [67, 49.5], torso: 198, head: 198, arms: [[153, 27], [153, 27]], legs: [[-10, -60], [-10, -60]], feet: [-90, -90], props: [{ t: 'box', x: 30, y: 34, w: 50, h: 2.5 }] };
  const sidePlank = { hip: [51, 58.5], torso: 12, head: 12, arms: [[-90, 0], [90, 90]], legs: [[-168, -168], [-168, -168]], feet: [-90, -90] };

  const P = {
    /* 워밍업 */
    breath90: [X(SUPINE, { hip: [40, 59], arms: [[45, -35], [45, -35]], legs: [[90, 0], [90, 0]], feet: [90, 90], props: [chair(46, 16, 45)], note: '종아리 의자에, 허리 바닥에, 길게 내쉬기' })],
    catcow: [X(QUAD, { arch: 6, head: 250, note: '등 둥글게 (고양이)' }), X(QUAD, { arch: -5, head: 150, note: '가슴 열기 (소)' })],
    bridge_act: [bridgeDown, X(bridgeUp, { note: '엉덩이 꽉 조이기' })],
    deadbug_w: [X(SUPINE, { arms: [[90, 90], [90, 90]], legs: [[90, 0], [90, 0]], feet: [90, 90] }), X(SUPINE, { arms: [[90, 90], [180, 180]], legs: [[90, 0], [15, 0]], feet: [90, 90], note: '반대 팔·다리 뻗기, 허리 바닥에' })],
    wgs: [{ hip: [50, 48], torso: 20, arms: [[-95, -95], [-95, -95]], legs: [[-10, -90], [-160, -25]], feet: [-90, -60], note: '양손 바닥, 뒷다리 쭉' }, { hip: [50, 48], torso: 35, arms: [[-95, -95], [95, 95]], legs: [[-10, -90], [-160, -25]], feet: [-90, -60], note: '한 팔 천장으로 회전' }],
    armcircle: [X(STAND_F, { arms: [[170, 180], [10, 0]] }), X(STAND_F, { arms: [[130, 120], [50, 60]], note: '크게 원 그리기' })],
    hipcars: [X(STAND, { legs: [[-90, -90], [20, -70]], arms: [[-10, -10], [-10, -10]], props: [wallR(74)] }), X(STAND, { legs: [[-90, -90], [-150, -60]], arms: [[-10, -10], [-10, -10]], props: [wallR(74)], note: '무릎으로 큰 원' })],

    /* 푸시 */
    wall_pushup: [{ hip: [56.6, 38.5], torso: 70, arms: [[0, 0], [0, 0]], legs: [[-110, -110], [-110, -110]], props: [wallR(82)] }, { hip: [59.7, 39.9], torso: 62, arms: [[-30, 60], [-30, 60]], legs: [[-118, -118], [-118, -118]], props: [wallR(82)], note: '몸 일자 유지' }],
    incline_pushup: [{ hip: [49.2, 45.9], torso: 40, arms: [[-18, -18], [-18, -18]], legs: [[-140, -140], [-140, -140]], feet: null, props: [chair(76, 20, 40)] }, { hip: [50.7, 48], torso: 34, arms: [[-57, 30], [-57, 30]], legs: [[-146, -146], [-146, -146]], feet: null, props: [chair(76, 20, 40)], note: '가슴을 모서리까지' }],
    knee_pushup: [{ hip: [51.4, 54.5], torso: 144.5, arms: [[-90, -90], [-90, -90]], legs: [[-35.5, 0], [-35.5, 0]], feet: [60, 60] }, { hip: [49.6, 58.2], torso: 163, arms: [[-28, -150], [-28, -150]], legs: [[-17, 0], [-17, 0]], feet: [60, 60], note: '무릎부터 머리까지 일자' }],
    pushup: [pushupTop, X(pushupBot, { note: '엉덩이 조이고 허리 뜨지 않게' })],
    decline_pushup: [{ hip: [58, 44.8], torso: 177.4, arms: [[-90, -90], [-90, -90]], legs: [[-2.6, -2.6], [-2.6, -2.6]], feet: null, props: [chair(78, 16, 46)] }, { hip: [57.6, 51.4], torso: 191.6, arms: [[-33, -164], [-33, -164]], legs: [[11.6, 11.6], [11.6, 11.6]], feet: null, props: [chair(78, 16, 46)], note: '발을 의자에' }],
    diamond_pushup: [X(pushupTop, { note: '양손 엄지·검지 붙이기' }), X(pushupBot, { note: '팔꿈치 몸에 붙이고' })],
    archer_pushup: [X(TOP, { arms: [[10, 0], [170, 180]], note: '위에서 본 모습 · 손 넓게' }), X(TOP, { arms: [[15, 0], [200, 120]], note: '한 팔은 굽히고 반대 팔은 쭉' })],
    pike_hold: [X(pikeHold, { note: '엉덩이 높이, 팔로 바닥 밀기' })],
    pike_pushup: [pikeHold, X(pikeBot, { note: '정수리를 바닥 쪽으로' })],
    pike_pushup_elev: [{ hip: [56, 28], torso: 244.8, head: 250, arms: [[-115, -115], [-115, -115]], legs: [[-45, -45], [-45, -45]], feet: null, props: [chair(68, 20, 46)] }, { hip: [54, 32], torso: 250, head: 250, arms: [[158, -82], [158, -82]], legs: [[-35, -35], [-35, -35]], feet: null, props: [chair(68, 20, 46)], note: '발은 의자 위' }],
    wall_hs_hold: [X(hsHold, { note: '벽을 등지고(가슴이 벽 쪽) 거꾸로, 발끝만 벽에' })],
    wall_hspu: [hsHold, X(hsHold, { hip: [50, 36], arms: [[-155, -50], [-25, -130]], note: '머리가 바닥에 닿기 전까지' })],
    chair_dip_bent: [{ hip: [46.2, 42.9], torso: 110, head: 90, arms: [[-90, -90], [-90, -90]], legs: [[-15, -85], [-15, -85]], feet: [-90, -90], props: [chair(20, 20, 44)] }, { hip: [46, 50], torso: 110, head: 90, arms: [[-146, -34], [-146, -34]], legs: [[-5, -85], [-5, -85]], feet: [-90, -90], props: [chair(20, 20, 44)], note: '팔꿈치 90도까지만' }],
    chair_dip_straight: [{ hip: [46.2, 42.9], torso: 110, head: 90, arms: [[-90, -90], [-90, -90]], legs: [[-35, -35], [-35, -35]], feet: [-90, -90], props: [chair(20, 20, 44)] }, { hip: [46, 50], torso: 110, head: 90, arms: [[-146, -34], [-146, -34]], legs: [[-25, -25], [-25, -25]], feet: [-90, -90], props: [chair(20, 20, 44)], note: '다리 쭉, 뒤꿈치만 바닥' }],
    chair_dip_elev: [{ hip: [46.2, 42.9], torso: 110, head: 90, arms: [[-90, -90], [-90, -90]], legs: [[-15, -15], [-15, -15]], feet: [-90, -90], props: [chair(20, 20, 44), chair(64, 20, 50)] }, { hip: [46, 50], torso: 110, head: 90, arms: [[-146, -34], [-146, -34]], legs: [[0, 0], [0, 0]], feet: [-90, -90], props: [chair(20, 20, 44), chair(64, 20, 50)], note: '발도 의자 위' }],
    tri_incline: [{ hip: [49.2, 45.9], torso: 40, arms: [[-18, -18], [-18, -18]], legs: [[-140, -140], [-140, -140]], feet: null, props: [chair(76, 20, 40)], note: '손 좁게' }, { hip: [50.7, 48], torso: 34, arms: [[-57, 30], [-57, 30]], legs: [[-146, -146], [-146, -146]], feet: null, props: [chair(76, 20, 40)], note: '팔꿈치 몸에 붙이고' }],
    lat_raise_bottle: [X(STAND_F, { props: ['bottles'] }), X(STAND_F, { arms: [[175, 185], [5, -5]], props: ['bottles'], note: '어깨 높이까지, 내릴 때 3초' })],
    prone_t: [X(TOP, { arms: [[170, 175], [10, 5]], note: '엎드려 T자 · 위에서 본 모습' }), X(TOP, { arms: [[165, 170], [15, 10]], note: '견갑 모으며 팔 들어 2초' })],

    /* 풀 */
    door_row: [{ hip: [61.4, 38.5], torso: 110, head: 90, arms: [[-32, -32], [-32, -32]], legs: [[-110, -110], [-110, -110]], props: [{ t: 'door', x: 71.5, hy: 31 }], note: '양쪽 손잡이 잡고 뒤로 기울기' }, { hip: [72, 37.1], torso: 95, head: 90, arms: [[-137, -30], [-137, -30]], legs: [[-95, -95], [-95, -95]], props: [{ t: 'door', x: 71.5, hy: 31 }], note: '팔꿈치를 뒤로, 가슴 앞으로' }],
    door_row_under: [{ hip: [61.4, 38.5], torso: 110, head: 90, arms: [[-32, -32], [-32, -32]], legs: [[-110, -110], [-110, -110]], props: [{ t: 'door', x: 71.5, hy: 31 }], note: '손바닥이 위를 향하게' }, { hip: [72, 37.1], torso: 95, head: 90, arms: [[-137, -30], [-137, -30]], legs: [[-95, -95], [-95, -95]], props: [{ t: 'door', x: 71.5, hy: 31 }], note: '팔꿈치 옆구리에 붙이고' }],
    table_row_bent: [rowHang, X(rowUp, { note: '견갑 먼저 모으고 가슴을 모서리로' })],
    table_row_straight: [X(rowHang, { hip: [67, 57.5], legs: [[0, 0], [0, 0]] }), X(rowUp, { legs: [[-22, -22], [-22, -22]], note: '몸 전체 판자처럼' })],
    table_row_elev: [X(rowHang, { hip: [67, 55], torso: 190, head: 190, legs: [[0, 0], [0, 0]], feet: null, props: [{ t: 'box', x: 30, y: 34, w: 50, h: 2.5 }, chair(86, 12, 55)] }), X(rowUp, { legs: [[-10, -10], [-10, -10]], feet: null, props: [{ t: 'box', x: 30, y: 34, w: 50, h: 2.5 }, chair(86, 12, 55)], note: '발 올리고' })],
    table_row_onearm: [X(rowHang, { hip: [67, 57.5], legs: [[0, 0], [0, 0]], arms: [[90, 90], [-10, 170]] }), X(rowUp, { legs: [[-22, -22], [-22, -22]], arms: [[153, 27], [-10, 170]], note: '한 손은 가슴에' })],
    dead_hang: [X(hang, { note: '어깨를 귀에서 멀리' })],
    neg_pullup: [X(hangTop, { legs: [[-95, -90], [-85, -90]], feet: [-160, -20], props: [{ t: 'bar', y: 14, x1: 30, x2: 70 }, chair(42, 16, 56.8)], note: '의자 딛고 턱을 봉 위로' }), X(hang, { note: '5초에 걸쳐 천천히 내려오기' })],
    pullup: [hang, X(hangTop, { note: '가슴을 봉 쪽으로' })],
    pullup_weighted: [X(hang, { props: [{ t: 'bar', y: 6, x1: 30, x2: 70 }, 'bag'] }), X(hangTop, { props: [{ t: 'bar', y: 14, x1: 30, x2: 70 }, 'bag'], note: '가방 메고' })],
    chinup: [X(hang, { note: '손바닥이 나를 향하게' }), hangTop],
    bottle_curl: [X(STAND, { props: ['bottles'] }), X(STAND, { arms: [[-80, 60], [-80, 60]], props: ['bottles'], note: '팔꿈치 옆구리 고정, 내릴 때 3초' })],
    towel_curl: [X(STAND, { arms: [[-80, 10], [-80, 10]], legs: [[-70, -90], [-100, -90]], props: [{ t: 'line', a: 'hand0', b: [56, 62] }], note: '발로 수건 밟고 당기며 20초 버티기' })],
    underhand_row: [X(rowHang, { note: '손바닥이 위를 향하게' }), rowUp],
    ytw: [X(TOP, { arms: [[120, 120], [60, 60]], note: 'Y · 엄지 위로' }), X(TOP, { arms: [[175, 180], [5, 0]], note: 'T · 견갑 모으기' }), X(TOP, { arms: [[200, 120], [-20, 60]], note: 'W · 팔꿈치 뒤로' })],
    superman: [X(PRONE, { arch: -3, head: 165, arms: [[165, 165], [165, 165]], legs: [[10, 10], [10, 10]], note: '엉덩이 조여 팔다리 들기' })],
    swimmer: [X(TOP, { arms: [[110, 110], [70, 70]], note: '팔 앞으로 뻗어 띄우고' }), X(TOP, { arms: [[-110, -110], [-70, -70]], note: '옆으로 크게 돌려 엉덩이 옆까지' })],
    wall_angel: [X(STAND_F, { arms: [[200, 110], [-20, 70]], props: ['bg'] }), X(STAND_F, { arms: [[150, 100], [30, 80]], props: ['bg'], note: '벽에 손목·팔꿈치 붙인 채 위로' })],
    band_pullapart: [X(STAND_F, { arms: [[-15, 15], [195, 165]], props: [{ t: 'line', a: 'hand0', b: 'hand1' }] }), X(STAND_F, { arms: [[180, 180], [0, 0]], props: [{ t: 'line', a: 'hand0', b: 'hand1' }], note: '견갑 모으며 2초' })],

    /* 하체 */
    box_squat: [X(STAND, { hip: [52, 37], props: [chair(24, 22, 44)] }), { hip: [44, 44], torso: 75, arms: [[0, 0], [0, 0]], legs: [[-20, -90], [-20, -90]], props: [chair(24, 22, 44)], note: '엉덩이 닿으면 바로 일어나기' }],
    air_squat: [STAND, X(squatDown, { note: '허벅지 평행 이하, 무릎은 발끝 방향' })],
    tempo_squat: [STAND, X(squatDown, { note: '3초 내려가고 1초 정지' })],
    split_squat: [{ hip: [50, 37], torso: 90, arms: [[-20, 180], [-20, 180]], legs: [[-90, -90], [-120, 160]], feet: [0, 0], props: [chair(14, 20, 44)] }, { hip: [48, 47], torso: 80, arms: [[-20, 180], [-20, 180]], legs: [[-32, -105], [-126, 120]], feet: [-90, 0], props: [chair(14, 20, 44)], note: '뒷발 의자에, 뒷무릎 바닥 가까이' }],
    pistol_box: [{ hip: [30, 46], torso: 70, arms: [[0, 0], [0, 0]], legs: [[-25, -85], [5, 0]], feet: [-90, 90], props: [chair(14, 20, 46)] }, { hip: [44, 38], torso: 85, arms: [[0, 0], [0, 0]], legs: [[-90, -90], [-10, 0]], feet: [0, 90], props: [chair(14, 20, 46)], note: '한 발로 일어나기' }],
    hip_hinge: [X(STAND, { hip: [46, 37], props: [wallL(38)] }), { hip: [42, 37], torso: 25, arms: [[-80, -85], [-80, -85]], legs: [[-75, -90], [-75, -90]], props: [wallL(38)], note: '엉덩이를 뒤로 밀어 벽 터치, 등 일자' }],
    sl_rdl: [STAND, { hip: [50, 38], torso: 10, arms: [[-90, -90], [-90, -90]], legs: [[-88, -92], [170, 170]], feet: [0, -90], note: '몸이 T자, 골반 수평' }],
    slider_curl: [{ hip: [39, 50], torso: 208, head: 180, arms: [[0, 0], [0, 0]], legs: [[-20, -15], [-20, -15]], feet: [-90, -90], props: [{ t: 'pad', at: 'foot0' }] }, { hip: [40, 49], torso: 209, head: 180, arms: [[0, 0], [0, 0]], legs: [[25, -80], [25, -80]], feet: [-90, -90], props: [{ t: 'pad', at: 'foot0' }], note: '엉덩이 든 채 뒤꿈치 당기기' }],
    nordic_neg: [{ hip: [50, 49], torso: 90, arms: [[-80, -85], [-80, -85]], legs: [[-90, 0], [-90, 0]], feet: [0, 0], props: [{ t: 'box', x: 62, y: 46, w: 20, h: 12 }] }, { hip: [60, 53.6], torso: 40, arms: [[-30, -30], [-30, -30]], legs: [[-140, 0], [-140, 0]], feet: [0, 0], props: [{ t: 'box', x: 62, y: 46, w: 20, h: 12 }], note: '햄스트링으로 버티며 천천히' }],
    glute_bridge: [bridgeDown, X(bridgeUp, { note: '위에서 2초 정지' })],
    hip_thrust: [{ hip: [42.6, 58.8], torso: 130, head: 100, arms: [[170, 170], [170, 170]], legs: [[35, -80], [35, -80]], feet: [-90, -90], props: [chair(10, 20, 44)] }, { hip: [48, 45], torso: 180, head: 120, arms: [[170, 170], [170, 170]], legs: [[-30, -80], [-30, -80]], feet: [-90, -90], props: [chair(10, 20, 44)], note: '턱 당기고 갈비뼈 넣은 채 수평까지' }],
    sl_bridge: [X(SUPINE, { hip: [40, 59], arms: [[0, 0], [0, 0]], legs: [[72, -75], [60, 60]], feet: [-90, 90] }), X(bridgeUp, { legs: [[30, -80], [60, 60]], feet: [-90, 90], note: '한 다리로, 골반 수평' })],
    sl_thrust: [{ hip: [42.6, 58.8], torso: 130, head: 100, arms: [[170, 170], [170, 170]], legs: [[35, -80], [60, 60]], feet: [-90, 90], props: [chair(10, 20, 44)] }, { hip: [48, 45], torso: 180, head: 120, arms: [[170, 170], [170, 170]], legs: [[-30, -80], [20, 20]], feet: [-90, 90], props: [chair(10, 20, 44)], note: '한 다리로 2초' }],
    rev_lunge: [STAND, X(lungeDown, { note: '뒷무릎 바닥 가까이, 앞발 뒤꿈치로 밀기' })],
    walking_lunge: [STAND, X(lungeDown, { note: '앞으로 걸어가며' })],
    jump_lunge: [X(lungeDown, {}), X(lungeDown, { hip: [50, 42], legs: [[-40, -100], [-140, -160]], feet: null, note: '점프해서 다리 바꾸기' })],
    calf_raise: [{ hip: [50, 36], torso: 90, arms: [[-20, 20], [-20, 20]], legs: [[-90, -90], [-90, -90]], feet: [30, 30], props: [{ t: 'box', x: 52, y: 58, w: 18, h: 4 }, wallR(74)] }, { hip: [50, 29], torso: 90, arms: [[-20, 20], [-20, 20]], legs: [[-90, -90], [-90, -90]], feet: [-50, -50], props: [{ t: 'box', x: 52, y: 58, w: 18, h: 4 }, wallR(74)], note: '아래서 2초, 위에서 1초' }],
    sl_calf_raise: [{ hip: [50, 36], torso: 90, arms: [[-20, 20], [-20, 20]], legs: [[-90, -90], [-100, -30]], feet: [30, 0], props: [{ t: 'box', x: 52, y: 58, w: 18, h: 4 }, wallR(74)] }, { hip: [50, 29], torso: 90, arms: [[-20, 20], [-20, 20]], legs: [[-90, -90], [-100, -30]], feet: [-50, 0], props: [{ t: 'box', x: 52, y: 58, w: 18, h: 4 }, wallR(74)], note: '한 발로' }],

    /* 코어 */
    deadbug: [X(SUPINE, { arms: [[90, 90], [90, 90]], legs: [[90, 0], [90, 0]], feet: [90, 90] }), X(SUPINE, { arms: [[90, 90], [180, 180]], legs: [[90, 0], [15, 0]], feet: [90, 90], note: '반대 팔·다리, 허리는 바닥에' })],
    hollow_hold: [{ hip: [42, 59], torso: 165, head: 165, arms: [[165, 165], [165, 165]], legs: [[15, 15], [15, 15]], feet: [90, 90], note: '허리 바닥에 붙이고 바나나 모양' }],
    rkc_plank: [{ hip: [57.6, 56.7], torso: 168, arms: [[-90, 0], [-90, 0]], legs: [[-12, -12], [-12, -12]], feet: null, note: '엉덩이 꽉, 골반 뒤로 말기' }],
    hollow_rock: [{ hip: [42, 59], torso: 165, head: 165, arms: [[165, 165], [165, 165]], legs: [[15, 15], [15, 15]], feet: [90, 90], note: '자세 유지한 채 앞뒤로 흔들기' }],
    leg_raise: [X(SUPINE, { arms: [[0, 0], [0, 0]], legs: [[90, 90], [90, 90]], feet: [180, 180], note: '끝에서 골반 살짝 말아 올리기' }), X(SUPINE, { arms: [[0, 0], [0, 0]], legs: [[5, 5], [5, 5]], feet: [90, 90], note: '허리 뜨기 직전에서 멈추기' })],
    rev_crunch: [X(SUPINE, { arms: [[0, 0], [0, 0]], legs: [[90, 0], [90, 0]], feet: [90, 90] }), { hip: [40, 55], torso: 194, head: 180, arms: [[0, 0], [0, 0]], legs: [[120, 30], [120, 30]], feet: [90, 90], note: '골반 말아 무릎을 가슴 쪽으로' }],
    side_plank_knee: [X(sidePlank, { legs: [[-168, 150], [-168, 150]], feet: [-30, -30], note: '팔꿈치·무릎으로 지지, 골반 들기' })],
    side_plank: [X(sidePlank, { note: '골반 처지지 않게' })],
    side_plank_dip: [sidePlank, X(sidePlank, { hip: [51, 61.5], torso: 6, head: 6, note: '골반 내렸다 올리기' })],
    copenhagen: [{ hip: [51, 54], torso: 12, head: 12, arms: [[-90, 0], [90, 90]], legs: [[-175, -140], [168, 168]], feet: [-90, -90], props: [chair(14, 16, 50)], note: '위쪽 다리를 의자에' }],
    birddog: [X(QUAD, { arms: [[-90, -90], [175, 175]], legs: [[-90, 180], [5, 5]], feet: [180, -90], note: '반대 팔·다리 뻗고 2초, 골반 수평' })],

    /* 스트레칭 */
    couch: [{ hip: [30, 49], torso: 90, arms: [[-60, -60], [-60, -60]], legs: [[-10, -100], [-95, 95]], feet: [-90, 180], props: [wallL(26)], note: '뒷정강이 벽에, 엉덩이 조이고 골반 뒤로' }],
    hf_kneel: [{ hip: [30, 49], torso: 90, arms: [[-60, -60], [100, 100]], legs: [[-10, -100], [-95, 180]], feet: [-90, 0], note: '골반 뒤로 말고 같은 쪽 팔 위로' }],
    ham_stretch: [X(SUPINE, { arms: [[50, 50], [50, 50]], legs: [[80, 80], [0, 0]], feet: [170, 90], props: [{ t: 'line', a: 'hand0', b: 'foot0' }], note: '수건 걸고 천장 쪽으로 당기기' })],
    fwd_fold: [{ hip: [50, 37], torso: -30, head: -30, arms: [[-90, -90], [-90, -90]], legs: [[-95, -85], [-95, -85]], note: '무릎 살짝 굽혀도 됨, 골반부터 접기' }],
    pigeon: [{ hip: [46, 56], torso: 100, arms: [[-80, -80], [-80, -80]], legs: [[-20, 180], [-170, -170]], feet: [90, 0], note: '앞다리 접고 뒷다리 쭉' }],
    ninety: [{ hip: [48, 44], torso: 90, front: true, arms: [[-30, -30], [210, 210]], legs: [[0, -90], [-90, 180]], feet: [-90, 180], note: '위에서 본 모습 · 양 무릎 90도' }],
    adductor: [{ hip: [50, 44], torso: 90, front: true, arms: [[100, 90], [80, 90]], legs: [[180, -90], [0, -90]], feet: [180, 0], note: '위에서 본 모습 · 무릎 최대한 벌리기' }],
    deep_squat: [{ hip: [46, 50], torso: 75, arms: [[-30, -60], [-30, -60]], legs: [[-5, -100], [-5, -100]], note: '끝까지 앉아 팔꿈치로 무릎 밀기, 뒤꿈치 바닥' }],
    ankle_wall: [{ hip: [58, 42], torso: 80, arms: [[-60, -60], [-60, -60]], legs: [[-30, -100], [-130, -100]], feet: [-90, -90], props: [wallR(71)], note: '뒤꿈치 떼지 않고 무릎을 벽에' }],
    tspine_rot: [{ hip: [56, 40], torso: 180, head: 180, arms: [[90, 90], [90, 90]], legs: [[-60, 180], [-60, 180]], feet: [180, 180], note: '위에서 본 모습 · 옆으로 누워 손 모으기' }, { hip: [56, 40], torso: 180, head: 180, arms: [[90, 90], [-90, -90]], legs: [[-60, 180], [-60, 180]], feet: [180, 180], note: '위쪽 팔을 반대편으로 펼치기' }],
    tspine_ext: [{ hip: [35.5, 50.7], torso: 2, head: -25, arms: [[30, 150], [30, 150]], legs: [[-60, 180], [-60, 180]], feet: [180, 180], props: [chair(60, 20, 44)], note: '팔꿈치 의자에, 가슴을 바닥으로' }],
    doorway: [{ hip: [50, 37], torso: 80, arms: [[20, 80], [20, 80]], legs: [[-70, -90], [-110, -90]], props: [{ t: 'door', x: 62, hy: 30 }], note: '팔꿈치 문틀에, 한 발 앞으로' }],
    lat_stretch: [{ hip: [36, 37], torso: 10, head: -10, arch: 3, arms: [[-10, -10], [-10, -10]], legs: [[-95, -85], [-95, -85]], props: [chair(66, 26, 40)], note: '책상 잡고 엉덩이 뒤로, 겨드랑이 늘리기' }],
    child: [{ hip: [45.6, 49.8], torso: 205, head: 205, arms: [[180, 180], [180, 180]], legs: [[-70, 0], [-70, 0]], feet: [0, 0], note: '이마 바닥, 팔 멀리' }],
    downdog: [X(pikeHold, { note: '뒤꿈치를 바닥 쪽으로' })],
    neck_stretch: [X(STAND_F, { head: 70, arms: [[-95, -95], [60, 150]], note: '손 무게로만 부드럽게' })],
    cobra: [{ hip: [45, 59], torso: 150, head: 150, arms: [[-110, 180], [-110, 180]], legs: [[0, 0], [0, 0]], feet: [0, 0], note: '엉덩이 조인 채 가슴만 살짝' }],
    walk: [X(STAND, { legs: [[-70, -95], [-110, -85]], arms: [[-60, -100], [-120, -80]], note: '팔 크게 흔들며' })],
  };

  window.POSES = P;
})();
