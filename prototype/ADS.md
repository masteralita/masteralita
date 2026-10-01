# 광고 연동 (iOS / Android)

로비 낙하 보물상자는 `ads.js`의 `Ads.showRewarded('lobby_chest')`로 보상형 광고를 띄워요.

| 실행 환경 | 동작 |
|---|---|
| 웹 / 프로토타입 | 5초 테스트 광고 화면 (실제 광고 없음) |
| iOS 앱 | AdMob 보상형 광고 (`AD_CONFIG.ios`) |
| Android 앱 | AdMob 보상형 광고 (`AD_CONFIG.android`) |

광고 무제한 패키지(`save.adPass`)가 있으면 광고 없이 바로 보상을 줘요.

## 앱으로 감쌀 때 할 일
1. Capacitor 프로젝트에 `@capacitor-community/admob` 플러그인을 설치해요. 설치하면 `Capacitor.Plugins.AdMob`이 잡히고, `ads.js`가 자동으로 실제 광고를 써요.
2. AdMob 콘솔에서 앱 2개(iOS, Android)와 보상형 광고 단위를 만들어요.
3. `data.js`의 `AD_CONFIG`에서 테스트 ID를 실제 광고 단위 ID로 바꾸고, `testMode`를 `false`로 바꿔요.
4. iOS: `Info.plist`에 `GADApplicationIdentifier`(AdMob 앱 ID), `SKAdNetworkItems`, 추적 권한 문구(`NSUserTrackingUsageDescription`)를 넣어요.
5. Android: `AndroidManifest.xml`에 `com.google.android.gms.ads.APPLICATION_ID` 메타데이터로 AdMob 앱 ID를 넣어요.
6. 보상 지급은 지금 클라이언트에서 처리해요. 정식 출시 전에는 AdMob 서버 측 확인(SSV) 콜백으로 서버에서 지급하는 것을 권장해요.
