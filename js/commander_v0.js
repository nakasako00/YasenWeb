(function () {
      const canvas = document.getElementById("canvas");
      const ctx = canvas.getContext("2d");
      const systemPanel = document.querySelector(".system-panel");
      const versionBadge = document.getElementById("versionBadge");

      // Versioning policy for commander_v0.html:
      // - Keep the stream in v0.x.y until v1 work formally starts.
      // - Increment x for large ChatGPT-side design changes.
      // - Increment y for Codex-side implementation adjustments.
      // - Never roll back to a smaller number once used.
      const COMMANDER_VERSION = "v0.1.0";
      const BGM_VOLUME = 0.25;
      const BGM_VOLUME_RATE = 0.4;
      const SE_VOLUME = 0.6;

      const maxBaseHp = 10000;
      const FRONTLINE_DAMAGE_PER_CASUALTY = 1000;
      const MAX_REPAIR_T = 3;
      const REPAIR_GAUGE_DISPLAY_MAX = 12;
      const maxRound = 10;
      const maxUnitsA = 8;
      const maxUnitsB = 8;
      const repairUnitNames = ["L_1", "S_1", "R_3", "J_2", "H_4", "E_5", "L_6", "S_7"];
      const MAP_SIDE_UI_RATE = 1.4;
      const MAP_SIDE_UI_HEIGHT_RATE = 0.58
      const MAP_SIDE_UI_FONT_SIZE_RATE = 0.2
      const ALL_UI_MARGIN_RATE = 0.15;
      const ALL_UI_GAP_RATE = 0.15;
      const UI_LINE_WIDTH_RATE = 1;
      const UI_LINE_WIDTH_MIN = 1;
      const BOOT_PROGRESS_PATTERN = "ﾀ.ﾀ.ﾀ.ﾀ.ﾀ、タ、ﾀ.ﾀ、ﾀ.ﾀ.ﾀ.ﾀ.ﾀ";
      const BOOT_TOTAL_MS = 1500;
      const state = {
        round: 1,
        baseHpA: maxBaseHp,
        baseHpB: maxBaseHp,
        result: null,
        pendingCommand: null,
        isConfirmMode: false,
        isTitleScreenOpen: false,
        isBootModalOpen: false,
        bootProgress: 0,
        isBootReady: false,
        isIntroBriefingOpen: false,
        isSoundConfigOpen: false,
        lastRoundReport: null,
        isRoundReportOpen: false,
        pendingResult: null,
        pendingRoundAdvance: false,
        commandHistory: [],
        repairQueueA: [],
        repairQueueB: [],
        damagePoolA: 0,
        damagePoolB: 0,
        nextRepairUnitIndexA: 0,
        nextRepairUnitIndexB: 0,
        unitDisplayCountA: maxUnitsA,
        unitDisplayCountB: maxUnitsB,
        baseHpDisplayA: maxBaseHp,
        baseHpDisplayB: maxBaseHp,
        displayedAttackPowerRateA: 1,
        displayedAttackPowerRateB: 1,
        displayedRepairRateA: 0,
        displayedRepairRateB: 0,
        displayedFrontlineAdvantage: 0,
        hasStartedBgm: false,
        isBgmEnabled: true,
        bgmVolume: BGM_VOLUME,
        seVolume: SE_VOLUME,
        operatorMessage: "",
        isUnitDeltaAnimating: false,
        isBaseHpAnimating: false,
        isOtherGaugeAnimating: false,
        isPhaseWaiting: false,
        unitDeltaPulse: null,
        unitDeltaAnimationToken: 0,
        gaugeAnimationToken: 0,
        phaseWaitToken: 0,
      };


      const audioManager = window.CommanderAudioManager.create({
        state,
        bgmPath: "assets/audio/bgm.mp3",
        sePaths: {
          button_positive: "assets/audio/se_button_positive.mp3",
          button_negative: "assets/audio/se_button_negative.mp3",
          button_confirm: "assets/audio/se_button_confirm.mp3",
          button_cancel: "assets/audio/se_button_cancel.mp3",
        },
        bgmVolumeRate: BGM_VOLUME_RATE,
      });

      const {
        syncBgmVolumeUi,
        syncSeVolumeUi,
        playSe,
        setBgmVolume,
        setSeVolume,
        prepareBgmPlayback,
        tryPreviewBgmPlayback,
        ensureBgmPlayback,
        stopBgmPlayback,
        syncBgmOutputState,
        shouldUseWebAudio,
      } = audioManager;

      let bootProgressTimer = null;

      const map = [
        ["road", "road", "road", "b_base", "b_base", "b_base", "road", "road", "road"],
        ["road", "road", "road", "b_base", "b_base", "b_base", "road", "road", "road"],
        ["road", "road", "road", "b_base", "b_base", "b_base", "road", "road", "road"],
        ["road", "road", "road", "road", "road", "road", "road", "road", "road"],
        ["road", "road", "road", "b_road_7", "b_road_6", "b_road_8", "road", "road", "road"],
        ["road", "road", "b_road_4", "b_road_2", "b_road_1", "b_road_3", "b_road_5", "road", "road"],
        ["road", "road", "road", "road", "road", "road", "road", "road", "road"],
        ["road", "road", "a_road_4", "a_road_2", "a_road_1", "a_road_3", "a_road_5", "road", "road"],
        ["road", "road", "road", "a_road_7", "a_road_6", "a_road_8", "road", "road", "road"],
        ["road", "road", "road", "road", "road", "road", "road", "road", "road"],
        ["road", "road", "road", "a_base", "a_base", "a_base", "road", "road", "road"],
        ["road", "road", "road", "a_base", "a_base", "a_base", "road", "road", "road"],
        ["road", "road", "road", "a_base", "a_base", "a_base", "road", "road", "road"],
      ];

      const terrainStyles = {
        a_base: { fill: "#1d4ed8", label: "A" },
        a_road_1: { fill: "#c7a26a", label: "道" },
        a_road_2: { fill: "#c7a26a", label: "道" },
        a_road_3: { fill: "#c7a26a", label: "道" },
        a_road_4: { fill: "#c7a26a", label: "道" },
        a_road_5: { fill: "#c7a26a", label: "道" },
        a_road_6: { fill: "#c7a26a", label: "道" },
        a_road_7: { fill: "#c7a26a", label: "道" },
        a_road_8: { fill: "#c7a26a", label: "道" },
        b_base: { fill: "#b91c1c", label: "B" },
        b_road_1: { fill: "#c7a26a", label: "道" },
        b_road_2: { fill: "#c7a26a", label: "道" },
        b_road_3: { fill: "#c7a26a", label: "道" },
        b_road_4: { fill: "#c7a26a", label: "道" },
        b_road_5: { fill: "#c7a26a", label: "道" },
        b_road_6: { fill: "#c7a26a", label: "道" },
        b_road_7: { fill: "#c7a26a", label: "道" },
        b_road_8: { fill: "#c7a26a", label: "道" },
        forest: { fill: "#2f6b3f", label: "森" },
        road: { fill: "#c7a26a", label: "道" },
        plain: { fill: "#dfe9c6", label: "平" },
        river: { fill: "#4f8fcf", label: "川" },
        bridge: { fill: "#b8894e", label: "橋" },
      };

      function buildAbstractUnitSlots() {
        const slots = { A: [], B: [] };
        for (let y = 0; y < map.length; y++) {
          for (let x = 0; x < map[y].length; x++) {
            const terrain = map[y][x];
            const match = /^([ab])_road_(\d+)$/.exec(terrain);
            if (!match) continue;
            const team = match[1] === "a" ? "A" : "B";
            const index = Number(match[2]);
            slots[team][index] = { x, y };
          }
        }
        return slots;
      }

      const abstractUnitSlots = buildAbstractUnitSlots();

      function getTerrainStyle(terrain) {
        return terrainStyles[terrain] ?? { fill: "#cccccc", label: "?" };
      }

      function getTerrainLabel(terrain) {
        return getTerrainStyle(terrain).label;
      }

      function isStandaloneMode() {
        return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
      }

      function isIOSLikeDevice() {
        const platform = window.navigator.platform ?? "";
        const userAgent = window.navigator.userAgent ?? "";
        const touchPoints = window.navigator.maxTouchPoints ?? 0;
        return /iPhone|iPad|iPod/i.test(userAgent)
          || (platform === "MacIntel" && touchPoints > 1);
      }

      function refreshVersionBadge() {
        if (!versionBadge) return;
        versionBadge.textContent = COMMANDER_VERSION;
      }

      function buildBootProgressTimeline() {
        const noteTokens = [];
        let totalProgressUnits = 0;
        let totalBeats = 0;
        for (const char of BOOT_PROGRESS_PATTERN) {
          if (char === "ﾀ") {
            noteTokens.push({ type: "progress", units: 1, beats: 1 });
            totalProgressUnits += 1;
            totalBeats += 1;
          } else if (char === "タ") {
            noteTokens.push({ type: "progress", units: 2, beats: 1 });
            totalProgressUnits += 2;
            totalBeats += 1;
          } else if (char === ".") {
            noteTokens.push({ type: "rest", beats: 0.5 });
            totalBeats += 0.5;
          } else if (char === "、") {
            noteTokens.push({ type: "rest", beats: 4 });
            totalBeats += 4;
          }
        }

        if (totalProgressUnits <= 0 || totalBeats <= 0) {
          return [];
        }

        const beatMs = BOOT_TOTAL_MS / totalBeats;
        let accumulatedUnits = 0;
        const timeline = [];
        let pendingDelayBeats = 0;
        for (const token of noteTokens) {
          if (token.type === "rest") {
            pendingDelayBeats += token.beats;
            continue;
          }
          if (token.type === "progress") {
            accumulatedUnits += token.units;
            pendingDelayBeats += token.beats;
            timeline.push({
              value: accumulatedUnits >= totalProgressUnits
                ? 100
                : Math.round((accumulatedUnits / totalProgressUnits) * 100),
              delay: Math.max(1, Math.round(pendingDelayBeats * beatMs)),
            });
            pendingDelayBeats = 0;
          }
        }

        if (timeline.length > 0) {
          timeline[timeline.length - 1].value = 100;
        }

        return timeline;
      }

      function refreshSystemPanelVisibility() {
        const isStandalone = isStandaloneMode();
        if (!systemPanel) return;
        systemPanel.classList.toggle("show", isStandalone);
        document.body.classList.toggle("pwa-system-ui", isStandalone);
      }

      function getFrontlineStatusReport(activeA, activeB) {
        const diff = activeA - activeB;
        if (diff >= 2) return "味方前線は優勢です。";
        if (diff >= 1) return "味方前線はやや優勢です。";
        if (diff === 0) return "前線は拮抗しています。";
        if (diff <= -2) return "味方前線は劣勢です。";
        return "味方前線はやや劣勢です。";
      }

      function getOperatorSummaryLine() {
        const activeA = getActiveUnitCount("A");
        const activeB = getActiveUnitCount("B");
        const allyHpRate = maxBaseHp > 0 ? state.baseHpA / maxBaseHp : 0;
        const enemyHpRate = maxBaseHp > 0 ? state.baseHpB / maxBaseHp : 0;
        const allyRepairLoad = getRepairLoad(state.repairQueueA);
        const enemyRepairLoad = getRepairLoad(state.repairQueueB);

        if (enemyHpRate <= 0.2) return "敵本陣は崩壊寸前です。";
        if (allyHpRate <= 0.2) return "こちらの本陣被害が限界に近いです。";
        if (activeA + 2 <= activeB) return "敵前線の圧力が強まっています。";
        if (activeA >= activeB + 2) return "敵前線は消耗しています。";
        if (enemyRepairLoad >= allyRepairLoad + 2) return "敵前線の継戦力が落ちています。";
        if (allyRepairLoad >= enemyRepairLoad + 2) return "味方前線の損耗管理が急務です。";
        return "前線は拮抗しています。";
      }

      function formatOperatorRating(score, bestScore, worstScore) {
        const spread = Math.max(1, bestScore - worstScore);
        const normalized = (score - worstScore) / spread;
        if (normalized >= 0.86) return "↑↑";
        if (normalized >= 0.66) return "↑";
        if (normalized >= 0.4) return "→";
        if (normalized >= 0.18) return "↓";
        return "↓↓";
      }

      function getAggressiveCommandWeighting() {
        const activeA = getActiveUnitCount("A");
        const activeB = getActiveUnitCount("B");
        const allyHpRate = maxBaseHp > 0 ? state.baseHpA / maxBaseHp : 0;
        const enemyHpRate = maxBaseHp > 0 ? state.baseHpB / maxBaseHp : 0;

        return {
          enemyBase: 1.8 + (1 - enemyHpRate) * 2.6,
          enemyFrontline: 1.2 + Math.max(0, activeB - activeA) * 0.75,
          allyBasePenalty: 0.8 + (1 - allyHpRate) * 2.8,
          allyFrontlinePenalty: 0.55 + Math.max(0, activeB - activeA) * 0.5,
        };
      }

      function getOperatorExpectationLine() {
        const weights = getAggressiveCommandWeighting();
        const commandIds = ["A.中央突破", "B.側面展開", "C.迎撃対応"];
        const scoredCommands = commandIds.map((commandId) => {
          const damage = getCommandDamage(commandId);
          const score = (
            damage.baseDamageDealt * weights.enemyBase
            + damage.frontlineDamageDealt * weights.enemyFrontline
            - damage.baseDamageReceived * weights.allyBasePenalty
            - damage.frontlineDamageReceived * weights.allyFrontlinePenalty
          );
          return { commandId, score };
        });
        const bestScore = Math.max(...scoredCommands.map((item) => item.score));
        const worstScore = Math.min(...scoredCommands.map((item) => item.score));
        return scoredCommands.map((item) => {
          const label = item.commandId[0];
          return `${label}${formatOperatorRating(item.score, bestScore, worstScore)}`;
        }).join("　");
      }

      function getOperatorReport() {
        return [
          getOperatorSummaryLine(),
          getOperatorExpectationLine(),
        ].join("<br />");
      }

      function refreshOperatorMessage() {
        state.operatorMessage = getOperatorReport();
      }

      function refreshReportReopenButtonLabel() {
        const button = document.getElementById("reportReopenButton");
        if (!button) return;
        const isRound1 = Math.min(state.round, maxRound) <= 1;
        button.textContent = isRound1 ? "📋 再確認" : "📊 再確認";
      }

      function getCommandPreviewReport(commandId) {
        switch (commandId) {
          case "A.中央突破":
            return [
              "中央突破を実行します。",
              "敵本陣へ大打撃を狙う決戦作戦です。",
              "自軍前線の損耗も大きくなります。",
            ].join("<br />");
          case "B.側面展開":
            return [
              "側面展開を実行します。",
              "敵前線を削り、枚数有利を作る基本作戦です。",
              "前線の主導権を取りに行きます。",
            ].join("<br />");
          case "C.迎撃対応":
            return [
              "迎撃対応を実行します。",
              "本陣への被害を受け入れつつ、前線維持を優先する迎撃作戦です。",
              "敵前線を削り、崩壊を遅らせます。",
            ].join("<br />");
          default:
            return "作戦内容を確認してください。";
        }
      }

      function toCircledDigit(value) {
        const digits = ["", "①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
        return digits[value] ?? `${value}`;
      }

      function getRepairStatusText(queue) {
        if (!queue.length) return "なし";
        return queue.map((item) => `${item.name}${toCircledDigit(item.timer)}`).join(" ");
      }

      function getRepairLoad(queue) {
        return queue.reduce((sum, item) => sum + Math.max(0, item.timer), 0);
      }

      function drawBaseHpGauge(gaugeId, valueId, currentHp, maxHp, extraText = "") {
        const hpRate = Math.max(0, Math.min(1, currentHp / maxHp));
        const fill = document.getElementById(gaugeId);
        const value = document.getElementById(valueId);
        const inlineValue = document.getElementById(valueId + "Text");
        if (fill) {
          fill.style.width = `${hpRate * 100}%`;
          fill.className = `gauge-fill ${hpRate > 0.5 ? "" : hpRate > 0.2 ? "mid" : "low"}`.trim();
        }
        if (value) {
          value.textContent = `${currentHp} / ${maxHp}`;
        }
        if (inlineValue) {
          inlineValue.textContent = `${currentHp} / ${maxHp}${extraText ? `　修理状況: ${extraText}` : ""}`;
        }
      }

      function drawMap() {
        const cols = map[0].length;
        const rows = map.length;
        const cellSize = Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
        const mapWidth = cellSize * cols;
        const mapHeight = cellSize * rows;
        const mapX = Math.floor((canvas.width - mapWidth) / 2);
        const mapY = 0;

        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${Math.max(16, Math.floor(cellSize * 0.42))}px sans-serif`;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";

        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const terrain = map[y][x];
            const terrainStyle = getTerrainStyle(terrain);
            const { fill, label } = terrainStyle;
            const px = mapX + x * cellSize;
            const py = mapY + y * cellSize;

            ctx.fillStyle = fill;
            ctx.fillRect(px, py, cellSize, cellSize);
            ctx.strokeRect(px, py, cellSize, cellSize);

            ctx.fillStyle = x === 0 ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.9)";
            ctx.fillText(label, Math.round(px + cellSize / 2), Math.round(py + cellSize / 2));
          }
        }
      }

      function getCellCenter(mapX, mapY, cellSize, x, y) {
        return {
          x: mapX + x * cellSize + cellSize / 2,
          y: mapY + y * cellSize + cellSize / 2,
        };
      }

      function drawBaseHpBadge(layout, team, currentHp, maxHp) {
        const { cellSize, mapX, mapY, rows } = layout;
        const baseCell = team === "B" ? { x: 4, y: 0 } : { x: 4, y: rows - 1 };
        const baseCenter = getCellCenter(mapX, mapY, cellSize, baseCell.x, baseCell.y);
        const badgeWidth = Math.round(cellSize * 3.0);
        const badgeHeight = Math.round(cellSize * 0.8);
        const badgeX = baseCenter.x - badgeWidth / 2;
        const margin = cellSize * ALL_UI_MARGIN_RATE;
        const offsetY = team === "B" ?  - cellSize * 0.5 + margin : cellSize * 0.5 - badgeHeight - margin;
        const badgeY = baseCenter.y + offsetY;
        const hpRate = Math.max(0, Math.min(1, currentHp / maxHp));

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        ctx.lineWidth = Math.max(UI_LINE_WIDTH_MIN, 0.3 * UI_LINE_WIDTH_RATE * MAP_SIDE_UI_RATE);
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 7);
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.floor(cellSize * 0.27)}px sans-serif`;
        ctx.fillStyle = "#111827";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(`${currentHp} / ${maxHp}`, badgeX + badgeWidth - 10, badgeY + badgeHeight * 0.3);

        ctx.textAlign = "left";
        ctx.fillText(team === "B" ? `💥` : `🛡️`, badgeX + 10, badgeY + badgeHeight * 0.3);

        const trackX = badgeX + 10;
        const trackY = badgeY + badgeHeight * 0.63;
        const trackW = badgeWidth - 20;
        const trackH = 7;
        const gaugeFill = team === "B"
          ? (hpRate > 0.5 ? "#ef4444" : hpRate > 0.2 ? "#f97316" : "#dc2626")
          : (hpRate > 0.5 ? "#2563eb" : hpRate > 0.2 ? "#3b82f6" : "#1d4ed8");

        // 塗りつぶし
        ctx.fillStyle = gaugeFill;
        const innerTrackX = trackX + 1;
        const innerTrackW = Math.max(0, trackW - 2);
        const fillWidth = Math.max(0, Math.round(innerTrackW * hpRate));
        roundRect(ctx, innerTrackX, trackY, fillWidth, trackH, 999);
        ctx.fill();
        ctx.restore();

        // 枠線
        ctx.fillStyle = "rgba(255, 255, 255, 0)";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        ctx.lineWidth = Math.max(UI_LINE_WIDTH_MIN, 0.3 * UI_LINE_WIDTH_RATE * MAP_SIDE_UI_RATE);
        roundRect(ctx, trackX, trackY, trackW, trackH, 999);
        ctx.fill();
        ctx.stroke();
      }

      function drawRepairGauge(layout, team, rate) {
        const { cellSize, mapX, mapY, mapHeight } = layout;
        rate = Math.max(0, Math.min(1, rate));
        const badgeWidth = Math.round(cellSize * 1.68 * MAP_SIDE_UI_RATE);
        const badgeHeight = Math.round(cellSize * MAP_SIDE_UI_HEIGHT_RATE * MAP_SIDE_UI_RATE);
        const margin = Math.round(cellSize * ALL_UI_MARGIN_RATE);
        const badgeX = mapX + margin + Math.round(cellSize * 0.0 * MAP_SIDE_UI_RATE);
        const badgeY = team === "B"
          ? mapY + margin
          : mapY + mapHeight - badgeHeight - margin;
        const fillColor = team === "B"
          ? (rate > 0.5 ? "#b45309" : rate > 0.2 ? "#d97706" : "#92400e")
          : (rate > 0.5 ? "#1d4ed8" : rate > 0.2 ? "#3b82f6" : "#2563eb");
        const label = "修理負荷";

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.strokeStyle = "rgba(37, 47, 71, 1)";
        ctx.lineWidth = Math.max(UI_LINE_WIDTH_MIN, 0.3 * UI_LINE_WIDTH_RATE * MAP_SIDE_UI_RATE);
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 5);
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.floor(cellSize * MAP_SIDE_UI_FONT_SIZE_RATE * MAP_SIDE_UI_RATE)}px sans-serif`;
        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, badgeX + 2.5 * MAP_SIDE_UI_RATE, badgeY + badgeHeight * 0.28);

        const trackX = badgeX + 2.5 * MAP_SIDE_UI_RATE;
        const trackY = badgeY + badgeHeight * 0.58;
        const trackW = badgeWidth - 5 * MAP_SIDE_UI_RATE;
        const trackH = 6 * MAP_SIDE_UI_RATE;
        const innerTrackX = trackX + 0 * MAP_SIDE_UI_RATE;
        const innerTrackW = Math.max(0, trackW - 0 * MAP_SIDE_UI_RATE);

        // 塗りつぶし
        ctx.fillStyle = fillColor;
        roundRect(ctx, innerTrackX, trackY, Math.round(innerTrackW * rate), trackH, 999);
        ctx.fill();
        ctx.restore();

        // 枠線
        ctx.fillStyle = "rgba(255, 255, 255, 0)";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        roundRect(ctx, trackX, trackY, trackW, trackH, 999);
        ctx.fill();
        ctx.stroke();
      }

      function drawFrontlineGauge(layout, team, rate) {
        const { cellSize, mapX, mapY, mapHeight } = layout;
        rate = Math.max(0, Math.min(1, rate));
        const badgeWidth = Math.round(cellSize * 1.68 * MAP_SIDE_UI_RATE);
        const badgeHeight = Math.round(cellSize * MAP_SIDE_UI_HEIGHT_RATE * MAP_SIDE_UI_RATE);
        const margin = Math.round(cellSize * ALL_UI_MARGIN_RATE);
        const gap = Math.round(cellSize * ALL_UI_GAP_RATE);
        const badgeX = mapX + margin + Math.round(cellSize * 0.0 * MAP_SIDE_UI_RATE);
        const badgeY = team === "B"
          ? mapY + margin + badgeHeight + gap
          : mapY + mapHeight - badgeHeight * 2 - gap - margin;
        const fillColor = team === "B"
          ? (rate > 0.5 ? "#dc2626" : rate > 0.2 ? "#f97316" : "#991b1b")
          : (rate > 0.5 ? "#2563eb" : rate > 0.2 ? "#3b82f6" : "#1d4ed8");
        const label = "攻撃力";

        ctx.save();
        ctx.fillStyle = "rgba(255, 255, 255, 1)";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        ctx.lineWidth = Math.max(UI_LINE_WIDTH_MIN, 0.3 * UI_LINE_WIDTH_RATE * MAP_SIDE_UI_RATE);
        roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 5);
        ctx.fill();
        ctx.stroke();

        ctx.font = `700 ${Math.floor(cellSize * MAP_SIDE_UI_FONT_SIZE_RATE * MAP_SIDE_UI_RATE)}px sans-serif`;
        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, badgeX + 2.5 * MAP_SIDE_UI_RATE, badgeY + badgeHeight * 0.28);

        const trackX = badgeX + 2.5 * MAP_SIDE_UI_RATE;
        const trackY = badgeY + badgeHeight * 0.58;
        const trackW = badgeWidth - 5 * MAP_SIDE_UI_RATE;
        const trackH = 6 * MAP_SIDE_UI_RATE;
        const innerTrackX = trackX + 0 * MAP_SIDE_UI_RATE;
        const innerTrackW = Math.max(0, trackW - 0 * MAP_SIDE_UI_RATE);

        // 塗りつぶし
        ctx.fillStyle = fillColor;
        roundRect(ctx, innerTrackX, trackY, Math.round(innerTrackW * rate), trackH, 999);
        ctx.fill();
        ctx.restore();

        // 枠線
        ctx.fillStyle = "rgba(255, 255, 255, 0)";
        ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        ctx.lineWidth = Math.max(UI_LINE_WIDTH_MIN, 0.3 * UI_LINE_WIDTH_RATE * MAP_SIDE_UI_RATE);
        roundRect(ctx, trackX, trackY, trackW, trackH, 999);
        ctx.fill();
        ctx.stroke();
      }

      function drawFrontlineAdvantageGauge(layout, advantage) {
        const { cellSize, mapX, mapY, mapHeight } = layout;
        const railW = Math.max(7, Math.round(cellSize * 0.32));
        const sideUiMargin = Math.round(cellSize * ALL_UI_MARGIN_RATE);
        const leftUiAnchorX = mapX + sideUiMargin;
        const railInset = Math.max(1, Math.round(cellSize * ALL_UI_MARGIN_RATE * 0.24));
        const railH = Math.max(28, Math.round(cellSize * 5.1));
        const railX = Math.round(leftUiAnchorX + railInset);
        const railY = Math.round(mapY + (mapHeight - railH) / 2);
        const clamped = Math.max(-1, Math.min(1, advantage));
        const knobX = railX + railW / 2;
        const knobY = railY + railH * ((clamped + 1) / 2);
        const knobRadius = Math.max(15, Math.round(cellSize * 0.21));
        const upperH = Math.floor(railH / 2);
        const lowerY = railY + upperH;
        const lowerH = railH - upperH;
        const railGradient = ctx.createLinearGradient(0, railY, 0, railY + railH);
        railGradient.addColorStop(0, "rgb(255, 32, 32)");
        railGradient.addColorStop(0.50, "rgb(160, 160, 160)");
        railGradient.addColorStop(1, "rgb(32, 64, 255)");

        ctx.save();
        ctx.fillStyle = railGradient;
        ctx.lineWidth = 1;
        roundRect(ctx, railX, railY, railW, railH, Math.max(2, railW / 2));
        ctx.fill();

        ctx.strokeStyle = "rgb(31, 41, 55)";
        roundRect(ctx, railX, railY, railW, railH, Math.max(2, railW / 2));
        ctx.stroke();

        ctx.shadowColor = "rgba(15, 23, 42, 0.18)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.beginPath();
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "rgb(71, 85, 105)";
        ctx.lineWidth = 2;
        ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = "rgb(30, 41, 59)";
        ctx.font = `${Math.max(14, Math.floor(cellSize * 0.22))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("⚔️", Math.round(knobX), Math.round(knobY));
        ctx.restore();
      }

      function drawAbstractPieces(layout, team, count, pulse = null) {
        const { cellSize, mapX, mapY } = layout;
        const slots = abstractUnitSlots[team];
        const radius = Math.max(4, Math.round(cellSize * 0.22));
        const pieceFill = team === "B" ? "rgba(185, 28, 28, 0.78)" : "rgba(37, 99, 235, 0.78)";
        const pieceStroke = "rgba(255, 255, 255, 0.88)";
        const pieceShadow = "rgba(15, 23, 42, 0.18)";

        ctx.save();
        ctx.shadowColor = pieceShadow;
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;

        const startIndex = Math.max(1, slots.length - count);
        for (let i = startIndex; i < slots.length; i++) {
          const slot = slots[i];
          if (!slot) continue;
          const point = getCellCenter(mapX, mapY, cellSize, slot.x, slot.y);
          const slotNumber = i + 1;
          const isPulse = pulse && pulse.team === team && pulse.slotNumber === slotNumber;
          ctx.beginPath();
          ctx.fillStyle = pieceFill;
          ctx.strokeStyle = pieceStroke;
          ctx.lineWidth = 1.5;
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (isPulse) {
            ctx.beginPath();
            ctx.fillStyle = pulse.mode === "remove" ? "rgba(255, 255, 255, 0.32)" : "rgba(255, 255, 255, 0.22)";
            ctx.strokeStyle = pulse.mode === "remove" ? "rgba(255, 255, 255, 0.88)" : "rgba(255, 255, 255, 0.72)";
            ctx.lineWidth = 2;
            ctx.arc(point.x, point.y, radius * 1.45, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          ctx.beginPath();
          ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
          ctx.arc(point.x - radius * 0.25, point.y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      function roundRect(context, x, y, width, height, radius) {
        const r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + width, y, x + width, y + height, r);
        context.arcTo(x + width, y + height, x, y + height, r);
        context.arcTo(x, y + height, x, y, r);
        context.arcTo(x, y, x + width, y, r);
        context.closePath();
      }

      function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#f6f7fb";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        document.getElementById("roundInfo").textContent = `Round ${state.round} / ${maxRound}`;
        document.getElementById("operatorMessage").innerHTML = state.operatorMessage;
        const reopenButton = document.getElementById("reportReopenButton");
        if (reopenButton) {
          const hasReopenTarget = Math.min(state.round, maxRound) <= 1 || !!state.lastRoundReport;
          reopenButton.disabled = !hasReopenTarget || state.isRoundReportOpen || state.isConfirmMode || state.isIntroBriefingOpen || !!state.result;
        }
        refreshReportReopenButtonLabel();
        const displayBaseHpB = state.baseHpDisplayB;
        const displayBaseHpA = state.baseHpDisplayA;
        drawBaseHpGauge("bGauge", "bGaugeValue", displayBaseHpB, maxBaseHp);
        drawBaseHpGauge("aGauge", "aGaugeValue", displayBaseHpA, maxBaseHp, getRepairStatusText(state.repairQueueA));
        drawMap();
        const layout = {
          cols: map[0].length,
          rows: map.length,
          cellSize: Math.floor(Math.min(canvas.width / map[0].length, canvas.height / map.length)),
          mapWidth: Math.floor(Math.min(canvas.width / map[0].length, canvas.height / map.length)) * map[0].length,
          mapHeight: Math.floor(Math.min(canvas.width / map[0].length, canvas.height / map.length)) * map.length,
          mapX: Math.floor((canvas.width - Math.floor(Math.min(canvas.width / map[0].length, canvas.height / map.length)) * map[0].length) / 2),
          mapY: 0,
        };
        const visibleCountB = state.isUnitDeltaAnimating ? state.unitDisplayCountB : getActiveUnitCount("B");
        const visibleCountA = state.isUnitDeltaAnimating ? state.unitDisplayCountA : getActiveUnitCount("A");
        drawAbstractPieces(layout, "B", visibleCountB, state.unitDeltaPulse);
        drawAbstractPieces(layout, "A", visibleCountA, state.unitDeltaPulse);
        drawFrontlineAdvantageGauge(layout, state.displayedFrontlineAdvantage);
        drawFrontlineGauge(layout, "B", state.displayedAttackPowerRateB);
        drawFrontlineGauge(layout, "A", state.displayedAttackPowerRateA);
        drawRepairGauge(layout, "B", state.displayedRepairRateB);
        drawRepairGauge(layout, "A", state.displayedRepairRateA);
        drawBaseHpBadge(layout, "B", displayBaseHpB, maxBaseHp);
        drawBaseHpBadge(layout, "A", displayBaseHpA, maxBaseHp);
      }

      function getCommandDamage(commandId) {
        switch (commandId) {
          case "A.中央突破":
            return {
              baseDamageDealt: 4000,
              frontlineDamageDealt: 0,
              baseDamageReceived: 1500,
              frontlineDamageReceived: 4500,
            };

          case "B.側面展開":
            return {
              baseDamageDealt: 800,
              frontlineDamageDealt: 800 * 4,
              baseDamageReceived: 600 + 400,
              frontlineDamageReceived: 600 * 4,
            };
            
          case "C.迎撃対応":
            return {
              baseDamageDealt: 600,
              frontlineDamageDealt: 600 * 4,
              baseDamageReceived: 260 + 1500,
              frontlineDamageReceived: 260 * 4,
            };

          default:
            return {
              baseDamageDealt: 0,
              frontlineDamageDealt: 0,
              baseDamageReceived: 0,
              frontlineDamageReceived: 0,
            };
        }
      }

      function judgeResult() {
        if (state.baseHpA <= 0 && state.baseHpB <= 0) {
          state.result = "DRAW";
          return true;
        }

        if (state.baseHpB <= 0) {
          state.result = "WIN";
          return true;
        }

        if (state.baseHpA <= 0) {
          state.result = "LOSE";
          return true;
        }

        return false;
      }

      function finalizeByHp() {
        state.result = "DRAW";
      }

      function setCommandButtonsEnabled(enabled) {
        document.querySelectorAll("button[data-command]").forEach((button) => {
          button.disabled = !enabled;
        });
      }

      function showTitleScreen() {
        const overlay = document.getElementById("titleScreen");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.isTitleScreenOpen = true;
        setCommandButtonsEnabled(false);
      }

      function hideTitleScreen() {
        const overlay = document.getElementById("titleScreen");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        state.isTitleScreenOpen = false;
      }

      function showBootModal() {
        const overlay = document.getElementById("bootOverlay");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.isBootModalOpen = true;
        state.bootProgress = 0;
        state.isBootReady = false;
        setCommandButtonsEnabled(false);
        refreshBootProgressUi();
        if (bootProgressTimer) {
          window.clearInterval(bootProgressTimer);
        }
        const progressTimeline = buildBootProgressTimeline();
        let progressIndex = 0;
        const advanceBootProgress = () => {
          const step = progressTimeline[progressIndex];
          if (!step) {
            bootProgressTimer = null;
            return;
          }
          state.bootProgress = step.value;
          state.isBootReady = step.value >= 100;
          refreshBootProgressUi();
          progressIndex += 1;
          if (state.isBootReady) {
            bootProgressTimer = null;
            return;
          }
          bootProgressTimer = window.setTimeout(advanceBootProgress, step.delay);
        };
        const initialDelay = progressTimeline.length > 0 ? progressTimeline[0].delay : BOOT_TOTAL_MS;
        bootProgressTimer = window.setTimeout(advanceBootProgress, initialDelay);
      }

      function hideBootModal() {
        const overlay = document.getElementById("bootOverlay");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        state.isBootModalOpen = false;
        if (bootProgressTimer) {
          window.clearTimeout(bootProgressTimer);
          bootProgressTimer = null;
        }
      }

      function refreshBootProgressUi() {
        const value = document.getElementById("bootProgressValue");
        const fill = document.getElementById("bootProgressFill");
        const button = document.getElementById("bootStartButton");
        if (value) {
          value.textContent = `Boot... FRONTLINE LOGIC...${state.bootProgress}%`;
        }
        if (fill) {
          fill.style.width = `${state.bootProgress}%`;
        }
        if (button) {
          button.disabled = !state.isBootReady;
        }
      }

      function handleBootStart() {
        if (!state.isBootReady) return;
        hideBootModal();
        console.log("Boot entry pressed. Attempting BGM playback.");
        ensureBgmPlayback();
      }

      function getIntroBriefingLines() {
        return [
          "📡 Operatorより報告します。",
          "司令、戦況はすでに最終局面にあります。",
          "味方チームは既に敵本陣目前まで前線を押し上げました。🔥",
          "しかし、その味方も安全ではありません。",
          "司令には3つの作戦を提案いたします。",
          "◆━━━━━━━━━━━━━━━━━━━━◆",
          "A. 💥 中央突破",
          "敵本陣へ大打撃を狙う決戦作戦です。",
          "自軍前線の損耗も大きくなります。",
          "B. ⚡️ 側面展開",
          "敵前線を削り、枚数有利を作る基本作戦です。",
          "前線の主導権を取りに行きます。",
          "C. 💧 迎撃対応",
          "本陣への被害を受け入れつつ、前線維持を優先する迎撃作戦です。",
          "敵前線を削り、崩壊を遅らせます。",
          "◆━━━━━━━━━━━━━━━━━━━━◆",
          "10ラウンド以内に勝利へ導いてください。",
          "栄光を掴み取りましょう、司令。👊",
        ];
      }

      function showIntroBriefing() {
        const overlay = document.getElementById("introOverlay");
        const body = document.getElementById("introBody");
        body.innerHTML = getIntroBriefingLines().map((line) => `<div>${line}</div>`).join("");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.isIntroBriefingOpen = true;
        setCommandButtonsEnabled(false);
      }

      function hideIntroBriefing() {
        const overlay = document.getElementById("introOverlay");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        state.isIntroBriefingOpen = false;
        if (!state.result && !state.isConfirmMode && !state.isTitleScreenOpen) {
          setCommandButtonsEnabled(true);
        }
      }

      function showSoundConfig() {
        const overlay = document.getElementById("soundOverlay");
        setBgmVolume(state.bgmVolume);
        refreshSoundSelectionUi();
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.isSoundConfigOpen = true;
        setCommandButtonsEnabled(false);
        if (state.isBgmEnabled) {
          tryPreviewBgmPlayback();
        }
      }

      function hideSoundConfig() {
        const overlay = document.getElementById("soundOverlay");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        state.isSoundConfigOpen = false;
      }

      function handleSoundSelection(enabled) {
        state.isBgmEnabled = enabled;
        if (enabled) {
          refreshSoundSelectionUi();
          ensureBgmPlayback();
        } else {
          stopBgmPlayback();
          refreshSoundSelectionUi();
        }
      }

      function handleSoundConfigConfirm() {
        hideSoundConfig();
      }

      function handleGameStart() {
        hideTitleScreen();
        if (state.isBgmEnabled) {
          ensureBgmPlayback();
        } else {
          stopBgmPlayback();
        }
        showIntroBriefing();
        render();
      }

      function getBattleSnapshot() {
        const activeA = getActiveUnitCount("A");
        const activeB = getActiveUnitCount("B");
        const repairingUnitsA = state.repairQueueA.length;
        const repairingUnitsB = state.repairQueueB.length;
        const repairLoadA = getRepairLoad(state.repairQueueA);
        const repairLoadB = getRepairLoad(state.repairQueueB);
        return {
          baseHpA: state.baseHpA,
          baseHpB: state.baseHpB,
          activeUnitsA: activeA,
          activeUnitsB: activeB,
          repairingUnitsA,
          repairingUnitsB,
          repairLoadA,
          repairLoadB,
        };
      }

      function getBattleRatesFromSnapshot(snapshot) {
        const frontlineAdvantage = Math.max(
          -1,
          Math.min(1, (snapshot.activeUnitsA - snapshot.activeUnitsB) / Math.max(1, Math.max(maxUnitsA, maxUnitsB))),
        );
        return {
          attackPowerRateA: maxUnitsA > 0 ? snapshot.activeUnitsA / maxUnitsA : 0,
          attackPowerRateB: maxUnitsB > 0 ? snapshot.activeUnitsB / maxUnitsB : 0,
          repairRateA: Math.max(0, Math.min(1, snapshot.repairLoadA / REPAIR_GAUGE_DISPLAY_MAX)),
          repairRateB: Math.max(0, Math.min(1, snapshot.repairLoadB / REPAIR_GAUGE_DISPLAY_MAX)),
          frontlineAdvantage,
        };
      }

      function syncDisplayedBattleState(snapshot) {
        const rates = getBattleRatesFromSnapshot(snapshot);
        state.displayedAttackPowerRateA = rates.attackPowerRateA;
        state.displayedAttackPowerRateB = rates.attackPowerRateB;
        state.displayedRepairRateA = rates.repairRateA;
        state.displayedRepairRateB = rates.repairRateB;
        state.displayedFrontlineAdvantage = rates.frontlineAdvantage;
      }

      function classifySeverity(value, thresholds) {
        if (value <= 0) return "none";
        if (value <= thresholds.micro) return "micro";
        if (value <= thresholds.small) return "small";
        if (value <= thresholds.medium) return "medium";
        return "large";
      }

      function severitySymbol(direction, severity) {
        if (severity === "none") return "変化なし";
        if (direction === "impact") {
          if (severity === "micro") return "！";
          if (severity === "small") return "！！";
          if (severity === "medium") return "！！！";
          return "！！！！";
        }
        if (direction === "down") {
          if (severity === "micro") return "↘︎";
          if (severity === "small") return "↓";
          if (severity === "medium") return "↓↓";
          return "↓↓↓";
        }
        if (direction === "up") {
          if (severity === "micro") return "↗︎";
          if (severity === "small") return "↑";
          if (severity === "medium") return "↑↑";
          return "↑↑↑";
        }
        return "変化なし";
      }

      function diffSymbol(value, thresholds = { micro: 1, small: 2, medium: 3 }) {
        if (value === 0) return "変化なし";
        const severity = classifySeverity(Math.abs(value), thresholds);
        if (severity === "none") return "変化なし";
        if (value > 0) {
          if (severity === "micro") return "↗︎";
          if (severity === "small") return "↑";
          if (severity === "medium") return "↑↑";
          return "↑↑↑";
        }
        if (severity === "micro") return "↘︎";
        if (severity === "small") return "↓";
        if (severity === "medium") return "↓↓";
        return "↓↓↓";
      }

      function makeReportLine(emoji, label, direction, value, thresholds, includeNone = false) {
        const severity = classifySeverity(value, thresholds);
        if (severity === "none" && !includeNone) {
          return null;
        }
        return {
          text: `${emoji} ${label}　${severitySymbol(direction, severity)}`,
          severity,
        };
      }

      function frontlineDiffLine(activeDiff) {
        const diff = Math.abs(activeDiff);
        if (diff === 0) {
          return {
            text: "📊 前線差：拮抗",
            severity: "none",
          };
        }
        const severity = classifySeverity(diff, { micro: 1, small: 2, medium: 3 });
        const status = activeDiff > 0 ? "有利" : "不利";
        const direction = activeDiff > 0 ? "up" : "down";
        return {
          text: `📊 前線差：${status}　${severitySymbol(direction, severity)}`,
          severity,
        };
      }

      function buildRoundReport(commandId, before, after, recovered) {
        const damageToEnemyBase = Math.max(0, before.baseHpB - after.baseHpB);
        const damageToAllyBase = Math.max(0, before.baseHpA - after.baseHpA);
        const enemyActiveLoss = Math.max(0, before.activeUnitsB - after.activeUnitsB);
        const allyActiveLoss = Math.max(0, before.activeUnitsA - after.activeUnitsA);
        const enemyRepairLoadDelta = after.repairLoadB - before.repairLoadB;
        const allyRepairLoadDelta = after.repairLoadA - before.repairLoadA;
        const enemyRecoveredCount = recovered.B;
        const allyRecoveredCount = recovered.A;
        const activeDiff = after.activeUnitsA - after.activeUnitsB;
        const activeDiffDelta = activeDiff - (before.activeUnitsA - before.activeUnitsB);

        const lines = [
          `📊 前線差　${diffSymbol(activeDiffDelta, { micro: 1, small: 2, medium: 3 })}`,
          `🛡️ 味方本陣耐久　${diffSymbol(after.baseHpA - before.baseHpA, { micro: 499, small: 999, medium: 1999 })}`,
          `💥 敵本陣耐久　${diffSymbol(after.baseHpB - before.baseHpB, { micro: 499, small: 999, medium: 1999 })}`,
          `⚔️ 味方前線攻撃力　${diffSymbol(after.activeUnitsA - before.activeUnitsA, { micro: 1, small: 2, medium: 3 })}`,
          `⚔️ 敵前線攻撃力　${diffSymbol(after.activeUnitsB - before.activeUnitsB, { micro: 1, small: 2, medium: 3 })}`,
          `🔧 味方修理負荷　${diffSymbol(after.repairLoadA - before.repairLoadA, { micro: 1, small: 2, medium: 5 })}`,
          `🔧 敵修理負荷　${diffSymbol(after.repairLoadB - before.repairLoadB, { micro: 1, small: 2, medium: 5 })}`,
          `✅ 味方復帰　${diffSymbol(allyRecoveredCount, { micro: 1, small: 2, medium: 3 })}`,
          `☑️ 敵復帰　${diffSymbol(enemyRecoveredCount, { micro: 1, small: 2, medium: 3 })}`,
        ];

        return {
          round: before.round,
          commandLabel: commandId,
          bodyLines: lines,
        };
      }

      function calculateResultScore() {
        const allyHp = Math.max(0, state.baseHpA);
        const enemyHp = Math.max(0, state.baseHpB);
        const baseScore = state.result === "WIN" ? 40 : state.result === "DRAW" ? 20 : 10;
        const allyHpScoreBaseHp = maxBaseHp / 2;
        const allyHpScore = (allyHp / allyHpScoreBaseHp) * 50;
        const enemyDamageScore = ((maxBaseHp - enemyHp) / maxBaseHp) * 10;
        return baseScore + allyHpScore + enemyDamageScore;
      }

      function showRoundReport(report) {
        const overlay = document.getElementById("roundReportOverlay");
        document.getElementById("roundReportTitle").textContent = `ROUND ${report.round} 📊戦況レポート`;
        document.getElementById("roundReportCommand").textContent = `前回作戦: ${report.commandLabel}`;
        const body = document.getElementById("roundReportBody");
        body.innerHTML = "";
        for (const line of report.bodyLines) {
          const row = document.createElement("div");
          row.className = "round-report-line";
          row.textContent = line;
          body.appendChild(row);
        }
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.lastRoundReport = report;
        state.isRoundReportOpen = true;
        setCommandButtonsEnabled(false);
      }

      function reopenRoundReport() {
        if (state.result || state.isConfirmMode || state.isIntroBriefingOpen || state.isSoundConfigOpen || state.isTitleScreenOpen) {
          return;
        }
        const isRound1 = Math.min(state.round, maxRound) <= 1;
        if (isRound1) {
          showIntroBriefing();
          return;
        }
        if (!state.lastRoundReport) return;
        showRoundReport(state.lastRoundReport);
      }

      function hideRoundReport() {
        const overlay = document.getElementById("roundReportOverlay");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        document.getElementById("roundReportTitle").textContent = "";
        document.getElementById("roundReportCommand").textContent = "";
        document.getElementById("roundReportBody").innerHTML = "";
        state.isRoundReportOpen = false;
        state.pendingRoundAdvance = false;
        if (!state.result && !state.isConfirmMode && !state.isIntroBriefingOpen && !state.isSoundConfigOpen && !state.isTitleScreenOpen) {
          setCommandButtonsEnabled(true);
        }
      }

      function showOperationConfirm(commandId) {
        if (state.result || state.isIntroBriefingOpen || state.isRoundReportOpen || state.isSoundConfigOpen || state.isTitleScreenOpen || state.isBootModalOpen) return;
        const overlay = document.getElementById("operationConfirmOverlay");
        document.getElementById("confirmCommand").textContent = commandId;
        document.getElementById("confirmBody").innerHTML = getCommandPreviewReport(commandId)
          .split("<br />")
          .map((line) => `<div>${line}</div>`)
          .join("");
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        state.pendingCommand = commandId;
        state.isConfirmMode = true;
        setCommandButtonsEnabled(false);
      }

      function hideOperationConfirm() {
        const overlay = document.getElementById("operationConfirmOverlay");
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
        document.getElementById("confirmCommand").textContent = "";
        document.getElementById("confirmBody").innerHTML = "";
        state.pendingCommand = null;
        state.isConfirmMode = false;
        setCommandButtonsEnabled(true);
      }

      function getActiveUnitCount(team) {
        return team === "A" ? maxUnitsA - state.repairQueueA.length : maxUnitsB - state.repairQueueB.length;
      }

      function getNextRepairUnitName(team) {
        if (team === "A") {
          const name = repairUnitNames[state.nextRepairUnitIndexA % repairUnitNames.length];
          state.nextRepairUnitIndexA += 1;
          return name;
        }
        const name = repairUnitNames[state.nextRepairUnitIndexB % repairUnitNames.length];
        state.nextRepairUnitIndexB += 1;
        return name;
      }

      function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      async function waitPhase(ms) {
        const token = ++state.phaseWaitToken;
        state.isPhaseWaiting = true;
        setCommandButtonsEnabled(false);
        await sleep(ms);
        if (token !== state.phaseWaitToken) {
          return false;
        }
        state.isPhaseWaiting = false;
        if (!state.result && !state.isConfirmMode && !state.isIntroBriefingOpen && !state.isRoundReportOpen && !state.isUnitDeltaAnimating && !state.isBaseHpAnimating && !state.isOtherGaugeAnimating) {
          setCommandButtonsEnabled(true);
        }
        return true;
      }

      function buildInterleavedTeams(countA, countB) {
        const order = [];
        let remainingA = countA;
        let remainingB = countB;
        let lastTeam = null;
        while (remainingA > 0 || remainingB > 0) {
          let nextTeam = null;
          if (remainingA > 0 && remainingB > 0) {
            if (lastTeam === "A") {
              nextTeam = "B";
            } else if (lastTeam === "B") {
              nextTeam = "A";
            } else {
              nextTeam = remainingA >= remainingB ? "A" : "B";
            }
          } else if (remainingA > 0) {
            nextTeam = "A";
          } else {
            nextTeam = "B";
          }
          order.push(nextTeam);
          if (nextTeam === "A") {
            remainingA -= 1;
          } else {
            remainingB -= 1;
          }
          lastTeam = nextTeam;
        }
        return order;
      }

      async function playUnitDeltaAnimation(before, after) {
        const removeA = Math.max(0, before.activeUnitsA - after.activeUnitsA);
        const removeB = Math.max(0, before.activeUnitsB - after.activeUnitsB);
        const addA = Math.max(0, after.activeUnitsA - before.activeUnitsA);
        const addB = Math.max(0, after.activeUnitsB - before.activeUnitsB);
        const token = ++state.unitDeltaAnimationToken;

        state.isUnitDeltaAnimating = true;
        state.unitDisplayCountA = before.activeUnitsA;
        state.unitDisplayCountB = before.activeUnitsB;
        state.unitDeltaPulse = null;
        setCommandButtonsEnabled(false);
        render();

        const runStep = async (team, mode) => {
          if (token !== state.unitDeltaAnimationToken) return false;
          const currentCount = team === "A" ? state.unitDisplayCountA : state.unitDisplayCountB;
          const maxUnits = team === "A" ? maxUnitsA : maxUnitsB;
          const slotNumber = mode === "remove"
            ? maxUnits - currentCount + 1
            : maxUnits - currentCount;
          if (slotNumber < 1 || slotNumber > maxUnits) return true;
          if (mode === "remove") {
            state.unitDeltaPulse = { team, slotNumber, mode };
            render();
            await sleep(120);
            if (token !== state.unitDeltaAnimationToken) return false;
            if (team === "A") {
              state.unitDisplayCountA = Math.max(0, state.unitDisplayCountA - 1);
            } else {
              state.unitDisplayCountB = Math.max(0, state.unitDisplayCountB - 1);
            }
            render();
            await sleep(90);
          } else {
            if (team === "A") {
              state.unitDisplayCountA = Math.min(maxUnitsA, state.unitDisplayCountA + 1);
            } else {
              state.unitDisplayCountB = Math.min(maxUnitsB, state.unitDisplayCountB + 1);
            }
            state.unitDeltaPulse = { team, slotNumber, mode };
            render();
            await sleep(120);
            if (token !== state.unitDeltaAnimationToken) return false;
          }
          state.unitDeltaPulse = null;
          render();
          await sleep(40);
          return true;
        };

        const removalOrder = buildInterleavedTeams(removeA, removeB);
        for (const team of removalOrder) {
          const ok = await runStep(team, "remove");
          if (!ok || token !== state.unitDeltaAnimationToken) break;
        }

        const additionOrder = buildInterleavedTeams(addA, addB);
        for (const team of additionOrder) {
          const ok = await runStep(team, "add");
          if (!ok || token !== state.unitDeltaAnimationToken) break;
        }

        state.unitDeltaPulse = null;
        state.unitDisplayCountA = after.activeUnitsA;
        state.unitDisplayCountB = after.activeUnitsB;
        state.isUnitDeltaAnimating = false;
        render();
      }

      function animateBaseHpGauge(before, after, token, duration) {
        const start = performance.now();
        return new Promise((resolve) => {
          const step = (now) => {
            if (token !== state.gaugeAnimationToken) {
              resolve(false);
              return;
            }
            const elapsed = Math.max(0, now - start);
            const t = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            state.baseHpDisplayA = Math.round(before.baseHpA + (after.baseHpA - before.baseHpA) * eased);
            state.baseHpDisplayB = Math.round(before.baseHpB + (after.baseHpB - before.baseHpB) * eased);
            render();
            if (t < 1) {
              requestAnimationFrame(step);
              return;
            }
            resolve(true);
          };
          requestAnimationFrame(step);
        });
      }

      function animateOtherGauges(before, after, token, duration) {
        const start = performance.now();
        return new Promise((resolve) => {
          const step = (now) => {
            if (token !== state.gaugeAnimationToken) {
              resolve(false);
              return;
            }
            const elapsed = Math.max(0, now - start);
            const t = Math.min(1, elapsed / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            state.displayedAttackPowerRateA = before.attackPowerRateA + (after.attackPowerRateA - before.attackPowerRateA) * eased;
            state.displayedAttackPowerRateB = before.attackPowerRateB + (after.attackPowerRateB - before.attackPowerRateB) * eased;
            state.displayedRepairRateA = before.repairRateA + (after.repairRateA - before.repairRateA) * eased;
            state.displayedRepairRateB = before.repairRateB + (after.repairRateB - before.repairRateB) * eased;
            state.displayedFrontlineAdvantage = before.frontlineAdvantage + (after.frontlineAdvantage - before.frontlineAdvantage) * eased;
            render();
            if (t < 1) {
              requestAnimationFrame(step);
              return;
            }
            resolve(true);
          };
          requestAnimationFrame(step);
        });
      }

      async function playBattleGaugeAnimation(before, after) {
        const token = ++state.gaugeAnimationToken;
        const baseChanged = before.baseHpA !== after.baseHpA || before.baseHpB !== after.baseHpB;

        state.isBaseHpAnimating = true;
        state.baseHpDisplayA = before.baseHpA;
        state.baseHpDisplayB = before.baseHpB;
        setCommandButtonsEnabled(false);
        render();

        if (baseChanged) {
          const okBase = await animateBaseHpGauge(before, after, token, 400);
          if (!okBase || token !== state.gaugeAnimationToken) {
            return false;
          }
        } else {
          state.baseHpDisplayA = after.baseHpA;
          state.baseHpDisplayB = after.baseHpB;
          render();
        }

        state.baseHpDisplayA = after.baseHpA;
        state.baseHpDisplayB = after.baseHpB;
        state.isBaseHpAnimating = false;
        render();
        return true;
      }

      function addRepairsFromDamage(team, damageAmount) {
        const damagePoolKey = team === "A" ? "damagePoolA" : "damagePoolB";
        const queueKey = team === "A" ? "repairQueueA" : "repairQueueB";
        state[damagePoolKey] += damageAmount;
        resolveRepairPool(team);
      }

      function resolveRepairPool(team) {
        const damagePoolKey = team === "A" ? "damagePoolA" : "damagePoolB";
        const queueKey = team === "A" ? "repairQueueA" : "repairQueueB";
        const maxUnits = team === "A" ? maxUnitsA : maxUnitsB;
        while (state[damagePoolKey] >= FRONTLINE_DAMAGE_PER_CASUALTY && state[queueKey].length < maxUnits) {
          state[damagePoolKey] -= FRONTLINE_DAMAGE_PER_CASUALTY;
          state[queueKey].push({ name: getNextRepairUnitName(team), timer: 3 });
        }
      }

      function advanceRepairQueues() {
        const recovered = { A: 0, B: 0 };
        for (const queue of [state.repairQueueA, state.repairQueueB]) {
          for (let i = queue.length - 1; i >= 0; i--) {
            queue[i].timer -= 1;
            if (queue[i].timer <= 0) {
              if (queue === state.repairQueueA) {
                recovered.A += 1;
              } else {
                recovered.B += 1;
              }
              queue.splice(i, 1);
            }
          }
        }
        resolveRepairPool("A");
        resolveRepairPool("B");
        return recovered;
      }

      function showResult() {
        const resultOverlay = document.getElementById("resultOverlay");
        const resultCard = document.querySelector(".result-card");
        const resultTitle = document.getElementById("resultTitle");
        const resultSubtitle = document.getElementById("resultSubtitle");
        const resultRound = document.getElementById("resultRound");
        const resultScore = document.getElementById("resultScore");
        const resultEnemyHp = document.getElementById("resultEnemyHp");
        const resultAllyHp = document.getElementById("resultAllyHp");
        const resultHistory = document.getElementById("resultHistory");
        resultCard.classList.remove("win", "lose", "draw");
        if (state.result === "WIN") {
          resultCard.classList.add("win");
        } else if (state.result === "LOSE") {
          resultCard.classList.add("lose");
        } else {
          resultCard.classList.add("draw");
        }
        resultOverlay.classList.add("show");
        resultOverlay.setAttribute("aria-hidden", "false");
        resultTitle.textContent = state.result ?? "";
        if (state.result === "WIN") {
          resultSubtitle.textContent = "作戦成功";
        } else if (state.result === "LOSE") {
          resultSubtitle.textContent = "作戦失敗";
        } else {
          resultSubtitle.textContent = "戦線膠着";
        }
        resultRound.textContent = `Round ${Math.min(state.round, maxRound)} / ${maxRound}`;
        const scoreValue = calculateResultScore();
        resultScore.textContent = `SCORE ${Math.round(scoreValue * 10) / 10}`;
        resultEnemyHp.textContent = `${Math.max(0, Math.min(maxBaseHp, state.baseHpDisplayB))} / ${maxBaseHp}`;
        resultAllyHp.textContent = `${Math.max(0, Math.min(maxBaseHp, state.baseHpDisplayA))} / ${maxBaseHp}`;
        resultHistory.textContent = `作戦履歴: ${state.commandHistory.length ? state.commandHistory.join(" ") : "なし"}`;
        hideOperationConfirm();
        hideIntroBriefing();
        hideRoundReport();
        state.pendingResult = null;
        state.pendingRoundAdvance = false;
      }

      function cancelBattleAnimations() {
        state.unitDeltaAnimationToken += 1;
        state.gaugeAnimationToken += 1;
        state.phaseWaitToken += 1;
        state.isUnitDeltaAnimating = false;
        state.isBaseHpAnimating = false;
        state.isOtherGaugeAnimating = false;
        state.isPhaseWaiting = false;
        state.unitDeltaPulse = null;
        state.unitDisplayCountA = getActiveUnitCount("A");
        state.unitDisplayCountB = getActiveUnitCount("B");
        state.baseHpDisplayA = state.baseHpA;
        state.baseHpDisplayB = state.baseHpB;
        syncDisplayedBattleState(getBattleSnapshot());
      }

      function resetGame() {
        state.round = 1;
        state.baseHpA = maxBaseHp;
        state.baseHpB = maxBaseHp;
        state.result = null;
        state.commandHistory = [];
        state.repairQueueA = [];
        state.repairQueueB = [];
        state.damagePoolA = 0;
        state.damagePoolB = 0;
        state.nextRepairUnitIndexA = 0;
        state.nextRepairUnitIndexB = 0;
        state.pendingCommand = null;
        state.pendingResult = null;
        state.pendingRoundAdvance = false;
        state.isConfirmMode = false;
        state.isTitleScreenOpen = false;
        state.isBootModalOpen = false;
        state.bootProgress = 0;
        state.isBootReady = false;
        state.isIntroBriefingOpen = false;
        state.isSoundConfigOpen = false;
        state.lastRoundReport = null;
        state.isRoundReportOpen = false;
        state.isUnitDeltaAnimating = false;
        state.isPhaseWaiting = false;
        state.unitDeltaPulse = null;
        state.unitDisplayCountA = maxUnitsA;
        state.unitDisplayCountB = maxUnitsB;
        state.baseHpDisplayA = maxBaseHp;
        state.baseHpDisplayB = maxBaseHp;
        state.unitDeltaAnimationToken += 1;
        state.gaugeAnimationToken += 1;
        state.phaseWaitToken += 1;
        state.isBaseHpAnimating = false;
        state.isOtherGaugeAnimating = false;
        state.displayedAttackPowerRateA = 1;
        state.displayedAttackPowerRateB = 1;
        state.displayedRepairRateA = 0;
        state.displayedRepairRateB = 0;
        state.displayedFrontlineAdvantage = 0;
        state.isBgmEnabled = true;
        state.bgmVolume = BGM_VOLUME;
        state.seVolume = SE_VOLUME;
        stopBgmPlayback();
        refreshOperatorMessage();
        hideOperationConfirm();
        hideTitleScreen();
        hideBootModal();
        hideSoundConfig();
        hideIntroBriefing();
        hideRoundReport();
        document.getElementById("resultOverlay").classList.remove("show");
        document.getElementById("resultOverlay").setAttribute("aria-hidden", "true");
        document.getElementById("resultTitle").textContent = "";
        document.getElementById("resultSubtitle").textContent = "";
        document.getElementById("resultRound").textContent = "";
        document.getElementById("resultScore").textContent = "";
        document.getElementById("resultEnemyHp").textContent = "";
        document.getElementById("resultAllyHp").textContent = "";
        document.getElementById("resultHistory").textContent = "";
        setCommandButtonsEnabled(true);
        showTitleScreen();
        showBootModal();
        render();
      }

      async function executeCommand(commandId) {
        if (state.result) return;

        const before = {
          round: state.round,
          ...getBattleSnapshot(),
        };
        const beforeRates = getBattleRatesFromSnapshot(before);
        state.baseHpDisplayA = before.baseHpA;
        state.baseHpDisplayB = before.baseHpB;
        state.displayedAttackPowerRateA = beforeRates.attackPowerRateA;
        state.displayedAttackPowerRateB = beforeRates.attackPowerRateB;
        state.displayedRepairRateA = beforeRates.repairRateA;
        state.displayedRepairRateB = beforeRates.repairRateB;
        state.displayedFrontlineAdvantage = beforeRates.frontlineAdvantage;
        state.commandHistory.push(commandId[0]);

        const chosenDamage = getCommandDamage(commandId);
        const activeA = getActiveUnitCount("A");
        const activeB = getActiveUnitCount("B");
        // Base damage affects base HP.
        // Frontline damage affects casualty / repair pressure.
        const effectiveBaseDamageReceived = Math.round(chosenDamage.baseDamageReceived * (activeB / maxUnitsB));
        const effectiveBaseDamageDealt = Math.round(chosenDamage.baseDamageDealt * (activeA / maxUnitsA));
        const effectiveFrontlineDamageReceived = Math.round(chosenDamage.frontlineDamageReceived * (activeB / maxUnitsB));
        const effectiveFrontlineDamageDealt = Math.round(chosenDamage.frontlineDamageDealt * (activeA / maxUnitsA));

        state.baseHpA = Math.max(0, state.baseHpA - effectiveBaseDamageReceived);
        state.baseHpB = Math.max(0, state.baseHpB - effectiveBaseDamageDealt);
        addRepairsFromDamage("A", effectiveFrontlineDamageReceived);
        addRepairsFromDamage("B", effectiveFrontlineDamageDealt);
        const recovered = advanceRepairQueues();
        const after = {
          round: state.round,
          ...getBattleSnapshot(),
        };
        const afterRates = getBattleRatesFromSnapshot(after);
        const report = buildRoundReport(commandId, before, after, recovered);
        const hasUnitDelta = before.activeUnitsA !== after.activeUnitsA || before.activeUnitsB !== after.activeUnitsB;
        const resultReached = judgeResult() || state.round >= maxRound;
        if (resultReached && !state.result) {
          finalizeByHp();
        }
        if (resultReached) {
          state.pendingResult = state.result;
          state.lastRoundReport = null;
          state.isRoundReportOpen = false;
          state.pendingRoundAdvance = false;
        } else {
          state.pendingRoundAdvance = true;
        }

        if (!(await waitPhase(400))) return;

        if (hasUnitDelta) {
          await playUnitDeltaAnimation(before, after);
        }

        if (!(await waitPhase(500))) return;

        const gaugeBefore = { ...beforeRates, baseHpA: before.baseHpA, baseHpB: before.baseHpB };
        const gaugeAfter = { ...afterRates, baseHpA: after.baseHpA, baseHpB: after.baseHpB };
        const hpBefore = {
          baseHpA: gaugeBefore.baseHpA,
          baseHpB: gaugeBefore.baseHpB,
          attackPowerRateA: gaugeBefore.attackPowerRateA,
          attackPowerRateB: gaugeBefore.attackPowerRateB,
          repairRateA: gaugeBefore.repairRateA,
          repairRateB: gaugeBefore.repairRateB,
          frontlineAdvantage: gaugeBefore.frontlineAdvantage,
        };
        const hpAfter = {
          baseHpA: gaugeAfter.baseHpA,
          baseHpB: gaugeAfter.baseHpB,
          attackPowerRateA: gaugeBefore.attackPowerRateA,
          attackPowerRateB: gaugeBefore.attackPowerRateB,
          repairRateA: gaugeBefore.repairRateA,
          repairRateB: gaugeBefore.repairRateB,
          frontlineAdvantage: gaugeBefore.frontlineAdvantage,
        };
        if (!(await playBattleGaugeAnimation(hpBefore, hpAfter))) {
          state.isOtherGaugeAnimating = false;
          return;
        }

        state.isOtherGaugeAnimating = true;
        if (!(await waitPhase(400))) return;

        const otherBefore = {
          baseHpA: hpAfter.baseHpA,
          baseHpB: hpAfter.baseHpB,
          attackPowerRateA: gaugeBefore.attackPowerRateA,
          attackPowerRateB: gaugeBefore.attackPowerRateB,
          repairRateA: gaugeBefore.repairRateA,
          repairRateB: gaugeBefore.repairRateB,
          frontlineAdvantage: gaugeBefore.frontlineAdvantage,
        };
        const otherAfter = {
          baseHpA: hpAfter.baseHpA,
          baseHpB: hpAfter.baseHpB,
          attackPowerRateA: gaugeAfter.attackPowerRateA,
          attackPowerRateB: gaugeAfter.attackPowerRateB,
          repairRateA: gaugeAfter.repairRateA,
          repairRateB: gaugeAfter.repairRateB,
          frontlineAdvantage: gaugeAfter.frontlineAdvantage,
        };
        if (!(await animateOtherGauges(otherBefore, otherAfter, state.gaugeAnimationToken, 400))) {
          state.isOtherGaugeAnimating = false;
          return;
        }
        state.isOtherGaugeAnimating = false;

        if (!(await waitPhase(500))) return;

        if (state.pendingResult) {
          showResult();
          return;
        }

        state.lastRoundReport = report;
        state.isRoundReportOpen = false;
        state.pendingRoundAdvance = false;
        state.round = Math.min(state.round + 1, maxRound);
        refreshOperatorMessage();
        render();
        showRoundReport(report);
      }

      function handleCommand(commandId) {
        if (state.result || state.isConfirmMode || state.isTitleScreenOpen || state.isBootModalOpen || state.isIntroBriefingOpen || state.isSoundConfigOpen || state.isRoundReportOpen || state.isUnitDeltaAnimating || state.isBaseHpAnimating || state.isOtherGaugeAnimating || state.isPhaseWaiting) return;
        showOperationConfirm(commandId);
      }

      function handleConfirmAction(action) {
        if (!state.isConfirmMode) return;
        if (action === "confirm") {
          const pending = state.pendingCommand;
          hideOperationConfirm();
          if (pending) {
            executeCommand(pending);
          }
          return;
        }

        if (action === "cancel") {
          hideOperationConfirm();
          render();
        }
      }

      document.querySelectorAll("button[data-command]").forEach((button) => {
        button.addEventListener("click", () => {
          playSe("button_positive");
          handleCommand(button.dataset.command);
        });
      });

      document.getElementById("confirmYesButton").addEventListener("click", () => {
        playSe("button_confirm");
        handleConfirmAction("confirm");
      });
      document.getElementById("confirmNoButton").addEventListener("click", () => {
        playSe("button_cancel");
        handleConfirmAction("cancel");
      });

      document.getElementById("bootStartButton").addEventListener("click", () => {
        playSe("button_positive");
        handleBootStart();
      });
      document.getElementById("gameStartButton").addEventListener("click", () => {
        playSe("button_positive");
        handleGameStart();
      });
      document.getElementById("soundSettingButton").addEventListener("click", () => {
        playSe("button_positive");
        showSoundConfig();
      });
      document.getElementById("restartButton").addEventListener("click", () => {
        playSe("button_positive");
        resetGame();
      });
      document.getElementById("soundOnButton").addEventListener("click", () => {
        playSe("button_positive");
        handleSoundSelection(true);
      });
      document.getElementById("soundOffButton").addEventListener("click", () => {
        playSe("button_positive");
        handleSoundSelection(false);
      });
      document.getElementById("soundStartButton").addEventListener("click", () => {
        playSe("button_confirm");
        handleSoundConfigConfirm();
      });
      document.getElementById("soundVolumeSlider").addEventListener("input", (event) => {
        setBgmVolume(event.target.value);
        if (state.isBgmEnabled) {
          ensureBgmPlayback();
        }
      });
      document.getElementById("seVolumeSlider").addEventListener("input", (event) => {
        setSeVolume(event.target.value);
      });
      document.getElementById("introOkButton").addEventListener("click", () => {
        playSe("button_confirm");
        hideIntroBriefing();
        render();
      });
      document.getElementById("roundReportOkButton").addEventListener("click", () => {
        playSe("button_positive");
        hideRoundReport();
        render();
      });
      document.getElementById("reportReopenButton").addEventListener("click", () => {
        reopenRoundReport();
      });
      document.getElementById("backButton").addEventListener("click", () => {
        playSe("button_cancel");
        history.back();
      });
      document.getElementById("reloadButton").addEventListener("click", () => {
        playSe("button_negative");
        location.reload();
      });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && state.isBgmEnabled) {
          prepareBgmPlayback().finally(() => {
            syncBgmOutputState();
          });
        }
      });

      refreshSystemPanelVisibility();
      const standaloneQuery = window.matchMedia("(display-mode: standalone)");
      if (typeof standaloneQuery.addEventListener === "function") {
        standaloneQuery.addEventListener("change", refreshSystemPanelVisibility);
      }

      refreshVersionBadge();
      setBgmVolume(state.bgmVolume);
      syncBgmVolumeUi();
      setSeVolume(state.seVolume);
      syncSeVolumeUi();
      refreshOperatorMessage();
      refreshBootProgressUi();
      showTitleScreen();
      showBootModal();
      render();
    
})();
