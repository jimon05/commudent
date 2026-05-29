# 음성 데이터 안내

이 서비스는 말습관 분석과 발표 코칭을 위해 사용자의 녹음 파일, transcript, 목소리 샘플, 자기보고 응답을 처리합니다.

## 수집 및 처리 데이터

- 계정 정보: 이메일 로그인 식별자
- 프로필 정보: 닉네임, 주 사용 목적, 개선 목표
- 목소리 프로필: 온보딩에서 녹음한 voice sample
- 녹음 데이터: 발표/면접/회의 등 사용자가 직접 녹음한 오디오
- 분석 데이터: transcript, filler count, WPM, 문장 길이, 원인 후보 점수, 코칭 플랜
- 훈련 데이터: 훈련 유형, 답변, 결과

## 사용 목적

- 사용자의 발화 패턴 분석
- 여러 사람 대화에서 내 발화를 구분하기 위한 voice profile 기준 저장
- 원인 후보 점수화와 맞춤 훈련 추천
- 장기 변화 리포트 생성

## 보관 및 삭제

- 사용자는 리포트 삭제 기능으로 녹음 record와 연결 분석 데이터를 삭제할 수 있습니다.
- Supabase Storage에 저장된 오디오 파일은 `audio_storage_path`를 기준으로 함께 삭제되도록 구현되어 있습니다.
- 운영 환경에서는 별도의 보관 기간, 백업 보관 여부, 완전 삭제 소요 시간을 약관 또는 개인정보 처리방침에 명시해야 합니다.

## 접근 제어

- Supabase Auth 사용자별 Row Level Security를 적용합니다.
- 사용자는 본인 `user_id`와 연결된 profile, recording, report, training data만 조회할 수 있어야 합니다.
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용으로만 사용하고 브라우저에 노출하지 않습니다.

## 현재 MVP 한계

- speaker verification과 diarization은 아직 mock 구조입니다.
- 여러 사람이 함께 말한 녹음에서 타인의 발화를 자동 제거하려면 AssemblyAI, Deepgram, Azure Speaker Recognition, Google Speech-to-Text diarization 같은 provider 연결이 필요합니다.
