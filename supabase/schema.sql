-- AI Speech Habit Correction and Presentation Coaching MVP
-- Run this in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create type public.context_type as enum (
  'presentation',
  'interview',
  'class',
  'meeting',
  'daily',
  'other'
);

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  title text not null,
  context_type public.context_type not null default 'presentation',
  audio_url text,
  audio_storage_path text,
  transcript text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  primary_goal text not null check (primary_goal in ('presentation', 'interview', 'meeting', 'daily', 'class_discussion', 'other')),
  main_pain_points text[] not null default '{}',
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_profiles_user_unique unique (user_id)
);

create table public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sample_audio_url text,
  sample_storage_path text,
  voice_embedding_id text,
  enrollment_status text not null default 'pending' check (enrollment_status in ('pending', 'mock_enrolled', 'sample_saved', 'verified', 'failed')),
  created_at timestamptz not null default now(),
  constraint voice_profiles_user_unique unique (user_id)
);

create table public.onboarding_self_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  initial_type_scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.pre_speech_surveys (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  nervousness_score smallint not null check (nervousness_score between 1 and 5),
  preparedness_score smallint not null check (preparedness_score between 1 and 5),
  confidence_score smallint not null check (confidence_score between 1 and 5),
  condition_score smallint not null check (condition_score between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.post_speech_feedback (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  context_type public.context_type not null default 'presentation',
  nervousness_score smallint not null check (nervousness_score between 1 and 5),
  perceived_difficulty text not null default '특별한 어려움은 없었다',
  user_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.feature_reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  fluency_features jsonb not null default '{}'::jsonb,
  delivery_features jsonb not null default '{}'::jsonb,
  structure_features jsonb not null default '{}'::jsonb,
  lexical_features jsonb not null default '{}'::jsonb,
  context_features jsonb not null default '{}'::jsonb,
  normalized_features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.speech_reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  filler_counts jsonb not null default '{}'::jsonb,
  pause_data jsonb not null default '{}'::jsonb,
  repeated_expressions jsonb not null default '[]'::jsonb,
  average_sentence_length numeric(6, 2) not null default 0,
  wpm numeric(6, 2) not null default 0,
  clarity_score smallint not null default 0 check (clarity_score between 0 and 100),
  structure_score smallint not null default 0 check (structure_score between 0 and 100),
  delivery_score smallint not null default 0 check (delivery_score between 0 and 100),
  cause_candidates jsonb not null default '[]'::jsonb,
  long_sentences jsonb not null default '[]'::jsonb,
  self_corrections jsonb not null default '[]'::jsonb,
  structure_data jsonb not null default '{}'::jsonb,
  improved_version text not null default '',
  feedback_summary text not null default '',
  stt_provider text not null default 'mock' check (stt_provider in ('openai', 'mock')),
  analysis_mode text not null default 'development_fallback' check (analysis_mode in ('live', 'development_fallback')),
  created_at timestamptz not null default now()
);

create table public.lexical_reports (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  lexical_diversity_score smallint not null default 0 check (lexical_diversity_score between 0 and 100),
  repeated_generic_words jsonb not null default '[]'::jsonb,
  recommended_expressions jsonb not null default '[]'::jsonb,
  summary text not null default '',
  created_at timestamptz not null default now()
);

create table public.expression_suggestions (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  original text not null,
  detected_issue text not null default '',
  improved_version text not null default '',
  explanation text not null default '',
  tone text not null default 'presentation' check (tone in ('presentation', 'interview', 'meeting', 'conversation')),
  source text not null default 'fallback' check (source in ('gemini', 'openai', 'fallback')),
  created_at timestamptz not null default now()
);

create table public.speaker_segments (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  speaker_label text not null,
  is_user_voice boolean not null default false,
  start_time numeric(8, 2) not null check (start_time >= 0),
  end_time numeric(8, 2) not null check (end_time >= start_time),
  transcript text not null default '',
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1)
);

create table public.cause_feedback (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  selected_causes text[] not null default '{}',
  user_note text not null default '',
  created_at timestamptz not null default now()
);

create table public.cause_scores (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  anxiety_pressure_score numeric(4, 3) not null default 0 check (anxiety_pressure_score between 0 and 1),
  cognitive_load_score numeric(4, 3) not null default 0 check (cognitive_load_score between 0 and 1),
  discourse_structure_score numeric(4, 3) not null default 0 check (discourse_structure_score between 0 and 1),
  habitual_pattern_score numeric(4, 3) not null default 0 check (habitual_pattern_score between 0 and 1),
  delivery_regulation_score numeric(4, 3) not null default 0 check (delivery_regulation_score between 0 and 1),
  confidence_scores jsonb not null default '{}'::jsonb,
  academic_basis jsonb not null default '{}'::jsonb,
  score_explanations jsonb not null default '{}'::jsonb,
  inference_model_version text not null default 'weighted-feature-v2',
  top_causes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.coaching_plans (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  recommended_training text[] not null default '{}',
  action_items jsonb not null default '[]'::jsonb,
  next_practice_prompt text not null default '',
  created_at timestamptz not null default now()
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  training_type text not null,
  target_cause text not null,
  prompt text not null default '',
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create table public.training_recommendations (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings (id) on delete cascade,
  target_cause text not null,
  recommended_training text not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create index recordings_user_created_idx on public.recordings (user_id, created_at desc);
create index recordings_context_idx on public.recordings (context_type);
create index user_profiles_user_idx on public.user_profiles (user_id);
create index voice_profiles_user_idx on public.voice_profiles (user_id);
create index onboarding_self_checks_user_idx on public.onboarding_self_checks (user_id, created_at desc);
create index pre_speech_surveys_recording_idx on public.pre_speech_surveys (recording_id);
create index post_speech_feedback_recording_idx on public.post_speech_feedback (recording_id);
create index feature_reports_recording_idx on public.feature_reports (recording_id);
create index speech_reports_recording_idx on public.speech_reports (recording_id);
create index speech_reports_created_idx on public.speech_reports (created_at desc);
create index lexical_reports_recording_idx on public.lexical_reports (recording_id);
create index expression_suggestions_recording_idx on public.expression_suggestions (recording_id);
create index speaker_segments_recording_idx on public.speaker_segments (recording_id, start_time);
create index cause_feedback_recording_idx on public.cause_feedback (recording_id);
create index cause_scores_recording_idx on public.cause_scores (recording_id);
create index coaching_plans_recording_idx on public.coaching_plans (recording_id);
create index training_sessions_user_idx on public.training_sessions (user_id, completed_at desc);
create index training_recommendations_recording_idx on public.training_recommendations (recording_id);

alter table public.recordings enable row level security;
alter table public.user_profiles enable row level security;
alter table public.voice_profiles enable row level security;
alter table public.onboarding_self_checks enable row level security;
alter table public.pre_speech_surveys enable row level security;
alter table public.post_speech_feedback enable row level security;
alter table public.feature_reports enable row level security;
alter table public.speech_reports enable row level security;
alter table public.lexical_reports enable row level security;
alter table public.expression_suggestions enable row level security;
alter table public.speaker_segments enable row level security;
alter table public.cause_feedback enable row level security;
alter table public.cause_scores enable row level security;
alter table public.coaching_plans enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_recommendations enable row level security;

create policy "Users can read own recordings"
on public.recordings for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own recordings"
on public.recordings for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can delete own recordings"
on public.recordings for delete
to authenticated
using (user_id = auth.uid());

create policy "Users can manage own profile"
on public.user_profiles for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own voice profile"
on public.voice_profiles for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own onboarding self checks"
on public.onboarding_self_checks for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can read surveys for own recordings"
on public.pre_speech_surveys for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = pre_speech_surveys.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert surveys for own recordings"
on public.pre_speech_surveys for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = pre_speech_surveys.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read post speech feedback for own recordings"
on public.post_speech_feedback for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = post_speech_feedback.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert post speech feedback for own recordings"
on public.post_speech_feedback for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = post_speech_feedback.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read feature reports for own recordings"
on public.feature_reports for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = feature_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert feature reports for own recordings"
on public.feature_reports for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = feature_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read reports for own recordings"
on public.speech_reports for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = speech_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert reports for own recordings"
on public.speech_reports for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = speech_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read lexical reports for own recordings"
on public.lexical_reports for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = lexical_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert lexical reports for own recordings"
on public.lexical_reports for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = lexical_reports.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read expression suggestions for own recordings"
on public.expression_suggestions for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = expression_suggestions.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert expression suggestions for own recordings"
on public.expression_suggestions for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = expression_suggestions.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read speaker segments for own recordings"
on public.speaker_segments for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = speaker_segments.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert speaker segments for own recordings"
on public.speaker_segments for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = speaker_segments.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read cause feedback for own recordings"
on public.cause_feedback for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = cause_feedback.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert cause feedback for own recordings"
on public.cause_feedback for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = cause_feedback.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read cause scores for own recordings"
on public.cause_scores for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = cause_scores.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert cause scores for own recordings"
on public.cause_scores for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = cause_scores.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can read coaching plans for own recordings"
on public.coaching_plans for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = coaching_plans.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert coaching plans for own recordings"
on public.coaching_plans for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = coaching_plans.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can manage own training sessions"
on public.training_sessions for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can read training recommendations for own recordings"
on public.training_recommendations for select
to authenticated
using (
  exists (
    select 1 from public.recordings
    where recordings.id = training_recommendations.recording_id
      and recordings.user_id = auth.uid()
  )
);

create policy "Users can insert training recommendations for own recordings"
on public.training_recommendations for insert
to authenticated
with check (
  exists (
    select 1 from public.recordings
    where recordings.id = training_recommendations.recording_id
      and recordings.user_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public)
values ('recordings', 'recordings', true)
on conflict (id) do nothing;

create policy "Users can upload own audio files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recordings'
  and auth.uid()::text = (storage.foldername(name))[2]
);

create policy "Users can read own audio files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'recordings'
  and auth.uid()::text = (storage.foldername(name))[2]
);

create policy "Users can delete own audio files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recordings'
  and auth.uid()::text = (storage.foldername(name))[2]
);
