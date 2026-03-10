/* ------------------------------------------------------------------ */
/*  Shared YouTube IFrame API loader                                   */
/*  Used by both useMusic (session) and useVibePreview (discovery).    */
/* ------------------------------------------------------------------ */

let apiPromise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector(
      'script[src*="youtube.com/iframe_api"]',
    );
    if (existing) {
      const check = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => {
      apiPromise = null;
      reject(new Error("Failed to load YouTube IFrame API"));
    };
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(tag);
  });

  return apiPromise;
}
