# E2E Test Checklist

## 신규 사용자

- [ ] `/login` 접속
- [ ] 이메일 회원가입
- [ ] 이메일 인증이 켜져 있다면 인증 메일 확인
- [ ] 로그인 완료 후 `/onboarding` 또는 `/` 이동 확인

## 온보딩

- [ ] Welcome 화면에서 다음 버튼 동작
- [ ] 어려운 상황 카드 선택
- [ ] 답답한 순간 카드 선택
- [ ] voice profile 녹음 시작
- [ ] 녹음 중 waveform 반응 확인
- [ ] 녹음 종료 후 audio preview 확인
- [ ] Self-check 선택
- [ ] 초기 프로필 결과 확인
- [ ] 홈 진입

## 첫 녹음 및 분석

- [ ] `/record` 접속
- [ ] 발표 전 자기보고 점수 입력
- [ ] 브라우저 마이크 권한 허용
- [ ] 녹음 시작/종료
- [ ] audio preview 재생
- [ ] 분석 시작
- [ ] `OPENAI_API_KEY`가 있으면 실제 STT 결과 확인
- [ ] API key가 없으면 개발 모드 배지 확인
- [ ] 리포트 페이지 이동 확인

## Supabase 데이터

- [ ] `recordings` row 생성
- [ ] `recordings.audio_storage_path` 저장
- [ ] `pre_speech_surveys` row 생성
- [ ] `speech_reports` row 생성
- [ ] `cause_scores` row 생성
- [ ] `coaching_plans` row 생성
- [ ] Storage `recordings/{userId}/...` object 생성

## 재방문

- [ ] 로그아웃
- [ ] 재로그인
- [ ] 기존 profile hydrate 확인
- [ ] voice profile이 있으면 온보딩을 건너뛰는지 확인
- [ ] 대시보드에 누적 리포트 표시
- [ ] 리포트 상세 재조회

## 삭제

- [ ] 리포트 삭제 클릭
- [ ] `recordings` row 삭제
- [ ] cascade로 `speech_reports`, `cause_scores`, `coaching_plans` 삭제
- [ ] Storage audio object 삭제
- [ ] 대시보드에서 삭제된 리포트 미표시

## 모바일

- [ ] iOS Safari에서 `/record` 접속
- [ ] 녹음 가능 여부 확인
- [ ] 미지원 시 안내 메시지 확인
- [ ] Android Chrome에서 녹음/preview 확인
