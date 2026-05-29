# Launch Checklist

## 1. Supabase 프로젝트 연결

- [ ] Supabase에서 새 프로젝트를 생성한다.
- [ ] Project Settings > API에서 Project URL과 anon key를 확인한다.
- [ ] SQL Editor에서 `supabase/schema.sql` 전체를 실행한다.
- [ ] Table Editor에서 아래 테이블이 생성됐는지 확인한다.
  - `user_profiles`
  - `voice_profiles`
  - `onboarding_self_checks`
  - `recordings`
  - `pre_speech_surveys`
  - `speech_reports`
  - `speaker_segments`
  - `cause_scores`
  - `cause_feedback`
  - `coaching_plans`
  - `training_sessions`
- [ ] Storage에서 `recordings` bucket이 있는지 확인한다.
- [ ] Storage object policy가 authenticated user path만 허용하는지 확인한다.
- [ ] Authentication > Providers에서 Email을 활성화한다.
- [ ] Google OAuth를 사용할 경우 Google Cloud Console OAuth client를 생성한다.
- [ ] Supabase Authentication > URL Configuration에 Redirect URL을 추가한다.

## 2. Redirect URL

로컬:

- `http://localhost:3000`
- `http://localhost:3000/login`
- `http://localhost:3000/onboarding`

Vercel preview:

- `https://*.vercel.app`

Production:

- `https://YOUR_DOMAIN.com`
- `https://YOUR_DOMAIN.com/login`
- `https://YOUR_DOMAIN.com/onboarding`

Google OAuth Authorized redirect URI:

- `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`

## 3. OpenAI STT

- [ ] `.env.local`에 `OPENAI_API_KEY`를 설정한다.
- [ ] `GET /api/transcribe`에서 `configured: true`인지 확인한다.
- [ ] 실제 오디오 파일로 `POST /api/transcribe`를 호출한다.
- [ ] 응답이 `provider: "openai"`인지 확인한다.
- [ ] 실패 시 화면에 개발 모드 또는 에러 메시지가 표시되는지 확인한다.

## 4. E2E 테스트

- [ ] 신규 사용자 이메일 가입
- [ ] 이메일 로그인
- [ ] 온보딩 진입
- [ ] 기본 프로필 생성
- [ ] voice sample 녹음
- [ ] voice sample이 Supabase Storage에 저장되는지 확인
- [ ] `voice_profiles.sample_audio_url`, `sample_storage_path` 저장 확인
- [ ] 첫 녹음 생성
- [ ] 실제 STT 분석 실행
- [ ] `recordings.audio_url`, `audio_storage_path`, `transcript` 저장 확인
- [ ] `speech_reports`, `cause_scores`, `coaching_plans` 생성 확인
- [ ] 대시보드 최근 리포트에 표시 확인
- [ ] 로그아웃
- [ ] 재로그인
- [ ] 기존 프로필이 hydrate되어 온보딩을 건너뛰는지 확인
- [ ] 기존 리포트가 대시보드에 표시되는지 확인
- [ ] 리포트 삭제
- [ ] DB record 삭제 확인
- [ ] Storage audio object 삭제 확인

## 5. Vercel 배포

- [ ] Build command: `npm run build`
- [ ] Install command: `npm install`
- [ ] Output은 Next.js 기본값 사용
- [ ] Environment Variables에 `.env.local.example` 항목을 모두 등록
- [ ] Supabase Auth redirect URL에 Vercel production domain 추가
- [ ] 배포 후 `/login`, `/onboarding`, `/record`, `/training`, `/dashboard` smoke test

## 6. 운영 문서

- [ ] `PRIVACY_NOTICE.md` 내용을 실제 개인정보 처리방침/약관에 반영
- [ ] 음성 데이터 보관 기간 확정
- [ ] 사용자 삭제 요청 처리 프로세스 확정
- [ ] OpenAI API 사용 고지 여부 확인
- [ ] speaker diarization 미연동 범위를 사용자에게 명확히 안내
