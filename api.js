// ============================================================
// api.js - Google Gemini API 연동 모듈
// 진단 기반: Big Five Factor Model (OCEAN)
// ============================================================

let geminiApiKey = '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

function saveApiKey(key) {
  geminiApiKey = key.trim();
  localStorage.setItem('dungledung_api_key', geminiApiKey);
}

function loadApiKey() {
  const saved = localStorage.getItem('dungledung_api_key');
  if (saved) geminiApiKey = saved;
  return geminiApiKey;
}

function clearApiKey() {
  geminiApiKey = '';
  localStorage.removeItem('dungledung_api_key');
}

// -------------------------------------------------------
// Gemini API 공통 호출 (429 에러 시 재시도 포함)
// -------------------------------------------------------
async function callGeminiAPI(prompt, retryCount = 0) {
  if (!geminiApiKey) throw new Error('API 키가 설정되지 않았습니다.');

  const MAX_RETRIES = 2;
  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.9 },
  };

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const waitTime = (retryCount + 1) * 2500;
      console.warn(`서버가 바빠요. ${waitTime}ms 후 재시도... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, waitTime));
      return callGeminiAPI(prompt, retryCount + 1);
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 호출 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.candidates || data.candidates.length === 0) throw new Error('API 응답이 비어있습니다.');
    return data.candidates[0].content.parts[0].text;
  } catch (err) {
    if (retryCount < MAX_RETRIES) {
      console.warn('네트워크 오류로 재시도:', err.message);
      await new Promise(r => setTimeout(r, 1500));
      return callGeminiAPI(prompt, retryCount + 1);
    }
    throw err;
  }
}

// -------------------------------------------------------
// analyzeResponse: 플레이어 답변 → Big Five OCEAN 점수 반환
// chapterType: 'E'|'O'|'A'|'C'|'N'
// 반환: { O, C, E, A, N } (각 0~100)
// -------------------------------------------------------
async function analyzeResponse(playerInput, situationContext, chapterType) {
  const dimensionNames = {
    O: 'O (Openness/개방성)',
    C: 'C (Conscientiousness/성실성)',
    E: 'E (Extraversion/외향성)',
    A: 'A (Agreeableness/우호성)',
    N: 'N (Neuroticism/감수성)',
  };

  const prompt = `당신은 심리 분석 AI입니다. Big Five 성격 모델(OCEAN)을 기반으로 분석하세요.

[Big Five 성분 설명]
- O (Openness/개방성): 새로운 경험·상상력·창의성 추구 vs 익숙함과 안정감 선호 (높을수록 개방적)
- C (Conscientiousness/성실성): 체계적 계획·자기통제·성취 지향 vs 융통성과 자유로운 흐름 (높을수록 계획적)
- E (Extraversion/외향성): 외부 세계와의 교류 에너지·사교성 vs 내면의 평온과 독립성 (높을수록 외향적)
- A (Agreeableness/우호성): 이타심·공감·협조·배려 vs 객관성과 논리적 판단 (높을수록 다정함)
- N (Neuroticism/감수성): 환경 변화에 예민한 감응·감정 반응의 깊이 vs 정서적 안정감 (높을수록 예민함)

[현재 상황]
${situationContext}

[주요 분석 성분]
이 상황에서는 특히 ${dimensionNames[chapterType] || chapterType} 성향을 집중 분석하세요.

[플레이어 답변]
"${playerInput}"

[지시사항]
반드시 아래 JSON 형식으로만 응답하세요. 설명 없이 JSON만 출력하세요.
각 점수는 0~100 사이 정수입니다. 중간값 50을 기준으로 답변 내용에 따라 조정하세요.

{"O":숫자,"C":숫자,"E":숫자,"A":숫자,"N":숫자}`;

  try {
    const result = await callGeminiAPI(prompt);
    const jsonMatch = result.match(/\{[^}]+\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        O: Math.min(100, Math.max(0, parseInt(parsed.O) || 50)),
        C: Math.min(100, Math.max(0, parseInt(parsed.C) || 50)),
        E: Math.min(100, Math.max(0, parseInt(parsed.E) || 50)),
        A: Math.min(100, Math.max(0, parseInt(parsed.A) || 50)),
        N: Math.min(100, Math.max(0, parseInt(parsed.N) || 50)),
      };
    }
    throw new Error('JSON 파싱 실패');
  } catch (err) {
    console.warn('analyzeResponse 실패, 기본값 반환:', err);
    return { O: 50, C: 50, E: 50, A: 50, N: 50 };
  }
}

// -------------------------------------------------------
// generateLetter: NPC가 플레이어에게 보내는 편지 생성
// -------------------------------------------------------
async function generateLetter(npcName, npcTrait, playerName, playerResponses, chapterTitle) {
  const responseSummary = playerResponses
    .slice(0, 5)
    .map((r, i) => `상황 ${i + 1}: "${r}"`)
    .join('\n');

  const prompt = `당신은 동화책 속 귀여운 동물 캐릭터 "${npcName}"입니다.
성격: ${npcTrait}
배경: 힐링 동화 마을 "${chapterTitle}"에서 플레이어와 함께 시간을 보낸 친구

플레이어 이름: ${playerName || '친애하는 친구'}
플레이어가 이 챕터에서 한 답변들:
${responseSummary}

위 답변들을 바탕으로 ${npcName}의 개성이 담긴 따뜻한 편지를 한국어로 작성하세요.

[편지 작성 지침]
- 플레이어가 실제로 했던 말이나 행동을 2개 이상 구체적으로 언급하여, 플레이어가 그 순간을 생생히 떠올릴 수 있게 하세요
- 그 말이나 행동을 보고 ${npcName}이(가) 실제로 느낀 감정을 진솔하게 표현하세요
- Big Five 관점에서 플레이어의 성향을 긍정적 언어로 조명하되, 모든 스타일에 가치가 있음을 담아주세요
- 250자 이내로 간결하게
- ${npcName}의 말투와 개성을 살려주세요
- 마지막에 서명: "${npcName}가 💌"
- 편지 본문만 출력 (제목 없이)`;

  try {
    const result = await callGeminiAPI(prompt);
    return result.trim();
  } catch (err) {
    console.warn('generateLetter 실패, 폴백 반환:', err);
    return null;
  }
}

// -------------------------------------------------------
// generateBridgeNarrative: 답변 후 다음 장면으로 이어지는 스토리
// -------------------------------------------------------
const FALLBACK_BRIDGE_TEXTS = [
  '마을의 바람이 살며시 불어왔어요. 이야기는 조용히 계속되었습니다.',
  '그 말이 공기 속에 살며시 녹아들었어요. 마을은 여전히 따뜻했습니다.',
  '고개를 끄덕인 친구가 부드럽게 미소 지었어요. 잠시 후 새로운 장면이 펼쳐졌습니다.',
  '어느새 햇살이 한 뼘 기울어져 있었어요. 이야기는 자연스럽게 흘러갔습니다.',
  '마을 어딘가에서 작은 새소리가 들렸어요. 모든 게 포근하게 이어졌습니다.',
];

async function generateBridgeNarrative(playerAnswer, npcName, npcTrait, chapterTitle, nextHint, playerName) {
  const prompt = `당신은 힐링 동화 "둥글둥글 감정마을"의 따뜻한 나레이터입니다.

[현재 장면]
마을: ${chapterTitle}
함께하는 친구: ${npcName}${npcTrait ? ` (${npcTrait})` : ''}
플레이어 이름: ${playerName || '여행자'}

[플레이어가 한 말]
"${playerAnswer}"

[다음에 이어질 장면 힌트]
${nextHint || '이야기가 자연스럽게 마무리돼요.'}

[작성 지침]
- 플레이어의 말을 옳고 그름 없이, 있는 그대로 따뜻하게 받아들이며 써주세요
- ${npcName}이(가) 자연스럽게 반응하는 장면을 넣어도 좋아요
- 다음 장면 힌트를 바탕으로 이야기가 부드럽게 이어지도록 마무리하세요
- 2~3문장, 동화책처럼 포근하고 감성적인 문체
- 본문만 출력하세요`;

  try {
    const result = await callGeminiAPI(prompt);
    return result.trim();
  } catch (err) {
    console.warn('generateBridgeNarrative 실패, 폴백 사용:', err);
    return FALLBACK_BRIDGE_TEXTS[Math.floor(Math.random() * FALLBACK_BRIDGE_TEXTS.length)];
  }
}

// -------------------------------------------------------
// generateBlessingMessage: OCEAN 점수 기반 마음의 색깔 + 축복 메시지 생성
// 반환: { colorKeyword: string, message: string }
// -------------------------------------------------------
async function generateBlessingMessage(oceanScores, playerName, allResponses) {
  const { O, C, E, A, N } = oceanScores;
  const sampleResponses = allResponses.slice(0, 6).join(' | ');

  const prompt = `당신은 심리 힐링 동화의 나레이터입니다. Big Five 성격 모델(OCEAN)을 깊이 이해하는 따뜻한 안내자입니다.

플레이어 이름: ${playerName || '소중한 여행자'}

[Big Five OCEAN 스탯]
- O (개방성/상상력): ${O}/100 → ${O >= 60 ? '새로운 경험과 상상력이 풍부함' : O <= 40 ? '익숙하고 안정적인 것을 선호함' : '균형 잡힌 탐구심'}
- C (성실성/계획성): ${C}/100 → ${C >= 60 ? '체계적이고 계획적임' : C <= 40 ? '유연하고 자유로운 흐름을 선호함' : '상황에 맞게 유연하게 조율함'}
- E (외향성/사교성): ${E}/100 → ${E >= 60 ? '사람들과 함께할 때 에너지를 얻음' : E <= 40 ? '내면의 평온과 독립성을 중시함' : '상황에 따라 균형 있게 교류함'}
- A (우호성/다정함): ${A}/100 → ${A >= 60 ? '공감과 이타심이 뛰어남' : A <= 40 ? '객관적이고 논리적인 판단을 중시함' : '공감과 논리 사이에서 균형을 이룸'}
- N (감수성/정서적 섬세함): ${N}/100 → ${N >= 60 ? '감정 변화에 깊이 감응함' : N <= 40 ? '흔들림 없는 정서적 안정감을 가짐' : '적당한 감수성과 안정감을 모두 지님'}

[여행 중 한 답변들]
"${sampleResponses}"

이 플레이어만의 고유한 마음의 색깔을 자연 이미지로 표현하고, 축복 메시지를 작성해주세요.

[중요] Big Five의 철학: 높은 점수도, 낮은 점수도 모두 고유한 가치를 지닙니다. 어떤 성향도 '더 좋다'거나 '더 나쁘다'고 평가하지 마세요.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "colorKeyword": "자연의 이미지를 담은 시적인 한 문장 (예: 따뜻한 봄비 내리는 숲속의 은은한 햇살). 이 플레이어의 OCEAN 조합을 반영한 독특한 표현",
  "message": "3~4문장의 따뜻하고 시적인 축복 메시지. 이 플레이어의 OCEAN 스탯 조합이 가진 고유한 아름다움을 진심으로 조명하되, 모든 성향의 양극단이 가진 가치를 담아 힐링 엔딩을 선사하세요."
}`;

  try {
    const result = await callGeminiAPI(prompt);
    const jsonMatch = result.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        colorKeyword: parsed.colorKeyword || '세상에 하나뿐인 특별한 마음',
        message: parsed.message || `${playerName || '당신'}만의 마음의 색깔은 이 세상 어디에도 없는 특별한 것이에요. 💕`,
      };
    }
    throw new Error('JSON 파싱 실패');
  } catch (err) {
    console.warn('generateBlessingMessage 실패:', err);
    return {
      colorKeyword: '세상에 하나뿐인 따뜻한 마음',
      message: `${playerName || '당신'}이 이 마을을 여행하며 보여준 솔직한 마음이 아름다워요. 어떤 성향이든, 그 모습 그대로 충분히 특별하고 소중합니다. 당신의 마음이 가진 고유한 색깔을 언제나 사랑해주세요. 💕`,
    };
  }
}

// -------------------------------------------------------
// 로딩 UI 제어
// -------------------------------------------------------
function showLoading(message = '잠깐, 친구들이 네 마음을 읽고 있어... 🌸') {
  const overlay = document.getElementById('loading-overlay');
  const text = document.getElementById('loading-text');
  if (overlay) {
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.style.display = 'none';
}

function showEndingLoading(message = '친구들이 편지를 쓰고 있어요... ✉️') {
  const overlay = document.getElementById('ending-loading');
  const text = document.getElementById('ending-loading-text');
  if (overlay) {
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
  }
}

function hideEndingLoading() {
  const overlay = document.getElementById('ending-loading');
  if (overlay) overlay.style.display = 'none';
}
