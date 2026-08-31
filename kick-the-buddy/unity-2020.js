(() => {
  "use strict";

  const GAME_SLUG = "kick-the-buddy";

  function toSluggedIdbfsPath(value) {
    if (typeof value !== "string") {
      return value;
    }
    return value.replace(/(\/idbfs\/)[^/]+(\/|$)/, `$1${GAME_SLUG}$2`);
  }

  function installIdbfsSlugPatch() {
    try {
      const objectStoreProto = window.IDBObjectStore && window.IDBObjectStore.prototype;
      if (!objectStoreProto) {
        return;
      }

      if (!objectStoreProto.__slugPatchedPut) {
        const originalPut = objectStoreProto.put;
        if (typeof originalPut === "function") {
          objectStoreProto.put = function patchedPut(...args) {
            try {
              if (this && this.transaction && this.transaction.db && this.transaction.db.name === "/idbfs" && typeof args[1] === "string") {
                args[1] = toSluggedIdbfsPath(args[1]);
              }
            } catch (_error) {}
            return originalPut.apply(this, args);
          };
          objectStoreProto.__slugPatchedPut = true;
        }
      }

      if (!objectStoreProto.__slugPatchedGet) {
        const originalGet = objectStoreProto.get;
        if (typeof originalGet === "function") {
          objectStoreProto.get = function patchedGet(...args) {
            try {
              if (this && this.transaction && this.transaction.db && this.transaction.db.name === "/idbfs" && typeof args[0] === "string") {
                args[0] = toSluggedIdbfsPath(args[0]);
              }
            } catch (_error) {}
            return originalGet.apply(this, args);
          };
          objectStoreProto.__slugPatchedGet = true;
        }
      }

      const cursorProto = window.IDBCursor && window.IDBCursor.prototype;
      if (cursorProto && !cursorProto.__slugPatchedPrimaryKey) {
        const descriptor = Object.getOwnPropertyDescriptor(cursorProto, "primaryKey");
        if (descriptor && typeof descriptor.get === "function") {
          Object.defineProperty(cursorProto, "primaryKey", {
            configurable: true,
            get() {
              const originalValue = descriptor.get.call(this);
              return toSluggedIdbfsPath(originalValue);
            },
          });
          cursorProto.__slugPatchedPrimaryKey = true;
        }
      }
    } catch (_error) {}
  }

  function installPokiStub() {
    const resolved = Promise.resolve();
    const noOp = () => {};

    const defaults = {
      init: () => resolved,
      initWithVideoHB: () => resolved,
      setDebug: noOp,
      setLogging: noOp,
      gameLoadingStart: noOp,
      gameLoadingProgress: noOp,
      gameLoadingFinished: noOp,
      gameplayStart: noOp,
      gameplayStop: noOp,
      gameInteractive: noOp,
      customEvent: noOp,
      enableEventTracking: noOp,
      commercialBreak: () => resolved,
      rewardedBreak: () => Promise.resolve(true),
      displayAd: noOp,
      destroyAd: noOp,
      isAdBlocked: () => false,
      muteAd: noOp,
      setVolume: noOp,
      happyTime: noOp,
      sendHighscore: noOp,
      setPlayerAge: noOp,
      roundStart: noOp,
      roundEnd: noOp,
      showLeaderboard: noOp,
      getLeaderboard: () => Promise.resolve([]),
      movePill: noOp,
      logError: noOp,
      captureError: noOp,
      measure: noOp,
      setPlaytestCanvas: noOp,
      playtestSetCanvas: noOp,
      playtestCaptureHtmlOnce: noOp,
      playtestCaptureHtmlForce: noOp,
      playtestCaptureHtmlOn: noOp,
      playtestCaptureHtmlOff: noOp,
      setDebugTouchOverlayController: noOp,
      getLanguage: () => (navigator.language || "en").toLowerCase().split("-")[0],
      getIsoLanguage: () => (navigator.language || "en").toLowerCase(),
      getURLParam: (key) => new URLSearchParams(window.location.search).get(key),
      shareableURL: (params = {}) => {
        const url = new URL(window.location.href);
        url.search = "";
        url.hash = "";
        Object.keys(params).forEach((key) => {
          const value = params[key];
          if (value !== undefined && value !== null) {
            url.searchParams.set(key, String(value));
          }
        });
        return Promise.resolve(url.toString());
      },
      openExternalLink: (url) => {
        if (typeof url === "string" && url.length > 0) {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      },
      generateScreenshot: async () => null,
      getUser: async () => null,
      getToken: async () => null,
      login: async () => null,
    };

    const sdk = window.PokiSDK || {};
    Object.keys(defaults).forEach((name) => {
      if (typeof sdk[name] !== "function") {
        sdk[name] = defaults[name];
      }
    });

    window.PokiSDK = sdk;
    window.__pokiSdkSlug = GAME_SLUG;
  }

  function installAnalyticsBlocklist() {
    const blockedFragments = [
      "bytebrew",
      "poki.io",
      "game-cdn.poki.com",
      "google-analytics.com",
      "googletagmanager.com",
      "analytics.google.com",
      "mixpanel.com",
      "segment.com",
      "amplitude.com",
      "facebook.com/tr",
      "doubleclick.net",
    ];

    const shouldBlock = (input) => {
      if (!input) {
        return false;
      }

      const value = String(input).toLowerCase();
      return blockedFragments.some((part) => value.includes(part));
    };

    if (!window.__analyticsFetchBlocked && typeof window.fetch === "function") {
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === "string" ? input : input && input.url;
        if (shouldBlock(url)) {
          return Promise.resolve(new Response("", { status: 204 }));
        }
        return originalFetch(input, init);
      };
      window.__analyticsFetchBlocked = true;
    }

    if (!window.__analyticsBeaconBlocked && navigator && typeof navigator.sendBeacon === "function") {
      const originalSendBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = (url, data) => {
        if (shouldBlock(url)) {
          return true;
        }
        return originalSendBeacon(url, data);
      };
      window.__analyticsBeaconBlocked = true;
    }

    if (!window.__analyticsXhrBlocked && window.XMLHttpRequest) {
      const open = window.XMLHttpRequest.prototype.open;
      const send = window.XMLHttpRequest.prototype.send;

      window.XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
        this.__blockedAnalyticsRequest = shouldBlock(url);
        return open.call(this, method, url, ...rest);
      };

      window.XMLHttpRequest.prototype.send = function patchedSend(body) {
        if (this.__blockedAnalyticsRequest) {
          return;
        }
        return send.call(this, body);
      };

      window.__analyticsXhrBlocked = true;
    }
  }

  let bridgeTarget = null;

  function sendBridgeMessage(method, payload) {
    if (!bridgeTarget || !window.unityGame || typeof window.unityGame.SendMessage !== "function") {
      return;
    }

    try {
      if (payload === undefined) {
        window.unityGame.SendMessage(bridgeTarget, method);
      } else {
        window.unityGame.SendMessage(bridgeTarget, method, payload);
      }
    } catch (_error) {}
  }

  window.initPokiBridge = (target) => {
    bridgeTarget = target;
    if (window.unityGame) {
      sendBridgeMessage("ready");
    }
  };

  window.commercialBreak = (...args) =>
    window.PokiSDK.commercialBreak(...args)
      .catch(() => {})
      .then(() => {
        sendBridgeMessage("commercialBreakCompleted");
      });

  window.rewardedBreak = (...args) =>
    window.PokiSDK.rewardedBreak(...args)
      .then((result) => {
        const value = result === undefined ? "false" : String(result);
        sendBridgeMessage("rewardedBreakCompleted", value);
        return result;
      })
      .catch(() => {
        sendBridgeMessage("rewardedBreakCompleted", "false");
        return false;
      });

  window.shareableURL = (params) =>
    window.PokiSDK.shareableURL(params)
      .then((url) => {
        sendBridgeMessage("shareableURLResolved", url);
        return url;
      })
      .catch((error) => {
        sendBridgeMessage("shareableURLRejected");
        throw error;
      });

  function createLayout() {
    if (!document.getElementById("unity-clean-style")) {
      const style = document.createElement("style");
      style.id = "unity-clean-style";
      style.textContent = "html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#000;}#game-container{position:fixed;inset:0;}#game{width:100%;height:100%;display:block;}#unity-clean-loader{display:none;}";
      document.head.appendChild(style);
    }

    let gameContainer = document.getElementById("game-container");
    if (!gameContainer) {
      gameContainer = document.createElement("div");
      gameContainer.id = "game-container";
      document.body.appendChild(gameContainer);
    }

    let canvas = document.getElementById("game");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "game";
      gameContainer.appendChild(canvas);
    }

    let loader = document.getElementById("unity-clean-loader");
    if (!loader) {
      loader = document.createElement("div");
      loader.id = "unity-clean-loader";
      loader.innerHTML = '<div id="unity-clean-label">Loading game...</div><div id="unity-clean-progress"><div id="unity-clean-fill"></div></div>';
      document.body.appendChild(loader);
    }

    return {
      canvas,
      loader,
      label: document.getElementById("unity-clean-label"),
      fill: document.getElementById("unity-clean-fill"),
    };
  }

  function setLoaderProgress(layout, progress) {
    const clamped = Math.min(1, Math.max(0, progress));
    if (layout.fill) {
      layout.fill.style.width = `${Math.round(clamped * 100)}%`;
    }
    if (layout.label) {
      layout.label.textContent = ` ${Math.round(clamped * 100)}%`;
    }
    try {
      window.PokiSDK.gameLoadingProgress({ percentageDone: clamped });
    } catch (_error) {}
  }

  function startUnity() {
    installIdbfsSlugPatch();
    installPokiStub();
    installAnalyticsBlocklist();

    if (!window.config || !window.config.metadata) {
      throw new Error("Missing window.config.metadata");
    }

    const metadata = window.config.metadata;
    const buildDir = "Build";
    const layout = createLayout();

    const unityConfig = {
      dataUrl: `${buildDir}/${metadata.data_filename}`,
      frameworkUrl: `${buildDir}/${metadata.framework_filename}`,
      codeUrl: `${buildDir}/${metadata.code_filename}`,
      streamingAssetsUrl: "StreamingAssets",
      companyName: metadata.company_name || "",
      productName: metadata.product_name || GAME_SLUG,
      productVersion: metadata.product_version || "",
    };

    const loaderScript = document.createElement("script");
    loaderScript.src = `${buildDir}/${metadata.loader_filename}`;

    loaderScript.addEventListener("error", () => {
      if (layout.label) {
        layout.label.textContent = "Failed to load Unity loader.";
      }
    });

    loaderScript.addEventListener("load", () => {
      if (typeof createUnityInstance !== "function") {
        if (layout.label) {
          layout.label.textContent = "Unity loader did not initialize.";
        }
        return;
      }

      window.PokiSDK.gameLoadingStart();

      createUnityInstance(layout.canvas, unityConfig, (progress) => {
        setLoaderProgress(layout, progress);
      })
        .then((instance) => {
          window.unityGame = instance;
          window.PokiSDK.gameLoadingFinished();
          if (layout.loader && layout.loader.parentNode) {
            layout.loader.parentNode.removeChild(layout.loader);
          }
          sendBridgeMessage("ready");
        })
        .catch((error) => {
          console.error(error);
          if (layout.label) {
            layout.label.textContent = "Failed to start Unity game.";
          }
        });
    });

    document.body.appendChild(loaderScript);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      startUnity();
    }, { once: true });
  } else {
    startUnity();
  }
})();
