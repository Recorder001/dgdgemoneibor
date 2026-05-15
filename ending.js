// ============================================================
// ending.js - 편지 및 엔딩 시스템
// Big Five OCEAN 기반 5통의 NPC 편지 + 마음의 색깔 결과
// ============================================================

const letterState = {
  letters: [],
  openedCount: 0,
  currentLetter: -1,
};

// -------------------------------------------------------
// collectLetters: 5개 NPC 편지 생성
// -------------------------------------------------------
async function collectLetters() {
  showEndingLoading('친구들이 편지를 쓰고 있어요... ✉️');

  const chapterNPCs = [
    {
      chapterIndex: 0,
      npcKey: 'quokka',
      npcName: '쿼카',
      npcTrait: '에너지 넘치고 사교적인 친구',
      chapterTitle: '광장 축제',
      fallbackKey: 'chapter1',
    },
    {
      chapterIndex: 1,
      npcKey: 'sheep',
      npcName: '아기 양',
      npcTrait: '상상력 풍부하고 몽환적인 친구',
      chapterTitle: '반짝이 숲길',
      fallbackKey: 'chapter2',
    },
    {
      chapterIndex: 2,
      npcKey: 'maru',
      npcName: '리트리버 마루',
      npcTrait: '따뜻하고 공감력 높은 친구',
      chapterTitle: '호숫가 찻집',
      fallbackKey: 'chapter3',
    },
    {
      chapterIndex: 3,
      npcKey: 'raccoon',
      npcName: '너구리 역장',
      npcTrait: '체계적이고 믿음직한 친구',
      chapterTitle: '칙칙폭폭 간이역',
      fallbackKey: 'chapter4',
    },
    {
      chapterIndex: 4,
      npcKey: 'snail',
      npcName: '달팽이',
      npcTrait: '느긋하고 섬세한 친구',
      chapterTitle: '비 내리는 정원',
      fallbackKey: 'chapter5',
    },
  ];

  letterState.letters = [];

  for (let i = 0; i < chapterNPCs.length; i++) {
    const npcInfo = chapterNPCs[i];
    const responses = GameState.responses[npcInfo.chapterIndex] || [];

    showEndingLoading(`${npcInfo.npcName}이(가) 편지를 쓰고 있어요... ✉️ (${i + 1}/5)`);

    if (i > 0) await new Promise(res => setTimeout(res, 800));

    try {
      const letterContent = await generateLetter(
        npcInfo.npcName,
        npcInfo.npcTrait,
        GameState.playerName,
        responses,
        npcInfo.chapterTitle
      );

      letterState.letters.push({
        npcKey: npcInfo.npcKey,
        npcName: npcInfo.npcName,
        content: letterContent || FALLBACK_LETTERS[npcInfo.fallbackKey].content,
        opened: false,
      });
    } catch (err) {
      letterState.letters.push({
        npcKey: npcInfo.npcKey,
        npcName: npcInfo.npcName,
        content: FALLBACK_LETTERS[npcInfo.fallbackKey].content,
        opened: false,
      });
    }
  }

  hideEndingLoading();
  renderLetterGrid();
}

// -------------------------------------------------------
// renderLetterGrid: 편지함 그리드 렌더링 (5통)
// -------------------------------------------------------
function renderLetterGrid() {
  const grid = document.getElementById('letters-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const npcColors = {
    quokka:   '#FFD580',
    sheep:    '#C9B1FF',
    maru:     '#FFCBA4',
    raccoon:  '#D4A5A5',
    snail:    '#D4C4A8',
  };

  const npcEmojis = {
    quokka:   '🌻',
    sheep:    '🐑',
    maru:     '🐕',
    raccoon:  '🦝',
    snail:    '🐌',
  };

  letterState.letters.forEach((letter, index) => {
    const letterEl = document.createElement('div');
    letterEl.className = 'letter-envelope';
    letterEl.setAttribute('data-index', index);

    const color = npcColors[letter.npcKey] || '#FFD580';
    const emoji = npcEmojis[letter.npcKey] || '✉️';

    letterEl.innerHTML = `
      <div class="envelope-body" style="background: linear-gradient(135deg, ${color}, ${color}cc)">
        <div class="envelope-seal">${emoji}</div>
        <div class="envelope-from">${letter.npcName}에게서</div>
        <div class="envelope-status">${letter.opened ? '읽음 ✓' : '새 편지 💌'}</div>
      </div>
    `;

    if (letter.opened) letterEl.classList.add('opened');
    letterEl.addEventListener('click', () => openLetter(index));
    grid.appendChild(letterEl);
  });
}

// -------------------------------------------------------
// openLetter: 편지 열기
// -------------------------------------------------------
function openLetter(index) {
  if (index < 0 || index >= letterState.letters.length) return;

  const letter = letterState.letters[index];
  letterState.currentLetter = index;

  if (!letter.opened) {
    letter.opened = true;
    letterState.openedCount++;
  }

  const viewer = document.getElementById('letter-viewer');
  const from = document.getElementById('letter-from');
  const body = document.getElementById('letter-body');
  const signature = document.getElementById('letter-signature');
  const mailboxArea = document.getElementById('mailbox-area');

  if (!viewer) return;

  if (from) from.textContent = `${letter.npcName} 으로부터`;
  if (body) {
    body.innerHTML = letter.content
      .split('\n')
      .map(line => line === '' ? '<br>' : `<p>${line}</p>`)
      .join('');
  }
  if (signature) signature.textContent = letter.npcName;

  if (mailboxArea) mailboxArea.style.display = 'none';
  viewer.style.display = 'block';
  viewer.classList.add('letter-open-anim');

  renderLetterGrid();
}

// -------------------------------------------------------
// closeLetter: 편지 닫기
// -------------------------------------------------------
function closeLetter() {
  const viewer = document.getElementById('letter-viewer');
  const mailboxArea = document.getElementById('mailbox-area');

  if (viewer) {
    viewer.classList.remove('letter-open-anim');
    viewer.style.display = 'none';
  }
  if (mailboxArea) mailboxArea.style.display = 'flex';

  letterState.currentLetter = -1;

  if (letterState.openedCount >= 5) {
    showFinalResultButton();
  }
}

// -------------------------------------------------------
// showFinalResultButton: '최종 결과 보기' 버튼
// -------------------------------------------------------
function showFinalResultButton() {
  const mailboxArea = document.getElementById('mailbox-area');
  if (!mailboxArea || document.getElementById('btn-show-result')) return;

  const btn = document.createElement('button');
  btn.id = 'btn-show-result';
  btn.className = 'btn-primary btn-show-result';
  btn.textContent = '나의 감정 여행 결과 보기 ✨';
  btn.addEventListener('click', showFinalResult);
  mailboxArea.appendChild(btn);
}

// -------------------------------------------------------
// showFinalResult: Big Five OCEAN 결과 + 마음의 색깔
// -------------------------------------------------------
async function showFinalResult() {
  const mailboxArea = document.getElementById('mailbox-area');
  const finalResult = document.getElementById('final-result');
  if (!finalResult) return;

  if (mailboxArea) mailboxArea.style.display = 'none';

  const scores = GameState.scores; // { O, C, E, A, N }

  const keywordEl    = document.getElementById('result-keyword');
  const descEl       = document.getElementById('result-description');
  const barsEl       = document.getElementById('personality-bars');
  const blessingEl   = document.getElementById('blessing-message');
  const typeCodeEl   = document.getElementById('result-type-code');
  const typePercentEl = document.getElementById('result-percentages');

  // 즉시 표시 가능한 부분
  if (typeCodeEl) typeCodeEl.textContent = 'Big Five OCEAN';
  if (typePercentEl) typePercentEl.innerHTML = renderTypePercentages(scores);
  if (keywordEl) keywordEl.textContent = '✨ 마음의 색깔을 찾고 있어요...';
  if (descEl) descEl.textContent = '';
  if (barsEl) barsEl.innerHTML = renderPersonalityBars(scores);

  finalResult.style.display = 'block';
  finalResult.classList.add('fade-in');

  // Gemini로 마음의 색깔 + 축복 메시지 생성
  if (blessingEl) {
    blessingEl.textContent = '마음을 담은 메시지를 준비하는 중이에요... 🌸';
    showEndingLoading('마을이 당신에게 마지막 선물을 준비하고 있어요... 🌟');

    const allResponses = Object.values(GameState.responses).flat();
    const result = await generateBlessingMessage(scores, GameState.playerName, allResponses);

    hideEndingLoading();

    if (keywordEl) keywordEl.textContent = `✨ ${result.colorKeyword}`;

    if (blessingEl) {
      blessingEl.textContent = '';
      await typeTextElement(blessingEl, result.message, 30);
    }
  }
}

// -------------------------------------------------------
// renderTypePercentages: OCEAN 5차원 백분율 표시
// -------------------------------------------------------
function renderTypePercentages(scores) {
  const dims = [
    { label: 'O 개방성', value: scores.O },
    { label: 'C 성실성', value: scores.C },
    { label: 'E 외향성', value: scores.E },
    { label: 'A 우호성', value: scores.A },
    { label: 'N 감수성', value: scores.N },
  ];
  return dims.map(d => `
    <span class="type-pct-item">
      <strong>${d.label}</strong> ${d.value}%
    </span>
  `).join('');
}

// -------------------------------------------------------
// renderPersonalityBars: OCEAN 5개 성향 바
// -------------------------------------------------------
function renderPersonalityBars(scores) {
  const bars = [
    {
      label1: '몽글몽글 상상력 (O)',
      label2: '익숙함 선호',
      value: scores.O,
      colorL: '#C9B1FF',
      colorR: '#D4C8B8',
    },
    {
      label1: '차곡차곡 계획성 (C)',
      label2: '자유로운 흐름',
      value: scores.C,
      colorL: '#D4A5A5',
      colorR: '#FFC8A2',
    },
    {
      label1: '꼬리 프로펠러 사교성 (E)',
      label2: '내면의 평온',
      value: scores.E,
      colorL: '#FFD580',
      colorR: '#A0C4FF',
    },
    {
      label1: '말랑말랑 다정함 (A)',
      label2: '논리적 판단',
      value: scores.A,
      colorL: '#FFCBA4',
      colorR: '#AED6DC',
    },
    {
      label1: '바스락 감수성 (N)',
      label2: '흔들림 없는 안정',
      value: scores.N,
      colorL: '#B5EAD7',
      colorR: '#90C8D0',
    },
  ];

  return bars.map(bar => `
    <div class="personality-bar-item">
      <div class="bar-labels">
        <span class="bar-label-left">${bar.label1} <strong>${bar.value}%</strong></span>
        <span class="bar-label-right"><strong>${100 - bar.value}%</strong> ${bar.label2}</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${bar.value}%; background: linear-gradient(to right, ${bar.colorL}, ${bar.colorR})"></div>
        <div class="bar-marker" style="left:${bar.value}%"></div>
      </div>
    </div>
  `).join('');
}

// -------------------------------------------------------
// typeTextElement: 특정 엘리먼트에 타이핑 효과
// -------------------------------------------------------
function typeTextElement(element, text, speed = 40) {
  return new Promise(resolve => {
    let i = 0;
    element.textContent = '';
    document.body.classList.add('typing-active');
    const interval = setInterval(() => {
      if (i < text.length) {
        element.textContent += text[i];
        i++;
      } else {
        clearInterval(interval);
        document.body.classList.remove('typing-active');
        resolve();
      }
    }, speed);
  });
}

// -------------------------------------------------------
// initEnding: 엔딩 화면 초기화
// -------------------------------------------------------
async function initEnding() {
  const btnClose = document.getElementById('btn-close-letter');
  if (btnClose) btnClose.addEventListener('click', closeLetter);

  await collectLetters();
}
