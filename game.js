// ============================================================
// game.js - 둥글둥글 감정마을 게임 핵심 로직
// 게임 상태 관리, 화면 전환, 챕터/상황 흐름, 배경 변화 담당
// ============================================================

// -------------------------------------------------------
// GameState: 게임 전체 상태 관리 객체
// -------------------------------------------------------
const GameState = {
  playerName: '',
  scores: { O: 50, C: 50, E: 50, A: 50, N: 50 }, // Big Five OCEAN (0~100, 초기값 50)
  currentChapter: 0,   // 현재 챕터 인덱스 (0~4)
  currentSituation: 0, // 챕터 내 현재 상황 인덱스 (0~4)
  responses: {         // 챕터별 응답 기록
    0: [], 1: [], 2: [], 3: [], 4: [],
  },
  introStep: 0,        // 도입 대사 진행 단계
  isTyping: false,     // 타이핑 애니메이션 진행 중 여부
  typingTimeout: null, // 타이핑 타이머 ID
};

// 현재 챕터에 속하는 CHAPTER_DATA 슬라이스 반환
function getSituationsForChapter(chapterIndex) {
  return CHAPTER_DATA.filter(s => s.chapterIndex === chapterIndex);
}

// 현재 상황 데이터 반환
function getCurrentSituation() {
  const situations = getSituationsForChapter(GameState.currentChapter);
  return situations[GameState.currentSituation] || null;
}

// -------------------------------------------------------
// updatePersonality: 새 점수를 누적 평균으로 성분 지수 업데이트
// -------------------------------------------------------
function updatePersonality(newScores) {
  const weight = 0.4;
  const blend = (old, nw) => Math.round(old * (1 - weight) + (nw ?? 50) * weight);
  GameState.scores.O = blend(GameState.scores.O, newScores.O);
  GameState.scores.C = blend(GameState.scores.C, newScores.C);
  GameState.scores.E = blend(GameState.scores.E, newScores.E);
  GameState.scores.A = blend(GameState.scores.A, newScores.A);
  GameState.scores.N = blend(GameState.scores.N, newScores.N);
  updateBackground();
  saveProgress();
}

// -------------------------------------------------------
// getReactionLevel: 현재 챕터 성분 기준 low/mid/high 반환
// -------------------------------------------------------
function getReactionLevel(chapterType) {
  const score = GameState.scores[chapterType] ?? 50;
  if (score <= 35) return 'low';
  if (score <= 65) return 'mid';
  return 'high';
}

// -------------------------------------------------------
// updateBackground: 배경 이미지 스프라이트 우선, 없으면 CSS 그라데이션
// -------------------------------------------------------
function updateBackground() {
  const bg = document.getElementById('game-background');
  if (!bg) return;

  // ── 스프라이트 배경 이미지 확인 ──────────────────────────
  const bgKey = `chapter${GameState.currentChapter}`;
  const bgImg = SPRITE_CONFIG.backgrounds[bgKey];

  if (bgImg) {
    // 이미지 스프라이트 사용 (CSS 그라데이션 대신)
    bg.classList.add('has-bg-image');
    bg.style.setProperty('--chapter-bg-image', `url('${bgImg}')`);
    // 그라데이션 background는 제거하지 않고 image가 위에 덮음
    return;
  }

  // 이미지가 없으면 CSS 그라데이션 모드
  bg.classList.remove('has-bg-image');
  bg.style.removeProperty('--chapter-bg-image');

  // ── OCEAN 기반 그라데이션 계산 ──────────────────────────
  const { O, C, E, A, N } = GameState.scores;
  const colors = [];

  // E (외향성) 기반
  if (E >= 50) {
    const t = (E - 50) / 50;
    colors.push(lerpColor('#FFF4E0', '#FF9A3C', t * 0.6));
    colors.push(lerpColor('#FFFDE7', '#FFD740', t * 0.5));
  } else {
    const t = (50 - E) / 50;
    colors.push(lerpColor('#F3F0FF', '#9C7AF2', t * 0.6));
    colors.push(lerpColor('#E8F0FF', '#7EB6FF', t * 0.5));
  }

  // O (개방성) 기반
  if (O >= 50) {
    const t = (O - 50) / 50;
    colors.push(lerpColor('#FDF0FF', '#D86DCD', t * 0.5));
  } else {
    const t = (50 - O) / 50;
    colors.push(lerpColor('#F0FFF4', '#52C78A', t * 0.5));
  }

  // A (우호성) 기반
  if (A >= 50) {
    const t = (A - 50) / 50;
    colors.push(lerpColor('#FFF5F0', '#FFA07A', t * 0.4));
  } else {
    const t = (50 - A) / 50;
    colors.push(lerpColor('#F0FFFE', '#48C9B0', t * 0.4));
  }

  // N (감수성) 기반
  if (N >= 50) {
    const t = (N - 50) / 50;
    colors.push(lerpColor('#F0F4FF', '#7EB6FF', t * 0.3));
  } else {
    const t = (50 - N) / 50;
    colors.push(lerpColor('#FFFFF0', '#E8C84A', t * 0.3));
  }

  const gradColors = colors.slice(0, 4);
  const gradient = `radial-gradient(ellipse at top left, ${gradColors[0]}, ${gradColors[1] || gradColors[0]}),
    radial-gradient(ellipse at bottom right, ${gradColors[2] || gradColors[0]}, ${gradColors[3] || gradColors[1] || gradColors[0]})`;

  bg.style.background = gradient;
}

// 두 hex 색상을 비율 t(0~1)로 보간
function lerpColor(hex1, hex2, t) {
  const r1 = parseInt(hex1.slice(1, 3), 16);
  const g1 = parseInt(hex1.slice(3, 5), 16);
  const b1 = parseInt(hex1.slice(5, 7), 16);
  const r2 = parseInt(hex2.slice(1, 3), 16);
  const g2 = parseInt(hex2.slice(3, 5), 16);
  const b2 = parseInt(hex2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

// -------------------------------------------------------
// showScreen: 화면 전환 (fadeOut → fadeIn)
// -------------------------------------------------------
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    if (screen.style.display !== 'none') {
      screen.classList.add('fade-out');
      setTimeout(() => {
        screen.style.display = 'none';
        screen.classList.remove('fade-out');
      }, 400);
    }
  });

  setTimeout(() => {
    const target = document.getElementById(screenId);
    if (target) {
      target.style.display = 'flex';
      target.classList.add('fade-in');
      setTimeout(() => target.classList.remove('fade-in'), 500);
    }
  }, 400);
}

// -------------------------------------------------------
// typeText: 타이핑 애니메이션 (한 글자씩)
// -------------------------------------------------------
function typeText(element, text, speed = 40, onComplete) {
  if (!element) return;
  GameState.isTyping = true;
  document.body.classList.add('typing-active'); // 타이핑 중 클릭 방지
  element.textContent = '';
  let i = 0;

  function typeNext() {
    if (i < text.length) {
      element.textContent += text[i];
      i++;
      GameState.typingTimeout = setTimeout(typeNext, speed);
    } else {
      GameState.isTyping = false;
      document.body.classList.remove('typing-active'); // 클릭 방지 해제
      if (onComplete) onComplete();
    }
  }
  typeNext();
}

// 타이핑 즉시 완료 (클릭 시)
function skipTyping(element, fullText, onComplete) {
  if (GameState.typingTimeout) clearTimeout(GameState.typingTimeout);
  if (element) element.textContent = fullText;
  GameState.isTyping = false;
  document.body.classList.remove('typing-active'); // 클릭 방지 해제
  if (onComplete) onComplete();
}

// -------------------------------------------------------
// NPC 캐릭터 렌더링 (스프라이트 이미지 우선, 없으면 CSS 폴백)
// -------------------------------------------------------
function renderNPCCharacter(npcKey) {
  const npcArea = document.getElementById('game-npc-char');
  const nameDisplay = document.getElementById('npc-name-display');
  if (!npcArea || !npcKey) return;

  const npc = NPC_DATA[npcKey];
  if (!npc) return;

  const spriteImg = SPRITE_CONFIG.characters[npcKey];

  if (spriteImg) {
    // 이미지 스프라이트 사용
    npcArea.innerHTML = `
      <div class="npc-char-wrapper has-sprite-image">
        <img
          src="${spriteImg}"
          alt="${npc.name}"
          class="npc-sprite-img"
          onerror="this.closest('.has-sprite-image').outerHTML='<div class=\\"${npc.cssClass} npc-css-char\\"></div>'"
        >
      </div>`;
  } else {
    // CSS 기본 캐릭터 사용
    npcArea.innerHTML = `<div class="${npc.cssClass} npc-css-char"></div>`;
  }

  if (nameDisplay) nameDisplay.textContent = npc.name;
}

// -------------------------------------------------------
// updateProgressBar: 진행도 업데이트
// -------------------------------------------------------
function updateProgressBar() {
  const text = document.getElementById('progress-text');
  const dots = document.getElementById('progress-dots');

  const totalChapters = 5;
  const totalSituations = 5;
  const chapNum = GameState.currentChapter + 1;
  const sitNum = GameState.currentSituation + 1;

  if (text) text.textContent = `Chapter ${chapNum} · 상황 ${sitNum}/5`;

  if (dots) {
    dots.innerHTML = '';
    for (let s = 0; s < totalSituations; s++) {
      const dot = document.createElement('span');
      dot.className = 'progress-dot';
      if (s < GameState.currentSituation) dot.classList.add('done');
      else if (s === GameState.currentSituation) dot.classList.add('current');
      dots.appendChild(dot);
    }
  }
}

// -------------------------------------------------------
// showSituation: 현재 상황 화면에 표시
// 흐름: 나레이터(장면) → NPC 대사 → 가벼운 질문 → 입력창
// -------------------------------------------------------
function showSituation(situation) {
  if (!situation) return;

  const level = getReactionLevel(situation.chapterType);
  const npcDialogue = situation[`npcDialogue_${level}`] || situation.npcDialogue_mid;

  // 브릿지 패널 숨기고 질문 영역 복구
  const bridgePanel  = document.getElementById('bridge-panel');
  const questionArea = document.getElementById('question-area');
  const btnNext      = document.getElementById('btn-next-situation');
  if (bridgePanel)  { bridgePanel.classList.remove('visible'); bridgePanel.style.display = 'none'; }
  if (questionArea) { questionArea.style.display = 'block'; }
  if (btnNext)      { btnNext.style.display = 'none'; }

  // NPC 캐릭터 업데이트
  renderNPCCharacter(situation.npcKey);

  // 나레이터 텍스트 (장면 제시)
  const narratorEl = document.getElementById('narrator-text');
  if (narratorEl) narratorEl.textContent = situation.narratorText;

  // NPC 이름
  const dialogNpcName = document.getElementById('dialog-npc-name');
  if (dialogNpcName) dialogNpcName.textContent = situation.npcName;

  // 입력 영역 및 질문 초기화
  const npcDialogEl  = document.getElementById('npc-dialog-text');
  const questionEl   = document.getElementById('question-prompt');
  const inputArea    = document.querySelector('.player-input-area');
  const playerInput  = document.getElementById('player-input');
  const submitBtn    = document.getElementById('btn-submit');

  if (inputArea)  { inputArea.style.opacity = '0'; }
  if (questionEl) { questionEl.textContent = ''; }
  if (playerInput){ playerInput.value = ''; playerInput.disabled = false; }
  if (submitBtn)  { submitBtn.disabled = false; }

  // 1. NPC 대사 타이핑
  typeText(npcDialogEl, npcDialogue, 32, () => {
    // 2. 짧은 텀 후 가벼운 질문 등장
    setTimeout(() => {
      if (questionEl) {
        typeText(questionEl, situation.questionPrompt, 28, () => {
          // 3. 입력창 페이드인
          if (inputArea) {
            inputArea.style.transition = 'opacity 0.45s ease';
            inputArea.style.opacity = '1';
          }
          if (playerInput) playerInput.focus();
        });
      }
    }, 250);
  });

  updateProgressBar();
}

// -------------------------------------------------------
// onPlayerSubmit: 플레이어 답변 제출 처리
// 흐름: 답변 기록 → (분석 + 브릿지 생성 병렬) → 브릿지 표시 → 다음 상황
// -------------------------------------------------------
async function onPlayerSubmit() {
  const input = document.getElementById('player-input');
  if (!input) return;

  const playerText = input.value.trim();
  if (!playerText || playerText.length < 2) {
    input.placeholder = '조금 더 써주세요 :)';
    input.style.borderColor = '#FFB7C5';
    setTimeout(() => {
      input.placeholder = '마음 가는 대로 자유롭게 써주세요 🌱';
      input.style.borderColor = '';
    }, 2000);
    return;
  }

  const situation = getCurrentSituation();
  if (!situation) return;

  // 응답 기록 및 UI 잠금
  GameState.responses[GameState.currentChapter].push(playerText);
  const submitBtn   = document.getElementById('btn-submit');
  const playerInput = document.getElementById('player-input');
  if (submitBtn)   submitBtn.disabled = true;
  if (playerInput) playerInput.disabled = true;

  // 마지막 상황 여부 + 다음 상황 힌트
  const situations = getSituationsForChapter(GameState.currentChapter);
  const isLast  = GameState.currentSituation >= situations.length - 1;
  const nextSit = isLast ? null : situations[GameState.currentSituation + 1];
  const nextHint = isLast
    ? '이야기가 마무리돼요.'
    : (nextSit?.nextSituationHint || nextSit?.narratorText || '');

  showLoading('이야기가 이어지고 있어요... 🌿');

  // 분석 + 브릿지 내러티브 순차 호출 (429 방지)
  const npc = NPC_DATA[situation.npcKey] || {};
  
  // 1. 성향 분석 호출
  const newScores = await analyzeResponse(playerText, situation.contextForAPI, situation.chapterType);
  
  // 2. 약간의 지연 후 내러티브 생성 호출
  await new Promise(resolve => setTimeout(resolve, 600)); 
  
  const bridgeText = await generateBridgeNarrative(
    playerText,
    situation.npcName,
    npc.trait || '',
    situation.chapterTitle,
    nextHint,
    GameState.playerName
  );

  updatePersonality(newScores);
  hideLoading();

  // 브릿지 내러티브 표시 후 다음으로 진행
  showBridgeNarrative(bridgeText, isLast, () => {
    if (isLast) {
      onChapterComplete();
    } else {
      GameState.currentSituation++;
      showSituationTransition(getCurrentSituation());
    }
  });
}

// -------------------------------------------------------
// showBridgeNarrative: 브릿지 내러티브 패널 표시 + 계속하기 버튼
// -------------------------------------------------------
function showBridgeNarrative(bridgeText, isLast, onContinue) {
  const questionArea  = document.getElementById('question-area');
  const bridgePanel   = document.getElementById('bridge-panel');
  const bridgeNarrEl  = document.getElementById('bridge-narrative');
  const btnNext       = document.getElementById('btn-next-situation');

  // 질문 영역 숨기기
  if (questionArea) questionArea.style.display = 'none';

  // 브릿지 패널 표시
  if (bridgePanel) {
    bridgePanel.style.display = 'block';
    requestAnimationFrame(() => bridgePanel.classList.add('visible'));
  }

  const text = bridgeText || '이야기는 조용히 계속되었어요...';

  // 계속하기 버튼 미리 준비 (핸들러 중복 등록 방지)
  let freshBtn = btnNext;
  if (btnNext) {
    freshBtn = btnNext.cloneNode(true);
    btnNext.parentNode.replaceChild(freshBtn, btnNext);
    freshBtn.style.display = 'none';

    freshBtn.addEventListener('click', () => {
      // 브릿지 패널 정리
      if (bridgePanel) {
        bridgePanel.classList.remove('visible');
        setTimeout(() => { bridgePanel.style.display = 'none'; }, 400);
      }
      if (bridgeNarrEl) bridgeNarrEl.textContent = '';
      freshBtn.style.display = 'none';

      // 다음 상황 or 챕터 완료
      onContinue();
    });
  }

  // 브릿지 텍스트 타이핑 (단 한 번만 호출)
  if (bridgeNarrEl) {
    bridgeNarrEl.textContent = '';
    typeText(bridgeNarrEl, text, 32, () => {
      // 타이핑 완료 → 계속하기 버튼 등장
      if (freshBtn) {
        freshBtn.textContent = isLast ? '챕터 완료 ✨' : '계속하기 →';
        freshBtn.style.display = 'inline-block';
        freshBtn.classList.add('fade-in');
      }
    });
  }
}

// -------------------------------------------------------
// nextSituation: (내부 유틸 - 브릿지 없이 바로 이동할 때 사용)
// -------------------------------------------------------
function nextSituation() {
  const situations = getSituationsForChapter(GameState.currentChapter);
  if (GameState.currentSituation < situations.length - 1) {
    GameState.currentSituation++;
    showSituationTransition(getCurrentSituation());
  } else {
    onChapterComplete();
  }
}

// 상황 전환 시 부드러운 연출
function showSituationTransition(situation) {
  const panel = document.getElementById('dialog-panel');
  if (panel) {
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(20px)';
    setTimeout(() => {
      showSituation(situation);
      panel.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    }, 400);
  } else {
    showSituation(situation);
  }
}

// -------------------------------------------------------
// onChapterComplete: 챕터 완료 처리
// -------------------------------------------------------
function onChapterComplete() {
  saveProgress();

  if (GameState.currentChapter < 4) {
    // 챕터 전환 메시지 표시 후 다음 챕터 시작
    const transition = CHAPTER_TRANSITIONS[GameState.currentChapter + 1];
    showChapterTransitionScreen(transition, () => {
      GameState.currentChapter++;
      GameState.currentSituation = 0;
      startChapter(GameState.currentChapter);
    });
  } else {
    // 모든 챕터 완료 → 엔딩
    goToEnding();
  }
}

// 챕터 전환 화면 표시
function showChapterTransitionScreen(message, callback) {
  // 임시 오버레이로 전환 메시지 표시
  const overlay = document.createElement('div');
  overlay.className = 'chapter-transition-overlay';
  overlay.innerHTML = `
    <div class="chapter-transition-content">
      <div class="transition-icon">✨</div>
      <p class="transition-message">${message}</p>
      <button class="btn-primary btn-transition" id="btn-chapter-next">다음 장소로 이동하기 →</button>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => overlay.classList.add('show'), 50);

  document.getElementById('btn-chapter-next').addEventListener('click', () => {
    overlay.classList.remove('show');
    setTimeout(() => {
      overlay.remove();
      callback();
    }, 400);
  });
}

// -------------------------------------------------------
// startChapter: 챕터 시작
// -------------------------------------------------------
function startChapter(chapterIndex) {
  GameState.currentChapter = chapterIndex;
  GameState.currentSituation = 0;

  updateBackground();
  updateProgressBar();

  const situation = getCurrentSituation();
  if (situation) {
    showSituation(situation);
  }
}

// -------------------------------------------------------
// goToEnding: 엔딩 화면으로 전환
// -------------------------------------------------------
function goToEnding() {
  showScreen('screen-ending');
  setTimeout(() => {
    initEnding();
  }, 600);
}

// -------------------------------------------------------
// 저장/불러오기 (localStorage)
// -------------------------------------------------------
function saveProgress() {
  const saveData = {
    playerName: GameState.playerName,
    scores: GameState.scores,
    currentChapter: GameState.currentChapter,
    currentSituation: GameState.currentSituation,
    responses: GameState.responses,
  };
  localStorage.setItem('dungledung_progress', JSON.stringify(saveData));
}

function loadProgress() {
  try {
    const saved = localStorage.getItem('dungledung_progress');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn('저장 데이터 불러오기 실패:', e);
  }
  return null;
}

function clearProgress() {
  localStorage.removeItem('dungledung_progress');
}

// -------------------------------------------------------
// 인트로 시퀀스
// -------------------------------------------------------
function startIntro() {
  showScreen('screen-intro');
  GameState.introStep = 0;

  // 인트로 배경 이미지 적용
  setTimeout(() => {
    const introScreen = document.getElementById('screen-intro');
    const bgImg = SPRITE_CONFIG.backgrounds.intro;
    if (introScreen && bgImg) {
      introScreen.classList.add('has-intro-image');
      introScreen.style.setProperty('--intro-bg-image', `url('${bgImg}')`);
    }
  }, 450);

  // 인트로 고양이 스프라이트 적용
  setTimeout(() => {
    const introNpc = document.getElementById('intro-npc');
    const catImg = SPRITE_CONFIG.characters.cat;
    if (introNpc && catImg) {
      introNpc.innerHTML = `
        <div class="npc-char-wrapper has-sprite-image" style="width:130px;height:150px;">
          <img src="${catImg}" alt="다정 고양이" class="npc-sprite-img"
            onerror="this.closest('.has-sprite-image').outerHTML='<div class=\\"char-cat\\"></div>'">
        </div>`;
    }
  }, 450);

  showIntroDialogue();
}

function showIntroDialogue() {
  const textEl = document.getElementById('intro-text');
  const dialogue = INTRO_DIALOGUES[GameState.introStep];
  if (!dialogue || !textEl) return;

  typeText(textEl, dialogue, 35);
}

function nextIntroStep() {
  // 타이핑 중이면 즉시 완료
  if (GameState.isTyping) {
    const textEl = document.getElementById('intro-text');
    skipTyping(textEl, INTRO_DIALOGUES[GameState.introStep]);
    return;
  }

  GameState.introStep++;
  if (GameState.introStep < INTRO_DIALOGUES.length) {
    showIntroDialogue();
  } else {
    // 인트로 완료 → 게임 화면으로
    showScreen('screen-game');
    setTimeout(() => {
      startChapter(0);
    }, 500);
  }
}

// -------------------------------------------------------
// 게임 초기화 (메인 진입점)
// -------------------------------------------------------
function initGame() {
  // API 키 불러오기
  loadApiKey();
  const savedKey = localStorage.getItem('dungledung_api_key');
  if (savedKey) {
    const apiInput = document.getElementById('api-key-input');
    if (apiInput) apiInput.value = savedKey;
  }

  // 저장된 진행상황 확인
  // (새 게임 시작 시 기존 진행상황은 무시)

  // 이벤트 리스너 설정
  setupEventListeners();
}

function setupEventListeners() {
  // API 키 화면: 시작 버튼
  const btnStart = document.getElementById('btn-start-game');
  if (btnStart) {
    btnStart.addEventListener('click', onClickStartGame);
  }

  // API 키 + 이름 입력에서 엔터 키
  const apiInput = document.getElementById('api-key-input');
  const nameInput = document.getElementById('player-name-input');
  if (apiInput) apiInput.addEventListener('keydown', e => { if (e.key === 'Enter') onClickStartGame(); });
  if (nameInput) nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') onClickStartGame(); });

  // 인트로 다음 버튼
  const btnIntroNext = document.getElementById('btn-intro-next');
  if (btnIntroNext) {
    btnIntroNext.addEventListener('click', nextIntroStep);
  }

  // 인트로 화면 클릭으로도 진행
  const introContent = document.querySelector('.intro-content');
  if (introContent) {
    introContent.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-intro-next')) {
        nextIntroStep();
      }
    });
  }

  // 게임 화면: 제출 버튼
  const btnSubmit = document.getElementById('btn-submit');
  if (btnSubmit) {
    btnSubmit.addEventListener('click', onPlayerSubmit);
  }

  // 텍스트에리어 Ctrl+Enter 또는 모바일 전송
  const playerInput = document.getElementById('player-input');
  if (playerInput) {
    playerInput.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onPlayerSubmit();
      }
    });
  }

  // 대화창 클릭 시 타이핑 스킵
  const dialogPanel = document.getElementById('dialog-panel');
  if (dialogPanel) {
    dialogPanel.addEventListener('click', (e) => {
      if (e.target.closest('.player-input-area') || e.target.closest('#btn-submit')) return;
      if (GameState.isTyping) {
        const npcDialogEl = document.getElementById('npc-dialog-text');
        const situation = getCurrentSituation();
        if (situation) {
          const level = getReactionLevel(situation.chapterType);
          skipTyping(npcDialogEl, situation[`npcDialogue_${level}`] || situation.npcDialogue_mid);
        }
      }
    });
  }

  // 다시 시작 버튼
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', restartGame);
  }
}

// -------------------------------------------------------
// 게임 시작 버튼 클릭 처리
// -------------------------------------------------------
function onClickStartGame() {
  const apiInput = document.getElementById('api-key-input');
  const nameInput = document.getElementById('player-name-input');

  const apiKey = apiInput ? apiInput.value.trim() : '';
  const playerName = nameInput ? nameInput.value.trim() : '';

  if (!apiKey || apiKey.length < 10) {
    showInputError(apiInput, 'API 키를 올바르게 입력해주세요 🔑');
    return;
  }

  if (!playerName) {
    showInputError(nameInput, '이름을 입력해주세요 🌸');
    return;
  }

  // API 키 및 이름 저장
  saveApiKey(apiKey);
  GameState.playerName = playerName;
  localStorage.setItem('dungledung_player_name', playerName);

  // 진행상황 초기화
  clearProgress();
  GameState.scores = { O: 50, C: 50, E: 50, A: 50, N: 50 };
  GameState.currentChapter = 0;
  GameState.currentSituation = 0;
  GameState.responses = { 0: [], 1: [], 2: [], 3: [], 4: [] };

  // 인트로 시작
  startIntro();
}

// 입력 에러 표시
function showInputError(inputEl, message) {
  if (!inputEl) return;
  inputEl.style.borderColor = '#FF6B6B';
  inputEl.placeholder = message;
  inputEl.value = '';
  inputEl.focus();
  setTimeout(() => {
    inputEl.style.borderColor = '';
    inputEl.placeholder = inputEl.id === 'api-key-input' ? 'AIza...' : '이름을 입력해주세요';
  }, 2500);
}

// -------------------------------------------------------
// 게임 재시작
// -------------------------------------------------------
function restartGame() {
  clearProgress();
  GameState.scores = { O: 50, C: 50, E: 50, A: 50, N: 50 };
  GameState.currentChapter = 0;
  GameState.currentSituation = 0;
  GameState.responses = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  GameState.introStep = 0;
  letterState.letters = [];
  letterState.openedCount = 0;

  // 엔딩 화면 초기화
  const mailboxArea = document.getElementById('mailbox-area');
  const finalResult = document.getElementById('final-result');
  const letterViewer = document.getElementById('letter-viewer');
  if (mailboxArea) { mailboxArea.style.display = 'flex'; }
  if (finalResult) { finalResult.style.display = 'none'; }
  if (letterViewer) { letterViewer.style.display = 'none'; }

  const btnShowResult = document.getElementById('btn-show-result');
  if (btnShowResult) btnShowResult.remove();

  showScreen('screen-api-key');
}

// -------------------------------------------------------
// DOM 로드 완료 시 게임 초기화
// -------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initGame();
});
