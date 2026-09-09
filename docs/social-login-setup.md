# 구글·네이버 로그인 연결하기

현재 개인 아이디·비밀번호 가입/로그인과 계정별 서버 저장은 구현되어 있습니다. Google/Naver 로그인 경로도 구현했지만, 제공자 Client ID/Secret 발급 및 실제 계정 동의 검사는 별도로 해야 합니다. **설정되지 않은 소셜 버튼은 ‘연결 준비 중’으로 표시됩니다.**

## 먼저 알아둘 것

- 관광공사 API 인증키와 카카오 지도 JavaScript 키로는 소셜 로그인을 연결할 수 없습니다.
- Google과 Naver에서 각각 **Client ID**, **Client Secret**을 발급받습니다. Secret은 공개 코드·스크린샷·GitHub·채팅에 넣지 않습니다.
- 아래 `.env.local`은 **개발 PC용**입니다. 운영 사이트에도 동일한 변수 이름으로 별도 Secret을 등록해야 합니다. `.env.local`을 수정하는 것만으로 공개 사이트가 바뀌지는 않습니다.
- 개인 아이디로 먼저 가입했다면 **내 계정 → 로그인 연결**에서 소셜 계정을 연결하세요. 로그인 화면에서 새 소셜 계정으로 들어가면 별도 여행 계정이 생깁니다. 이메일이 같다는 이유로 두 계정을 자동 합치지 않습니다.

```dotenv
# 로컬 개발 PC
AUTH_BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

운영 환경의 `AUTH_BASE_URL`은 다음 값입니다. 끝에 `/`는 붙이지 않습니다.

```text
https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site
```

## 1. Google

1. [Google Cloud Console](https://console.cloud.google.com/)에 로그인합니다. 프로젝트를 선택하거나 `군번여지도 강원` 프로젝트를 만듭니다.
2. **Google Auth Platform → Branding**에서 앱 이름, 지원 이메일, 개발자 연락 이메일을 입력합니다. 앱 홈페이지는 `https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/about`, 개인정보 안내는 `https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/privacy`를 입력합니다.
3. **Audience**에서 일반 이용자용 **External**을 선택합니다. 조직 내부용 Internal은 일반 Google 사용자에게 적합하지 않습니다.
4. **Data Access**에서는 현재 구현에 필요한 `openid`만 사용합니다. 이메일, Drive, Gmail, 생일 등의 권한은 필요 없습니다.
5. **Clients → Create Client → Web application**을 선택합니다.
6. **Authorized redirect URIs(승인된 리디렉션 URI)**에 아래 주소를 줄별로 등록합니다.

```text
https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/api/auth/callback/google
http://localhost:3000/api/auth/callback/google
```

7. 발급된 ID와 Secret을 `.env.local`의 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`에 넣습니다.
8. 개발 서버를 재시작하고 `/login`에서 **Google로 계속하기**를 눌러 시험합니다. 이미 만든 아이디 계정을 사용할 때는 `/account`에서 **Google 연결하기**를 누릅니다.
9. 운영 Secret을 등록한 후 공개 사이트의 콜백도 검사합니다.

현재 방식은 서버 리디렉션 OAuth입니다. JavaScript SDK나 JavaScript origin 설정은 필수가 아닙니다. `redirect_uri_mismatch`가 나오면 주소의 `http/https`, 호스트, 포트, 전체 경로, 마지막 `/`를 대조하세요. [공식 웹 서버 OAuth 안내](https://developers.google.com/identity/protocols/oauth2/web-server)

기본 로그인 범위(`openid/email/profile`)에는 일반 Testing 사용자 수·만료 규칙의 예외가 있으므로, 무조건 ‘100명까지만’ 또는 ‘7일 후 로그인이 모두 만료’라고 해석하지 않습니다. 실제 콘솔의 게시 상태를 확인합니다. [Google Audience 안내](https://support.google.com/cloud/answer/15549945?hl=en)

브랜드명·로고 검수는 등록 가능 최상위 도메인 소유 확인을 요구할 수 있습니다. 현재 `chatgpt.site` 하위 주소는 사용자가 최상위 도메인을 소유하지 않으므로, 콘솔의 요구를 확인한 뒤 필요하면 **사용자 소유 도메인 연결**을 검토합니다. 현재 주소가 무조건 불가능하다고 단정하지는 않습니다. [브랜드 검수 요건](https://developers.google.com/identity/verification/authentication-verification)

## 2. Naver

1. [네이버 개발자센터 애플리케이션 등록](https://developers.naver.com/apps/#/register)을 엽니다.
2. 앱 이름을 `군번여지도 강원`, 사용 API를 **네이버 로그인**으로 선택합니다.
3. 로그인 제공 정보는 **이용자 식별자**만 필요합니다. 별명은 군번여지도 안에서 정하므로 이름·이메일·생일·성별·휴대전화번호는 요청하지 않습니다.
4. 서비스 환경에 **PC 웹**을 추가하고 서비스 URL에 아래 운영 주소를 입력합니다. 모바일 브라우저에서도 같은 웹 서비스로 사용합니다.

```text
서비스 URL
https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

Callback URL
https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/api/auth/callback/naver
```

5. 로컬 검사에는 아래 콜백을 사용합니다. 가능하면 별도의 개발용 앱으로 분리해 운영 검수 설정과 섞이지 않게 합니다.

```text
http://localhost:3000/api/auth/callback/naver
```

6. **내 애플리케이션**에서 Client ID/Secret을 확인하고 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`에 넣습니다. [앱 등록 공식 안내](https://developers.naver.com/docs/common/openapiguide/appregister.md)
7. 검수 전에는 앱 등록자 계정 또는 **멤버관리 → 관리자/테스터**에 등록된 계정으로 시험합니다.
8. 일반 이용자에게 공개하려면 **네이버 로그인 검수 상태 → 검수 요청**을 진행합니다. 로그인 버튼 → 네이버 동의 → 가입/로그인 완료 → 별명/내 여행 화면을 캡처합니다. 추가 수집 정보가 있으면 실제 활용 화면도 제출해야 합니다. 현재 구현은 추가 앱 비밀번호 없이 소셜 가입이 완료됩니다. [사전 검수 공식 안내](https://developers.naver.com/docs/login/verify/verify.md)

## 3. 운영 반영과 확인 순서

사용자가 키를 발급한 후 agent에게 **‘환경 파일에 넣었다’**고만 알려도 됩니다. 키 원문을 채팅에 붙여넣을 필요가 없습니다.

1. 로컬 변수 **이름과 설정 유무만** 검사하고 서버를 재시작합니다.
2. 각 제공자로 새 로그인, 로그아웃, 재로그인, 기존 아이디 계정 연결을 시험합니다.
3. 운영 Sites 환경에 5개 변수를 추가하고 기존 TourAPI/Kakao/테스트 Secret을 보존합니다.
4. 공개 주소에서 별도 브라우저로 다시 로그인해 내 여행이 같은 계정에 연결되는지 확인합니다.
5. 네이버 검수·Google 콘솔 게시/브랜드 요건의 실제 완료 여부를 기록합니다. 버튼 활성화만으로 실로그인 성공이라고 보고하지 않습니다.

## 4. 지금 쓸 수 있는 임시 개인 계정

- `/login` → **계정 만들기** → 별명, 영문 소문자·숫자 아이디(4~30자), 비밀번호(10~128자), 체험 초대 비밀번호 `1234`를 입력합니다.
- 개인 비밀번호는 `1234`가 아닙니다. 서버에는 salt를 사용하는 scrypt 해시만 저장합니다.
- **회원가입 없이 체험하기**는 종전과 같은 기기 저장 방식입니다. 개인 계정과 다릅니다.
- 기존 기기 기록은 `/account` → **이 기기의 여행·그룹 연결** → **가져오기 확인**으로 옮깁니다. 같은 ID의 다른 여행은 사본으로 보관합니다.
- 초기 버전은 비밀번호 재설정 메일이 없습니다. 비밀번호 관리자에 보관하고, 소셜 연결이 준비되면 기존 계정에 연결하세요.

## 구현 근거와 자산

Sites의 현재 인증 지침은 ChatGPT SIWC를 제공하지만 Google/Naver 전용 연결 경로는 제공하지 않습니다. 기존 앱에 요청된 외부 로그인 경로를 별도로 추가했으며 플랫폼 소유 `/callback`, `/signin-with-chatgpt`, `/signout-with-chatgpt`는 사용하지 않습니다.

Google은 서버 코드 교환, PKCE S256, 일회성 state·브라우저 쿠키, 서명/issuer/audience/expiry/nonce를 검증한 ID Token과 UserInfo subject 일치 검사를 사용합니다. Naver는 서버 코드 교환 후 회원정보 API의 앱별 고유 ID를 사용합니다. 소셜 액세스 토큰은 DB에 저장하지 않습니다. [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [네이버 로그인 API](https://developers.naver.com/docs/login/api/api.md)

- Google G: [공식 PNG](https://developers.google.com/static/identity/images/g-logo.png), [버튼 가이드](https://developers.google.com/identity/branding-guidelines). 적용 파일 `web/public/brand/google-g.png`.
- Naver N: [공식 PNG ZIP](https://developers.naver.com/inc/devcenter/downloads/bi/NAVER_login_KR.zip)의 `NAVER_login_Light_KR_green_icon_H48.png`. 적용 파일 `web/public/brand/naver-n.png`. [버튼 가이드](https://developers.naver.com/docs/login/bi/bi.md)의 녹색 #03A94D와 원본 비율을 사용합니다.
