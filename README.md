# AI Speech Habit Coach MVP

실제 녹음, STT, 말습관 분석, 원인 후보 점수화, 맞춤 훈련 저장까지 이어지는 Next.js App Router 기반 MVP입니다.

## 실행

```bash
npm install
npm run dev
npm run build
npm run start
```

## 환경변수

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
EXPRESSION_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
OPENAI_EXPRESSION_MODEL=gpt-4.1-mini
```

### 배포 필수 변수

Vercel production에서 실제 서비스 기능을 쓰려면 아래 4개를 등록합니다.

- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon public key
- `OPENAI_API_KEY`: 녹음 파일 STT transcription용
- `GEMINI_API_KEY`: 표현 추천/문장 재작성용

### 선택 변수

- `EXPRESSION_PROVIDER`: 기본값 `gemini`. `openai`로 바꾸면 OpenAI 표현 provider를 먼저 시도합니다.
- `GEMINI_MODEL`: 기본값 `gemini-2.0-flash`.
- `OPENAI_EXPRESSION_MODEL`: Gemini 실패 후 OpenAI 표현 provider를 쓸 때의 모델. 기본값 `gpt-4.1-mini`.

현재 클라이언트 로그인과 데이터 저장에는 `SUPABASE_SERVICE_ROLE_KEY`를 사용하지 않습니다. service role key는 브라우저에 노출하면 안 되며, 서버 관리자 작업을 추가하기 전까지 Vercel에 등록하지 않아도 됩니다.

`OPENAI_API_KEY`가 없으면 STT는 개발용 mock transcript로 fallback되며, 리포트에 `개발 모드 결과` 배지가 표시됩니다. production 운영에서는 실제 녹음 분석을 위해 `OPENAI_API_KEY`를 등록하세요.
표현 추천/문장 재작성은 `/api/expression-suggestions`에서 LLM provider를 호출합니다. 기본 provider는 Gemini이며, Gemini 실패 시 OpenAI를 시도하고, 두 provider가 모두 실패하면 클라이언트에서 rule-based fallback 추천을 사용합니다.

### Gemini API 설정

1. Google AI Studio에서 Gemini API key를 발급합니다.
2. `.env.local`에 `GEMINI_API_KEY`를 설정합니다.
3. 기본값은 `EXPRESSION_PROVIDER=gemini`, `GEMINI_MODEL=gemini-2.0-flash`입니다.
4. Gemini 무료 quota를 우선 사용하고, quota/rate-limit/error가 발생하면 OpenAI provider로 fallback됩니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL editor에서 `supabase/schema.sql` 전체를 실행합니다.
3. `recordings` Storage bucket이 생성되었는지 확인합니다.
4. Storage policy가 `recordings/{userId}/...`, `voice-profiles/{userId}/...` 경로를 사용자별로 제한하는지 확인합니다.
5. Auth에서 Email provider를 활성화합니다.
6. Google OAuth를 쓸 경우 Supabase Auth provider와 Vercel redirect URL을 추가합니다.

자세한 운영 연결 순서는 `LAUNCH_CHECKLIST.md`를 확인하세요.

## OpenAI STT 테스트

API key 설정 여부:

```bash
curl http://localhost:3000/api/transcribe
```

실제 오디오 파일 전송:

```bash
curl -X POST \
  -F "audio=@./sample.webm" \
  -F "durationSeconds=30" \
  http://localhost:3000/api/transcribe
```

성공 시 `provider: "openai"`와 transcript가 반환됩니다. `OPENAI_API_KEY`가 없으면 `provider: "mock"`과 개발 모드 안내가 반환됩니다. OpenAI 요청 자체가 실패하면 API는 에러 메시지를 반환하고, 클라이언트는 리포트 생성 흐름에서 개발용 fallback으로 내려갑니다.

## 분석 지표 측정 방식

현재 MVP의 feature extraction은 STT transcript 기반 지표를 중심으로 동작합니다. 실제 오디오 신호에서 직접 측정하지 않는 지표는 사용자 리포트에서 `추정`, `규칙 기반`, `미측정`으로 표시합니다.

- `pause_score`, `pause_lack_score`: transcript의 `...`, `…` 표기와 녹음 길이 기반 추정값입니다. 실제 오디오 silence detection 결과가 아닙니다.
- `prep_failure_score`: 주장, 이유, 예시, 결론 복귀 marker를 찾는 규칙 기반 PREP 구조 분석입니다.
- `topic_drift_score`: 첫 문장과 이후 문장의 토큰 overlap을 이용한 규칙 기반 구조 분석입니다.
- `emphasis_problem_score`: 현재 pitch/intensity 분석이 없어 `0`으로 고정합니다. 사용자 리포트에서 강조/억양 부족을 단정하지 않습니다.

## LLM 기반 표현 재작성

원인 추론과 feature extraction은 deterministic rule 기반으로 유지하고, LLM은 표현 개선/문장 재작성 영역에만 사용합니다.

- 전체 transcript를 보내지 않고, filler, vague expression, 반복 표현, 장문 구조가 감지된 problematic sentence chunk만 batch로 전송합니다.
- context type에 따라 발표, 면접, 회의, 일상 대화 톤을 조절합니다.
- 단순 동의어 치환이 아니라 원래 의미와 말투를 유지하면서 더 전달력 있는 표현을 추천합니다.
- provider 구조는 `Gemini -> OpenAI -> rule-based fallback` 순서입니다.
- 결과는 `original`, `detected_issue`, `improved_version`, `explanation`, `tone`, `source` 형식으로 저장합니다.
- 동일 transcript 재분석 비용을 줄이기 위해 클라이언트 localStorage cache를 사용합니다.

### 고도화 예정

- Audio silence detection: 실제 오디오 waveform에서 무음 구간과 long pause를 검출해 pause 지표를 대체합니다.
- Pitch/intensity analysis: pitch, intensity, energy contour를 분석해 강조, 억양, 단조로움 관련 지표를 계산합니다.
- Embedding-based coherence analysis: 문장 embedding similarity와 discourse transition을 이용해 topic drift와 coherence를 더 안정적으로 계산합니다.

## Vercel 배포

### 1. GitHub 업로드

```bash
git add .
git commit -m "Prepare Commudent for Vercel deployment"
git push origin main
```

이미 다른 브랜치를 쓰고 있다면 해당 브랜치를 push한 뒤 Vercel에서 같은 브랜치를 선택합니다.

### 2. Vercel Import Project

1. Vercel Dashboard에서 `Add New...` -> `Project`를 선택합니다.
2. GitHub 저장소를 Import합니다.
3. Framework Preset은 `Next.js`로 자동 감지됩니다.
4. Build Command는 `npm run build`를 사용합니다.
5. Output Directory는 비워둡니다. Next.js 기본값을 사용합니다.

### 3. 환경변수 등록

Vercel Project Settings -> Environment Variables에 아래 값을 production 기준으로 등록합니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=
EXPRESSION_PROVIDER=gemini
GEMINI_MODEL=gemini-2.0-flash
```

`OPENAI_EXPRESSION_MODEL`은 Gemini fallback으로 OpenAI 표현 provider를 운영할 때만 추가합니다.

### 4. Supabase 연결 확인

1. Supabase SQL editor에서 `supabase/schema.sql`을 실행합니다.
2. Storage bucket과 RLS policy가 적용되어 있는지 확인합니다.
3. Auth -> URL Configuration에 Vercel production URL을 추가합니다.
4. Email signup을 바로 테스트하려면 Auth email confirmation을 OFF로 둡니다.
5. Google OAuth를 쓰는 경우 Supabase provider와 Google Cloud redirect URL에도 Vercel 도메인을 추가합니다.

### 5. Deploy

Vercel에서 `Deploy`를 누릅니다. 배포 후 아래 경로를 확인합니다.

- `/`: 홈 대시보드 접근
- `/onboarding`: Profile Setup 로그인/회원가입
- `/record`: 녹음, self-check, STT 분석
- `/report/[id]`: 분석 리포트
- `/script-coach`: 독립 스크립트 코칭

## 운영 문서

- `PRIVACY_NOTICE.md`: 음성 데이터 수집/이용/삭제 안내 초안
- `LAUNCH_CHECKLIST.md`: Supabase, OpenAI, Vercel 연결 체크리스트
- `E2E_TEST_CHECKLIST.md`: 신규 가입부터 삭제까지 QA 시나리오

## 배포 전 체크리스트

- [ ] `npm install`이 루트 프로젝트에서 성공한다.
- [ ] `npm run build`가 warning 없이 통과한다.
- [ ] Vercel에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`를 등록했다.
- [ ] Supabase SQL을 최신 상태로 실행했다.
- [ ] `recordings` Storage bucket과 RLS policy가 적용됐다.
- [ ] Supabase Auth redirect URL에 Vercel production URL을 등록했다.
- [ ] 테스트 계정을 생성하고 Profile Setup에서 이메일 로그인/가입을 확인했다.
- [ ] `OPENAI_API_KEY`로 실제 오디오 transcription을 확인했다.
- [ ] `GEMINI_API_KEY`로 표현 추천 provider badge가 `AI 표현 추천 (Gemini)`로 표시되는지 확인했다.
- [ ] API key가 없는 preview 환경에서는 개발 모드 배지가 표시되고, production에는 실제 key를 등록했다.
- [ ] 녹음 삭제 시 DB record와 Storage object가 함께 삭제된다.
- [ ] 모바일 Safari에서 녹음 지원 여부와 안내 메시지를 확인했다.
- [ ] 온보딩에 음성 데이터 사용 목적 안내가 보인다.
- [ ] 개인정보 처리방침과 음성 데이터 보관/삭제 정책을 서비스 화면 또는 약관에 연결했다.

## Vercel 배포 점검 결과

- `next.config.mjs`: path alias만 설정되어 있으며 Vercel 배포를 막는 custom output 설정은 없습니다.
- API routes: `/api/transcribe`, `/api/expression-suggestions` 모두 `runtime = "nodejs"`로 명시되어 있어 multipart form data, external API 호출에 적합합니다.
- Supabase: 브라우저 클라이언트는 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 사용합니다.
- Mock/fallback: API key 누락 시 개발용 transcript fallback과 rule-based expression fallback이 동작합니다. production에서 실제 분석 품질을 위해 `OPENAI_API_KEY`, `GEMINI_API_KEY`는 등록해야 합니다.
- Known limitation: speaker diarization/voice profile은 현재 mock enrollment 기반입니다. 배포를 막지는 않지만, 여러 사람 대화에서 화자 분리 정확도를 보장하는 기능은 아직 아닙니다.

## 음성 데이터 안내 문구 예시

목소리 샘플과 녹음 파일은 사용자의 발화 패턴을 분석하고, 여러 사람의 대화에서 내 발화를 구분하기 위한 기준으로 사용됩니다. 사용자는 리포트와 녹음 파일, 목소리 샘플을 삭제할 수 있어야 하며, 운영 환경에서는 보관 기간과 삭제 절차를 명확히 고지해야 합니다.
