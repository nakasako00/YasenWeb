(function () {
  function isFileProtocol() {
    return window.location.protocol === "file:";
  }

  function shouldUseWebAudio() {
    return !isFileProtocol();
  }

  function create(options) {
    const state = options.state;
    const bgmVolumeRate = options.bgmVolumeRate;
    const bgmAudio = new Audio(options.bgmPath);
    bgmAudio.loop = true;
    bgmAudio.preload = "auto";
    bgmAudio.volume = 1;
    bgmAudio.load();

    const seAudioMap = Object.fromEntries(
      Object.entries(options.sePaths).map(([key, path]) => {
        const audio = new Audio(path);
        audio.preload = "auto";
        audio.load();
        return [key, audio];
      }),
    );

    let bgmAudioContext = null;
    let bgmSourceNode = null;
    let bgmGainNode = null;
    let hasInitializedAudioGraph = false;

    function getEffectiveBgmVolume() {
      return state.bgmVolume * bgmVolumeRate;
    }

    function syncBgmVolumeUi() {
      const slider = document.getElementById("soundVolumeSlider");
      const value = document.getElementById("soundVolumeValue");
      if (slider) {
        slider.value = String(state.bgmVolume);
      }
      if (value) {
        value.textContent = `${Math.round(state.bgmVolume * 100)}%`;
      }
    }

    function syncSeVolumeUi() {
      const slider = document.getElementById("seVolumeSlider");
      const value = document.getElementById("seVolumeValue");
      if (slider) {
        slider.value = String(state.seVolume);
      }
      if (value) {
        value.textContent = `${Math.round(state.seVolume * 100)}%`;
      }
    }

    function playSe(seId) {
      const audio = seAudioMap[seId];
      if (!audio) return;
      const playTarget = !audio.paused && !audio.ended
        ? audio.cloneNode()
        : audio;
      playTarget.volume = state.seVolume;
      playTarget.currentTime = 0;
      playTarget.play().catch(() => {});
    }

    function setBgmVolume(nextVolume) {
      const clampedVolume = Math.max(0, Math.min(1, Number(nextVolume)));
      state.bgmVolume = Number.isFinite(clampedVolume) ? clampedVolume : state.bgmVolume;
      if (shouldUseWebAudio()) {
        bgmAudio.volume = 1;
      } else {
        bgmAudio.volume = getEffectiveBgmVolume();
      }
      if (shouldUseWebAudio() && bgmGainNode) {
        bgmGainNode.gain.value = getEffectiveBgmVolume();
      }
      syncBgmVolumeUi();
    }

    function setSeVolume(nextVolume) {
      const clampedVolume = Math.max(0, Math.min(1, Number(nextVolume)));
      state.seVolume = Number.isFinite(clampedVolume) ? clampedVolume : state.seVolume;
      syncSeVolumeUi();
    }

    function initializeBgmAudioGraph() {
      if (!shouldUseWebAudio() || hasInitializedAudioGraph) return;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      bgmAudioContext = new AudioContextClass();
      bgmSourceNode = bgmAudioContext.createMediaElementSource(bgmAudio);
      bgmGainNode = bgmAudioContext.createGain();
      bgmGainNode.gain.value = getEffectiveBgmVolume();
      bgmSourceNode.connect(bgmGainNode);
      bgmGainNode.connect(bgmAudioContext.destination);
      hasInitializedAudioGraph = true;
    }

    function prepareBgmPlayback() {
      if (!shouldUseWebAudio()) {
        bgmAudio.volume = getEffectiveBgmVolume();
        return Promise.resolve();
      }
      try {
        initializeBgmAudioGraph();
        if (bgmAudioContext && bgmAudioContext.state === "suspended") {
          return bgmAudioContext.resume().catch((error) => {
            console.warn("AudioContext resume failed.", error);
          });
        }
      } catch (error) {
        console.warn("BGM audio graph initialization failed.", error);
      }
      return Promise.resolve();
    }

    function tryPreviewBgmPlayback() {
      if (!state.isBgmEnabled || state.hasStartedBgm) return;
      prepareBgmPlayback().finally(() => {
        if (!state.isBgmEnabled || state.hasStartedBgm) return;
        if (shouldUseWebAudio() && bgmGainNode) {
          bgmGainNode.gain.value = getEffectiveBgmVolume();
        }
        bgmAudio.play().then(() => {
          state.hasStartedBgm = true;
          console.log("BGM preview playback started.");
        }).catch((error) => {
          state.hasStartedBgm = false;
          console.warn("BGM preview playback failed.", error);
        });
      });
    }

    function ensureBgmPlayback() {
      if (!state.isBgmEnabled || state.hasStartedBgm) return;
      prepareBgmPlayback().finally(() => {
        if (!state.isBgmEnabled || state.hasStartedBgm) return;
        if (shouldUseWebAudio() && bgmGainNode) {
          bgmGainNode.gain.value = getEffectiveBgmVolume();
        }
        state.hasStartedBgm = true;
        bgmAudio.play().catch((error) => {
          state.hasStartedBgm = false;
          console.warn("BGM playback failed.", error);
        });
      });
    }

    function stopBgmPlayback() {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      if (shouldUseWebAudio() && bgmGainNode) {
        bgmGainNode.gain.value = 0;
      } else {
        bgmAudio.volume = getEffectiveBgmVolume();
      }
      state.hasStartedBgm = false;
    }

    function syncBgmOutputState() {
      if (shouldUseWebAudio()) {
        if (bgmGainNode) {
          bgmGainNode.gain.value = state.hasStartedBgm ? getEffectiveBgmVolume() : 0;
        }
        return;
      }
      bgmAudio.volume = getEffectiveBgmVolume();
    }

    return {
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
    };
  }

  window.CommanderAudioManager = { create };
})();
