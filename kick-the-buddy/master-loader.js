(() => {
  "use strict";
  const GAME_SLUG = "kick-the-buddy";
  window.__gameSlug = GAME_SLUG;

  if (!window.config) {
    throw new Error("window.config not found");
  }

  const loaderMap = {
    unity: "unity.js",
    "unity-2020": "unity-2020.js",
  };

  const loaderFile = loaderMap[window.config.loader];
  if (!loaderFile) {
    throw new Error(`Loader "${window.config.loader}" not found`);
  }

  const scripts = document.getElementsByTagName("script");
  const currentScript = scripts[scripts.length - 1];
  const basePath = currentScript && currentScript.src
    ? currentScript.src.split("master-loader.js")[0]
    : "";

  const loaderScript = document.createElement("script");
  loaderScript.src = basePath + loaderFile;
  document.body.appendChild(loaderScript);
})();
