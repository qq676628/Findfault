const GAME_DATA = window.GAME_LEVEL_DATA || { sessionConfig: {}, levels: [] };
const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

const levelMap = new Map(GAME_DATA.levels.map((level) => [level.id, level]));
const sessionConfig = {
  practicePool: GAME_DATA.sessionConfig.practicePool || ["practice-01"],
  formalPool: GAME_DATA.sessionConfig.formalPool || [],
  formalSelection: GAME_DATA.sessionConfig.formalSelection || "random-one",
  formalAttempts: GAME_DATA.sessionConfig.formalAttempts || 1,
  wrongTapPenaltySeconds: GAME_DATA.sessionConfig.wrongTapPenaltySeconds || 2,
};

const dom = {
  viewportShell: document.querySelector("#viewportShell"),
  designRoot: document.querySelector("#designRoot"),
  introPanel: document.querySelector("#introPanel"),
  hudPanel: document.querySelector("#hudPanel"),
  resultPanel: document.querySelector("#resultPanel"),
  startButton: document.querySelector("#startButton"),
  leftBoard: document.querySelector("#leftBoard"),
  rightBoard: document.querySelector("#rightBoard"),
  leftImage: document.querySelector("#leftImage"),
  rightImage: document.querySelector("#rightImage"),
  leftMarkers: document.querySelector("#leftMarkers"),
  rightMarkers: document.querySelector("#rightMarkers"),
  stageTimer: document.querySelector("#stageTimer"),
  stageTimerLabel: document.querySelector("#stageTimerLabel"),
  stageTimerValue: document.querySelector("#stageTimerValue"),
  stageTimerFill: document.querySelector("#stageTimerFill"),
  stageAiLabel: document.querySelector("#stageAiLabel"),
  stageAiMessage: document.querySelector("#stageAiMessage"),
  endScreen: document.querySelector("#endScreen"),
  endScreenTitle: document.querySelector("#endScreenTitle"),
  endScreenSummary: document.querySelector("#endScreenSummary"),
  endPlayerTime: document.querySelector("#endPlayerTime"),
  endAiTime: document.querySelector("#endAiTime"),
  endLeadTime: document.querySelector("#endLeadTime"),
  endScreenButton: document.querySelector("#endScreenButton"),
  levelTitle: document.querySelector("#levelTitle"),
  timerValue: document.querySelector("#timerValue"),
  playerProgress: document.querySelector("#playerProgress"),
  aiProgress: document.querySelector("#aiProgress"),
  aiFill: document.querySelector("#aiFill"),
  aiPercent: document.querySelector("#aiPercent"),
  aiMessage: document.querySelector("#aiMessage"),
  hudActions: document.querySelector("#hudActions"),
  feedbackText: document.querySelector("#feedbackText"),
  resultTag: document.querySelector("#resultTag"),
  resultTitle: document.querySelector("#resultTitle"),
  resultSummary: document.querySelector("#resultSummary"),
  resultFound: document.querySelector("#resultFound"),
  resultTime: document.querySelector("#resultTime"),
  resultAiTime: document.querySelector("#resultAiTime"),
  resultActions: document.querySelector("#resultActions"),
};

const state = {
  phase: "home",
  activeLevelId: null,
  formalLevelId: null,
  formalAttemptUsed: false,
  practicePassed: false,
  foundIds: new Set(),
  isPlaying: false,
  startTime: 0,
  elapsedMs: 0,
  timeLeftMs: 0,
  aiFoundCount: 0,
  aiMessage: "AI 待命中，准备扫描冷柜陈列...",
  rafId: 0,
  result: null,
};

function fitDesignCanvas() {
  if (!dom.viewportShell || !dom.designRoot) return;
  const viewportWidth = dom.viewportShell.clientWidth || window.innerWidth;
  const viewportHeight = dom.viewportShell.clientHeight || window.innerHeight;
  const scale = Math.min(viewportWidth / DESIGN_WIDTH, viewportHeight / DESIGN_HEIGHT);
  dom.designRoot.style.setProperty("--design-scale", `${scale}`);
}

function currentLevel() {
  return levelMap.get(state.activeLevelId);
}

function formatSeconds(ms) {
  return (Math.max(ms, 0) / 1000).toFixed(1);
}

function currentAiCompleteMs() {
  const level = currentLevel();
  return level.aiScript[level.aiScript.length - 1].atMs;
}

function updateFeedback(message) {
  dom.feedbackText.textContent = message;
}

function clearMarkers() {
  dom.leftMarkers.innerHTML = "";
  dom.rightMarkers.innerHTML = "";
}

function makeMarker(point, container) {
  const level = currentLevel();
  const marker = document.createElement("span");
  marker.className = "marker";
  marker.style.left = `${(point.x / level.naturalSize.width) * 100}%`;
  marker.style.top = `${(point.y / level.naturalSize.height) * 100}%`;
  container.append(marker);
}

function renderFoundMarkers() {
  const level = currentLevel();
  clearMarkers();
  level.hotspots
    .filter((hotspot) => state.foundIds.has(hotspot.id))
    .forEach((hotspot) => {
      makeMarker(hotspot, dom.leftMarkers);
      makeMarker(hotspot, dom.rightMarkers);
    });
}

function setBoardsEnabled(enabled) {
  [dom.leftBoard, dom.rightBoard].forEach((board) => {
    board.disabled = !enabled;
    board.classList.toggle("is-disabled", !enabled);
  });
}

function hideAllPanels() {
  dom.introPanel.classList.add("hidden");
  dom.hudPanel.classList.add("hidden");
  dom.resultPanel.classList.add("hidden");
  dom.endScreen.classList.add("hidden");
  dom.stageTimer.classList.add("hidden");
}

function showBoards(show) {
  dom.leftBoard.classList.toggle("hidden", !show);
  dom.rightBoard.classList.toggle("hidden", !show);
}

function setHudActions(buttons) {
  dom.hudActions.innerHTML = "";
  if (!buttons.length) {
    dom.hudActions.classList.add("hidden");
    return;
  }

  dom.hudActions.classList.remove("hidden");
  buttons.forEach((buttonConfig, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "primary-button" : "secondary-button";
    button.textContent = buttonConfig.label;
    button.addEventListener("click", buttonConfig.onClick);
    dom.hudActions.append(button);
  });
}

function setResultActions(buttons) {
  dom.resultActions.innerHTML = "";
  buttons.forEach((buttonConfig, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "primary-button" : "secondary-button";
    button.textContent = buttonConfig.label;
    button.addEventListener("click", buttonConfig.onClick);
    dom.resultActions.append(button);
  });
}

function updateHud() {
  const level = currentLevel();
  if (!level) return;

  dom.levelTitle.textContent = level.title;
  dom.timerValue.textContent = `${formatSeconds(state.timeLeftMs)}s`;
  dom.playerProgress.textContent = `${state.foundIds.size} / ${level.diffCount}`;
  dom.aiProgress.textContent = `${state.aiFoundCount} / ${level.diffCount}`;
  const progress = level.diffCount ? (state.aiFoundCount / level.diffCount) * 100 : 0;
  dom.aiFill.style.width = `${progress}%`;
  dom.aiPercent.textContent = `${Math.round(progress)}%`;
  dom.aiMessage.textContent = state.aiMessage;

  const timeRatio = level.roundSeconds ? state.timeLeftMs / (level.roundSeconds * 1000) : 0;
  const warningThresholdSeconds = level.kind === "practice" ? 5 : 10;
  dom.stageTimerLabel.textContent = `${level.kind === "practice" ? "测试关" : "正式关"}剩余时间`;
  dom.stageTimerValue.textContent = `${formatSeconds(state.timeLeftMs)}s`;
  dom.stageTimerFill.style.width = `${Math.max(0, Math.min(100, timeRatio * 100))}%`;
  dom.stageTimerFill.classList.toggle("is-warning", state.timeLeftMs <= warningThresholdSeconds * 1000);
  dom.stageAiLabel.textContent = `AI 扫描进度 ${Math.round(progress)}%`;
  dom.stageAiMessage.textContent = state.aiMessage;
}

function resetRoundState() {
  cancelAnimationFrame(state.rafId);
  state.foundIds = new Set();
  state.isPlaying = false;
  state.startTime = 0;
  state.elapsedMs = 0;
  state.timeLeftMs = 0;
  state.aiFoundCount = 0;
  state.aiMessage = "AI 待命中，准备扫描冷柜陈列...";
  state.result = null;
  clearMarkers();
}

function setLevel(levelId) {
  state.activeLevelId = levelId;
  const level = currentLevel();
  dom.leftImage.src = level.leftImage;
  dom.rightImage.src = level.rightImage;
  dom.leftImage.alt = `${level.title} 左图`;
  dom.rightImage.alt = `${level.title} 右图`;
  updateHud();
}

function flashWrong(board) {
  board.classList.remove("is-flash");
  void board.offsetWidth;
  board.classList.add("is-flash");
}

function syncAiState(elapsedMs) {
  const level = currentLevel();
  let latest = { foundCount: 0, message: "AI 正在启动冰柜扫描阵列..." };
  level.aiScript.forEach((step) => {
    if (elapsedMs >= step.atMs) latest = step;
  });
  state.aiFoundCount = latest.foundCount;
  state.aiMessage = latest.message;
}

function playerUsedMs() {
  const level = currentLevel();
  return level.roundSeconds * 1000 - state.timeLeftMs;
}

function finishPracticeRound(success) {
  const level = currentLevel();
  state.isPlaying = false;
  cancelAnimationFrame(state.rafId);
  setBoardsEnabled(false);
  hideAllPanels();
  dom.resultPanel.classList.remove("hidden");
  dom.hudActions.classList.add("hidden");

  dom.resultTag.textContent = success ? "Practice Clear" : "Practice Retry";
  dom.resultTitle.textContent = success ? level.copy.successTitle : level.copy.failTitle;
  dom.resultSummary.textContent = success ? level.copy.successBody : level.copy.failBody;
  dom.resultFound.textContent = `${state.foundIds.size} / ${level.diffCount}`;
  dom.resultTime.textContent = `${(playerUsedMs() / 1000).toFixed(1)}s`;
  dom.resultAiTime.textContent = `${(currentAiCompleteMs() / 1000).toFixed(1)}s`;
  state.practicePassed = success;

  if (success) {
    updateFeedback("测试关已通过，可以进入正式挑战。");
    setResultActions([
      { label: "进入正式挑战", onClick: prepareFormalReady },
      { label: "返回首页", onClick: renderHome },
    ]);
    return;
  }

  updateFeedback("测试未完成，可再试一次，或直接跳过进入正式挑战。");
  setResultActions([
    { label: "再试一次", onClick: startPracticeRound },
    { label: "跳过测试", onClick: prepareFormalReady },
    { label: "返回首页", onClick: renderHome },
  ]);
}

function finishFormalRound(success, reason) {
  const level = currentLevel();
  const aiTimeMs = currentAiCompleteMs();
  const playerTimeMs = playerUsedMs();
  const leadSeconds = Math.max((aiTimeMs - playerTimeMs) / 1000, 0);
  const lagSeconds = Math.max((playerTimeMs - aiTimeMs) / 1000, 0);

  state.isPlaying = false;
  state.formalAttemptUsed = true;
  cancelAnimationFrame(state.rafId);
  setBoardsEnabled(false);
  hideAllPanels();
  dom.resultPanel.classList.remove("hidden");
  dom.hudActions.classList.add("hidden");

  if (success) {
    dom.resultTag.textContent = "Formal Clear";
    dom.resultTitle.textContent = "恭喜通关";
    dom.resultSummary.textContent = `您成功战胜了AI，领先 ${leadSeconds.toFixed(1)} 秒完成本轮智能冰柜挑战。`;
    dom.endScreenTitle.textContent = "恭喜通关";
    dom.endScreenSummary.textContent = "您成功战胜了AI，已完成本轮正式挑战。";
    dom.endPlayerTime.textContent = `${(playerTimeMs / 1000).toFixed(1)}s`;
    dom.endAiTime.textContent = `${(aiTimeMs / 1000).toFixed(1)}s`;
    dom.endLeadTime.textContent = `${leadSeconds.toFixed(1)}s`;
    dom.endScreen.classList.remove("hidden");
    showBoards(false);
    updateFeedback("正式关已通过，玩家成功跑赢 AI。");
  } else {
    dom.resultTag.textContent = "AI Win";
    dom.resultTitle.textContent = "AI率先完成挑战";
    dom.resultSummary.textContent =
      reason === "slow"
        ? `你虽然找全了全部目标，但比 AI 慢了 ${lagSeconds.toFixed(1)} 秒，本轮仍判定为失败。`
        : "本轮正式挑战已结束，请返回首页后由下一位重新开始。";
    updateFeedback("正式关已结束，本轮只能挑战一次。");
  }

  dom.resultFound.textContent = `${state.foundIds.size} / ${level.diffCount}`;
  dom.resultTime.textContent = `${(playerTimeMs / 1000).toFixed(1)}s`;
  dom.resultAiTime.textContent = `${(aiTimeMs / 1000).toFixed(1)}s`;
  setResultActions([{ label: "返回首页", onClick: renderHome }]);
}

function gameLoop(now) {
  if (!state.isPlaying) return;

  const level = currentLevel();
  state.elapsedMs = now - state.startTime;
  state.timeLeftMs = Math.max(0, level.roundSeconds * 1000 - state.elapsedMs);
  syncAiState(state.elapsedMs);
  updateHud();

  if (level.kind === "formal" && state.elapsedMs >= currentAiCompleteMs() && state.foundIds.size < level.diffCount) {
    state.timeLeftMs = Math.max(0, level.roundSeconds * 1000 - currentAiCompleteMs());
    finishFormalRound(false, "ai_first");
    return;
  }

  if (state.timeLeftMs <= 0) {
    if (level.kind === "practice") {
      finishPracticeRound(false);
    } else {
      finishFormalRound(false, "timeout");
    }
    return;
  }

  state.rafId = requestAnimationFrame(gameLoop);
}

function getScenePoint(event, board) {
  const level = currentLevel();
  const rect = board.getBoundingClientRect();
  const scale = Math.min(rect.width / level.naturalSize.width, rect.height / level.naturalSize.height);
  const renderedWidth = level.naturalSize.width * scale;
  const renderedHeight = level.naturalSize.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  return {
    x: (event.clientX - rect.left - offsetX) / scale,
    y: (event.clientY - rect.top - offsetY) / scale,
  };
}

function findHit(point) {
  return currentLevel().hotspots.find((hotspot) => {
    if (state.foundIds.has(hotspot.id)) return false;
    const dx = point.x - hotspot.x;
    const dy = point.y - hotspot.y;
    return dx * dx + dy * dy <= hotspot.radius * hotspot.radius;
  });
}

function handleBoardTap(event) {
  if (!state.isPlaying) return;

  const level = currentLevel();
  const hit = findHit(getScenePoint(event, event.currentTarget));
  if (hit) {
    state.foundIds.add(hit.id);
    renderFoundMarkers();
    updateHud();
    updateFeedback(`命中成功：已找到 ${state.foundIds.size} / ${level.diffCount} 处不同。`);

    if (state.foundIds.size === level.diffCount) {
      if (level.kind === "practice") {
        finishPracticeRound(true);
      } else {
        finishFormalRound(playerUsedMs() < currentAiCompleteMs(), playerUsedMs() < currentAiCompleteMs() ? "win" : "slow");
      }
    }
    return;
  }

  state.startTime -= sessionConfig.wrongTapPenaltySeconds * 1000;
  state.timeLeftMs = Math.max(0, state.timeLeftMs - sessionConfig.wrongTapPenaltySeconds * 1000);
  flashWrong(event.currentTarget);
  updateHud();
  updateFeedback(`未命中，已扣除 ${sessionConfig.wrongTapPenaltySeconds} 秒。建议优先观察货位、标签和灯带变化。`);
}

function startRound(levelId, options = {}) {
  setLevel(levelId);
  resetRoundState();
  const level = currentLevel();
  state.timeLeftMs = level.roundSeconds * 1000;
  state.aiMessage = level.copy.intro;
  updateHud();
  hideAllPanels();
  dom.hudPanel.classList.remove("hidden");
  dom.stageTimer.classList.remove("hidden");
  showBoards(true);
  setBoardsEnabled(true);
  setHudActions(options.hudActions || []);
  state.isPlaying = true;
  state.startTime = performance.now();
  updateFeedback(level.kind === "practice" ? "测试关开始：先熟悉点击与命中反馈。" : "正式挑战开始：本轮只有一次机会，尽快跑赢 AI。");
  state.rafId = requestAnimationFrame(gameLoop);
}

function chooseFormalLevel() {
  if (state.formalLevelId) return state.formalLevelId;
  const pool = sessionConfig.formalPool.filter((id) => levelMap.has(id));
  const randomIndex = Math.floor(Math.random() * pool.length);
  state.formalLevelId = pool[randomIndex];
  return state.formalLevelId;
}

function renderHome() {
  resetRoundState();
  state.phase = "home";
  state.formalLevelId = null;
  state.formalAttemptUsed = false;
  state.practicePassed = false;
  hideAllPanels();
  dom.introPanel.classList.remove("hidden");
  showBoards(false);
  setBoardsEnabled(false);
  setHudActions([]);
  dom.resultActions.innerHTML = "";
  updateFeedback("先完成 20 秒测试关，再进入 40 秒正式挑战。");
}

function startPracticeRound() {
  state.phase = "practice-active";
  state.practicePassed = false;
  startRound(sessionConfig.practicePool[0], {
    hudActions: [{ label: "跳过测试", onClick: prepareFormalReady }],
  });
}

function prepareFormalReady() {
  resetRoundState();
  state.phase = "formal-ready";
  chooseFormalLevel();
  setLevel(state.formalLevelId);
  hideAllPanels();
  dom.resultPanel.classList.remove("hidden");
  showBoards(false);
  setBoardsEnabled(false);
  dom.resultTag.textContent = "Formal Ready";
  dom.resultTitle.textContent = "正式挑战";
  dom.resultSummary.textContent = "系统已随机抽取 1 组正式图。本轮正式挑战仅可进行一次，成功条件为 40 秒内找全 6 处不同，并且比 AI 更快完成。";
  dom.resultFound.textContent = `0 / ${currentLevel().diffCount}`;
  dom.resultTime.textContent = "--";
  dom.resultAiTime.textContent = `${(currentAiCompleteMs() / 1000).toFixed(1)}s`;
  setResultActions([
    { label: "开始正式挑战", onClick: startFormalRound },
    { label: "返回首页", onClick: renderHome },
  ]);
  updateFeedback("正式关已就绪：请确认后开始，本轮不能重来。");
}

function startFormalRound() {
  if (state.formalAttemptUsed) return;
  state.phase = "formal-active";
  startRound(state.formalLevelId);
}

function bindEvents() {
  dom.startButton.addEventListener("click", startPracticeRound);
  dom.leftBoard.addEventListener("click", handleBoardTap);
  dom.rightBoard.addEventListener("click", handleBoardTap);
  window.addEventListener("resize", fitDesignCanvas);
  window.addEventListener("orientationchange", fitDesignCanvas);
}

function boot() {
  if (!GAME_DATA.levels.length) {
    updateFeedback("关卡数据未加载，请先运行素材生成脚本。");
    dom.startButton.disabled = true;
    return;
  }

  bindEvents();
  dom.endScreenButton.addEventListener("click", renderHome);
  fitDesignCanvas();
  renderHome();
}

boot();
