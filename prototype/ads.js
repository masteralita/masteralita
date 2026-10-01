'use strict';
/* ==========================================================================
   Rewarded ads, per OS.
   - iOS / Android app build (Capacitor + @capacitor-community/admob): shows a real
     AdMob rewarded ad using the unit id for that OS from AD_CONFIG.
   - Web / this prototype: shows a simulated rewarded ad with a countdown.
   Every call resolves to { rewarded: boolean, network, platform }.
   ========================================================================== */
const Ads = (() => {
  const cap = window.Capacitor;
  const platform = cap && cap.getPlatform ? cap.getPlatform()
    : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios'
    : /Android/i.test(navigator.userAgent) ? 'android' : 'web';
  const nativeAdMob = cap && cap.Plugins && cap.Plugins.AdMob && platform !== 'web' ? cap.Plugins.AdMob : null;
  const cfg = AD_CONFIG[platform] || AD_CONFIG.web;
  let ready = null;

  function init() {
    if (!nativeAdMob) return Promise.resolve();
    if (!ready) ready = nativeAdMob.initialize({ initializeForTesting: AD_CONFIG.testMode }).catch(() => {});
    return ready;
  }

  async function showNative(placement) {
    await init();
    const unit = cfg.rewarded[placement] || cfg.rewarded.default;
    await nativeAdMob.prepareRewardVideoAd({ adId: unit, isTesting: AD_CONFIG.testMode });
    const reward = await nativeAdMob.showRewardVideoAd();
    return { rewarded: !!reward, network: cfg.network, platform };
  }

  // Prototype stand-in for the native ad: full-screen overlay that must play to the end
  function showSimulated(placement) {
    return new Promise(resolve => {
      const el = $('adSim'), secs = AD_CONFIG.simSeconds;
      let left = secs, done = false;
      $('adSimNet').textContent = `${cfg.label} · ${cfg.network} 보상형 광고`;
      $('adSimUnit').textContent = cfg.rewarded ? `광고 단위 ${cfg.rewarded[placement] || cfg.rewarded.default}` : '웹 테스트 광고 (실제 광고 없음)';
      const close = $('adSimClose'), bar = $('adSimBar'), cnt = $('adSimCount');
      el.hidden = false; close.textContent = '광고 닫기'; bar.style.transform = 'scaleX(0)';
      const tick = () => {
        left -= .1;
        bar.style.transform = `scaleX(${clamp(1 - left / secs, 0, 1)})`;
        cnt.textContent = left > 0 ? `${Math.ceil(left)}초 후 보상` : '보상 획득 가능';
        if (left <= 0 && !done) { done = true; close.textContent = '보상 받기'; clearInterval(iv); }
      };
      const iv = setInterval(tick, 100); tick();
      close.onclick = () => { clearInterval(iv); el.hidden = true; resolve({ rewarded: done, network: cfg.network, platform, simulated: true }); };
    });
  }

  return {
    platform, network: cfg.network, label: cfg.label, native: !!nativeAdMob,
    async showRewarded(placement = 'default') {
      let r;
      if (nativeAdMob) {
        try { r = await showNative(placement); }
        catch (e) { r = { rewarded: false, network: cfg.network, platform, error: String(e && e.message || e) }; }
      } else r = await showSimulated(placement);
      if (r.rewarded && window.CLOUD) CLOUD.event('ad_reward', { placement });
      return r;
    },
  };
})();
