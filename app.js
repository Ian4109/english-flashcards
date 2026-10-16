"use strict";

const demoWords = [
  { english: "curious", chinese: "好奇的", example: "The child is curious about the world." },
  { english: "journey", chinese: "旅程", example: "Our journey starts today." },
  { english: "gentle", chinese: "溫柔的；輕柔的", example: "A gentle breeze moves the leaves." },
  { english: "discover", chinese: "發現", example: "We discover something new every day." },
  { english: "bright", chinese: "明亮的", example: "The room is bright and warm." },
  { english: "practice", chinese: "練習", example: "I practice English every morning." }
];
let words = demoWords;

const word = document.querySelector("#word");
const example = document.querySelector("#example");
const translation = document.querySelector("#translation");
const hint = document.querySelector("#hint");
const progress = document.querySelector("#progress");
const progressBar = document.querySelector("#progress-bar");
const toggleButton = document.querySelector("#toggle-answer");
let currentIndex = 0;
let roundWords = [];
let roundFinished = false;
const nextButton = document.querySelector("#next-card");

function startRound(reuse = false) {
  if (!reuse) {
    // Keep the first entry for each English word to avoid duplicates in a round.
    const seen = new Set();
    const pool = words.filter(entry => {
      const key = entry.english.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    roundWords = pool.slice(0, 10);
  }
  currentIndex = 0;
  roundFinished = false;
  nextButton.disabled = false;
  toggleButton.disabled = false;
  document.querySelector("#quiz").hidden = true;
  document.querySelector("#round-complete").hidden = true;
  document.querySelector("#practice-card").hidden = false;
  document.querySelector("#practice-actions").hidden = false;
  renderCard();
}

function setAnswerVisible(visible) {
  translation.hidden = !visible;
  hint.hidden = visible;
  toggleButton.textContent = visible ? "收起中文" : "翻開中文";
  toggleButton.setAttribute("aria-expanded", String(visible));
}

function renderCard() {
  const current = roundWords[currentIndex];
  word.textContent = current.english;
  example.textContent = current.example;
  translation.textContent = current.chinese;
  progress.textContent = `第 ${currentIndex + 1} / ${roundWords.length} 張`;
  progressBar.max = roundWords.length;
  progressBar.value = currentIndex + 1;
  nextButton.textContent = currentIndex === roundWords.length - 1 ? "開始 POP QUIZ" : "下一張 →";
  document.querySelector("#deck-summary").textContent = `字彙表共 ${words.length} 筆 · 本回合 ${roundWords.length} 個不重複單字`;
  setAnswerVisible(false);
}

toggleButton.addEventListener("click", () => setAnswerVisible(translation.hidden));
nextButton.addEventListener("click", () => {
  if (roundFinished) return;
  if (currentIndex === roundWords.length - 1) {
    roundFinished = true;
    startQuiz();
    return;
  }
  currentIndex++;
  renderCard();
});
document.querySelector("#retry-round").addEventListener("click", () => {
  startRound(true);
  toggleButton.focus();
});
document.querySelector("#new-round").addEventListener("click", () => {
  startRound();
  toggleButton.focus();
});

// CSV supports quoted commas, escaped quotes, and line breaks inside fields.
function parseVocabulary(text) {
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  function finishField() { row.push(field.trim()); field = ""; closed = false; }
  function finishRow() {
    finishField();
    if (row.some(value => value !== "")) rows.push(row);
    row = [];
  }
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ",") finishField();
    else if (char === "\n") finishRow();
    else if (closed) {
      if (!/\s/.test(char)) throw new Error("引號後只能接逗號或換行，請檢查 CSV 格式。");
    } else if (char === '"') {
      if (field.trim()) throw new Error("欄位內的引號請以兩個雙引號表示。");
      field = ""; quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error("CSV 有未關閉的雙引號，請檢查檔案。");
  finishRow();
  const header = rows.shift();
  const aliases = { english: "english", chinese: "chinese", example: "example", "英文": "english", "中文": "chinese", "例句": "example" };
  const keys = header?.map(value => aliases[value.toLowerCase()]);
  if (!keys || keys.length !== 3 || new Set(keys).size !== 3 || keys.some(key => !key)) {
    throw new Error("第一列須包含英文、中文、例句三個欄位，請參考下載範本。");
  }
  if (!rows.length) throw new Error("檔案沒有單字，請在標題列下加入字彙。");
  return rows.map((values, index) => {
    if (values.length !== 3) throw new Error(`第 ${index + 1} 筆資料須有三個欄位；例句內若有逗號，請以雙引號包住。`);
    const entry = Object.fromEntries(keys.map((key, i) => [key, values[i]]));
    if (!entry.english || !entry.chinese) throw new Error(`第 ${index + 1} 筆資料缺少英文或中文。`);
    return entry;
  });
}

const fileInput = document.querySelector("#vocabulary-file");
const importStatus = document.querySelector("#import-status");
let importVersion = 0;
fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const version = ++importVersion;
  importStatus.classList.remove("error");
  importStatus.textContent = "正在讀取字彙表…";
  try {
    if (file.size > 1024 * 1024) throw new Error("檔案超過 1 MB，請分成較小的字彙表。");
    const buffer = await file.arrayBuffer();
    let text;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
    catch { throw new Error("無法讀取編碼，請將檔案另存為 CSV UTF-8 後重試。"); }
    const imported = parseVocabulary(text);
    if (version !== importVersion) return;
    words = imported;
    startRound();
    importStatus.textContent = `已匯入「${file.name}」，共 ${words.length} 個單字。`;
  } catch (error) {
    if (version !== importVersion) return;
    importStatus.classList.add("error");
    importStatus.textContent = `匯入失敗：${error.message} 目前字彙表已保留。`;
  } finally {
    if (version === importVersion) fileInput.value = "";
  }
});

document.querySelector("#restore-demo").addEventListener("click", () => {
  importVersion++;
  words = demoWords;
  currentIndex = 0;
  fileInput.value = "";
  startRound();
  importStatus.classList.remove("error");
  importStatus.textContent = "已恢復 6 個示範單字。";
});

document.querySelector("#download-template").addEventListener("click", () => {
  const csv = '\uFEFF英文,中文,例句\r\napple,蘋果,I eat an apple every day.\r\nexplore,探索,"Let’s explore the city, together."\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "vocabulary-template.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// Strip study-history labels from quiz clues and record identities.
function meaning(entry) { return entry.chinese.replace(/^.*?｜/, "").trim(); }
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
const mistakeKey = "english-flashcards-mistakes-v1";
let mistakes = [];
try {
  const saved = JSON.parse(localStorage.getItem(mistakeKey) || "[]");
  if (!Array.isArray(saved) || !saved.every(item => item &&
    [item.english, item.chinese, item.lastAnswer, item.lastAt].every(value => typeof value === "string") &&
    Number.isSafeInteger(item.count) && item.count > 0)) throw new Error("Invalid saved records");
  mistakes = saved;
} catch {
  document.querySelector("#storage-status").textContent = "無法讀取已存紀錄。本次錯題仍可查看；請允許瀏覽器儲存網站資料。";
}
function renderMistakes() {
  document.querySelector("#mistakes-summary").textContent = mistakes.length
    ? `${mistakes.length} 個錯題字彙 · 累計答錯 ${mistakes.reduce((sum, item) => sum + item.count, 0)} 次`
    : "還沒有錯題紀錄，完成 POP QUIZ 後會自動累積。";
  const list = document.querySelector("#mistakes-list");
  list.replaceChildren();
  [...mistakes].sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt)).forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.english} — ${item.chinese}｜答錯 ${item.count} 次｜最近選答：${item.lastAnswer}｜${new Date(item.lastAt).toLocaleString("zh-TW")}`;
    list.append(li);
  });
}
function recordMistake(entry, answer) {
  const chinese = meaning(entry);
  let record = mistakes.find(item => item.english.toLowerCase() === entry.english.toLowerCase() && item.chinese === chinese);
  if (!record) {
    record = { english: entry.english, chinese, count: 0, lastAnswer: "", lastAt: "" };
    mistakes.push(record);
  }
  record.count++;
  record.lastAnswer = answer;
  record.lastAt = new Date().toISOString();
  try { localStorage.setItem(mistakeKey, JSON.stringify(mistakes)); }
  catch { document.querySelector("#storage-status").textContent = "儲存失敗：本次錯題僅暫存在頁面中，關閉或重新整理可能遺失。"; }
  renderMistakes();
}
let quizWords = [], quizIndex = 0, quizScore = 0, answered = false;
const quizNext = document.querySelector("#quiz-next");
function startQuiz() {
  quizWords = shuffle(roundWords);
  quizIndex = 0;
  quizScore = 0;
  document.querySelector("#practice-card").hidden = true;
  document.querySelector("#practice-actions").hidden = true;
  document.querySelector("#quiz").hidden = false;
  renderQuestion();
}
function renderQuestion() {
  answered = false;
  const entry = quizWords[quizIndex];
  progress.textContent = `POP QUIZ ${quizIndex + 1} / ${quizWords.length}`;
  progressBar.max = quizWords.length;
  progressBar.value = quizIndex + 1;
  document.querySelector("#quiz-title").textContent = meaning(entry);
  document.querySelector("#quiz-feedback").textContent = "";
  quizNext.hidden = true;
  quizNext.textContent = quizIndex === quizWords.length - 1 ? "查看成績" : "下一題";
  const options = document.querySelector("#quiz-options");
  options.replaceChildren();
  const senses = value => meaning(value).split(/[；;、，,]/).map(s => s.trim()).filter(Boolean);
  const used = new Set([entry.english.toLowerCase()]);
  const alternatives = shuffle(words).filter(candidate => {
    const key = candidate.english.toLowerCase();
    if (used.has(key) || senses(candidate).some(s => senses(entry).includes(s))) return false;
    used.add(key);
    return true;
  }).slice(0, 3);
  // A tiny deck may have no valid distractors: use spelling instead.
  document.querySelector("#quiz-form").hidden = alternatives.length > 0;
  document.querySelector("#quiz-mode").textContent = alternatives.length ? "POP QUIZ · 看中文，選英文" : "POP QUIZ · 看中文，寫英文";
  document.querySelector("#quiz-instruction").textContent = alternatives.length ? "選出本回合學過、符合這個意思的單字。" : "可用選項不足，請寫出本回合學過的英文單字。";
  document.querySelector("#quiz-input").value = "";
  document.querySelector("#quiz-input").disabled = false;
  document.querySelector('#quiz-form button').disabled = false;
  if (alternatives.length) shuffle([entry, ...alternatives]).forEach(option => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.english;
    button.addEventListener("click", () => submitAnswer(option.english));
    options.append(button);
  });
  document.querySelector("#quiz-title").focus();
}
function submitAnswer(answer) {
  if (answered) return;
  const entry = quizWords[quizIndex];
  const normalized = text => text.trim().replace(/\s+/g, " ").toLowerCase();
  if (!answer.trim()) {
    document.querySelector("#quiz-feedback").textContent = "請先輸入英文答案。";
    return;
  }
  answered = true;
  const correct = normalized(answer) === normalized(entry.english);
  if (correct) quizScore++;
  else recordMistake(entry, answer);
  document.querySelectorAll('#quiz-options button').forEach(button => {
    button.disabled = true;
    if (button.textContent === entry.english) button.classList.add("correct");
    else if (button.textContent === answer) button.classList.add("incorrect");
  });
  document.querySelector("#quiz-input").disabled = true;
  document.querySelector('#quiz-form button').disabled = true;
  document.querySelector("#quiz-feedback").textContent = `${correct ? "答對了！" : "答錯了，已加入累積錯題。"} 正解：${entry.english} — ${meaning(entry)}${entry.example ? `。例句：${entry.example}` : ""}`;
  quizNext.hidden = false;
  quizNext.focus();
}
document.querySelector("#quiz-form").addEventListener("submit", event => {
  event.preventDefault();
  submitAnswer(document.querySelector("#quiz-input").value);
});
quizNext.addEventListener("click", () => {
  if (!answered) return;
  quizIndex++;
  if (quizIndex < quizWords.length) { renderQuestion(); return; }
  answered = false;
  document.querySelector("#quiz").hidden = true;
  document.querySelector("#round-complete").hidden = false;
  document.querySelector("#completion-summary").textContent = `POP QUIZ：${quizScore} / ${quizWords.length} 題答對（${Math.round(quizScore / quizWords.length * 100)}%）。本次答錯 ${quizWords.length - quizScore} 題，已累積到錯題紀錄。`;
  progress.textContent = `測驗完成 ${quizWords.length} / ${quizWords.length}`;
  document.querySelector("#completion-title").focus();
});
renderMistakes();
startRound();

async function loadWebsiteVocabulary() {
  const version = importVersion;
  if (location.protocol === "file:") {
    importStatus.textContent = "本機直接開啟時請手動匯入 CSV；正式網站會自動載入字彙表。目前使用示範單字。";
    return;
  }
  nextButton.disabled = true;
  toggleButton.disabled = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch("vocabulary.csv", { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 1024 * 1024) throw new Error("字彙表超過 1 MB");
    const imported = parseVocabulary(new TextDecoder("utf-8", { fatal: true }).decode(buffer));
    if (version !== importVersion) return;
    words = imported;
    startRound();
    importStatus.classList.remove("error");
    importStatus.textContent = `已自動載入網站字彙表，共 ${words.length} 個單字。`;
  } catch {
    if (version !== importVersion) return;
    importStatus.classList.add("error");
    importStatus.textContent = "網站字彙表暫時無法載入，先使用示範單字。你可以手動匯入 CSV 或重新整理重試。";
  } finally {
    clearTimeout(timeout);
    nextButton.disabled = false;
    toggleButton.disabled = false;
  }
}
loadWebsiteVocabulary();
