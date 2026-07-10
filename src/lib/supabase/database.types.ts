export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDefinition<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      user_profiles: TableDefinition<
        {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          company_name: string | null
          role_title: string | null
          timezone: string
          created_at: string
          updated_at: string
        },
        {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          company_name?: string | null
          role_title?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          company_name?: string | null
          role_title?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      >
      workspaces: TableDefinition<
        {
          id: string
          name: string
          description: string
          default_currency: string
          workspace_icon: string
          owner_user_id: string
          onboarding_completed_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          name: string
          description?: string
          default_currency?: string
          workspace_icon?: string
          owner_user_id?: string
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          name?: string
          description?: string
          default_currency?: string
          workspace_icon?: string
          owner_user_id?: string
          onboarding_completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      workspace_members: TableDefinition<
        {
          id: string
          workspace_id: string
          user_id: string
          role: Database["public"]["Enums"]["workspace_role"]
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id: string
          role?: Database["public"]["Enums"]["workspace_role"]
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          created_at?: string
          updated_at?: string
        }
      >
      workspace_session_policies: TableDefinition<
        {
          workspace_id: string
          idle_timeout_seconds: number | null
          warning_after_seconds: number
          absolute_timeout_seconds: number
          updated_by: string | null
          created_at: string
          updated_at: string
        },
        {
          workspace_id: string
          idle_timeout_seconds?: number | null
          warning_after_seconds?: number
          absolute_timeout_seconds?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          workspace_id?: string
          idle_timeout_seconds?: number | null
          warning_after_seconds?: number
          absolute_timeout_seconds?: number
          updated_by?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      workspace_session_activity: TableDefinition<
        {
          id: string
          workspace_id: string
          user_id: string
          session_key: string
          started_at: string
          last_activity_at: string
          last_heartbeat_at: string
          active_call_id: string | null
          active_call_started_at: string | null
          expires_at: string
          expired_at: string | null
          expired_reason: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id: string
          session_key: string
          started_at?: string
          last_activity_at?: string
          last_heartbeat_at?: string
          active_call_id?: string | null
          active_call_started_at?: string | null
          expires_at: string
          expired_at?: string | null
          expired_reason?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          user_id?: string
          session_key?: string
          started_at?: string
          last_activity_at?: string
          last_heartbeat_at?: string
          active_call_id?: string | null
          active_call_started_at?: string | null
          expires_at?: string
          expired_at?: string | null
          expired_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      accounts: TableDefinition<
        {
          id: string
          workspace_id: string
          name: string
          website: string | null
          industry: string | null
          employee_count: string | null
          region: string
          currency: string
          owner_user_id: string | null
          current_tools: string | null
          strategic_initiatives: string | null
          competitors: string | null
          notes: string | null
          logo_domain: string | null
          logo_url: string | null
          logo_source: string
          logo_status: string
          logo_checked_at: string | null
          archived_at: string | null
          archived_by: string | null
          archive_reason: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          name: string
          website?: string | null
          industry?: string | null
          employee_count?: string | null
          region?: string
          currency?: string
          owner_user_id?: string | null
          current_tools?: string | null
          strategic_initiatives?: string | null
          competitors?: string | null
          notes?: string | null
          logo_domain?: string | null
          logo_url?: string | null
          logo_source?: string
          logo_status?: string
          logo_checked_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          name?: string
          website?: string | null
          industry?: string | null
          employee_count?: string | null
          region?: string
          currency?: string
          owner_user_id?: string | null
          current_tools?: string | null
          strategic_initiatives?: string | null
          competitors?: string | null
          notes?: string | null
          logo_domain?: string | null
          logo_url?: string | null
          logo_source?: string
          logo_status?: string
          logo_checked_at?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      contacts: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          full_name: string
          preferred_name: string | null
          job_title: string | null
          department: string | null
          seniority: string | null
          work_email: string | null
          business_phone: string | null
          linkedin_url: string | null
          location: string | null
          timezone: string | null
          employment_status: string
          private_notes: string | null
          source: string
          normalized_email: string | null
          normalized_linkedin_url: string | null
          created_by_user_id: string | null
          updated_by_user_id: string | null
          archived_at: string | null
          archived_by: string | null
          archive_reason: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          full_name: string
          preferred_name?: string | null
          job_title?: string | null
          department?: string | null
          seniority?: string | null
          work_email?: string | null
          business_phone?: string | null
          linkedin_url?: string | null
          location?: string | null
          timezone?: string | null
          employment_status?: string
          private_notes?: string | null
          source?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          full_name?: string
          preferred_name?: string | null
          job_title?: string | null
          department?: string | null
          seniority?: string | null
          work_email?: string | null
          business_phone?: string | null
          linkedin_url?: string | null
          location?: string | null
          timezone?: string | null
          employment_status?: string
          private_notes?: string | null
          source?: string
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
        }
      >
      opportunities: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          name: string
          stage: string
          amount: string | null
          close_date: string | null
          close_date_note: string | null
          owner_user_id: string | null
          source: string | null
          pain: string | null
          decision_process: string | null
          next_step: string | null
          manual_notes: string | null
          coverage_score: number
          missing_count: number
          weak_count: number
          call_type: string
          next_question: string | null
          question_reason: string | null
          archived_at: string | null
          archived_by: string | null
          archive_reason: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          name: string
          stage?: string
          amount?: string | null
          close_date?: string | null
          close_date_note?: string | null
          owner_user_id?: string | null
          source?: string | null
          pain?: string | null
          decision_process?: string | null
          next_step?: string | null
          manual_notes?: string | null
          coverage_score?: number
          missing_count?: number
          weak_count?: number
          call_type?: string
          next_question?: string | null
          question_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          name?: string
          stage?: string
          amount?: string | null
          close_date?: string | null
          close_date_note?: string | null
          owner_user_id?: string | null
          source?: string | null
          pain?: string | null
          decision_process?: string | null
          next_step?: string | null
          manual_notes?: string | null
          coverage_score?: number
          missing_count?: number
          weak_count?: number
          call_type?: string
          next_question?: string | null
          question_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          archive_reason?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      playbooks: TableDefinition<
        {
          id: string
          workspace_id: string | null
          slug: string
          name: string
          description: string | null
          best_for: string | null
          evidence_standard: string | null
          live_guidance: string | null
          is_system: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id?: string | null
          slug: string
          name: string
          description?: string | null
          best_for?: string | null
          evidence_standard?: string | null
          live_guidance?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string | null
          slug?: string
          name?: string
          description?: string | null
          best_for?: string | null
          evidence_standard?: string | null
          live_guidance?: string | null
          is_system?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      playbook_fields: TableDefinition<
        {
          id: string
          playbook_id: string
          label: string
          description: string | null
          evidence_standard: string | null
          sort_order: number
          created_at: string
          updated_at: string
        },
        {
          id?: string
          playbook_id: string
          label: string
          description?: string | null
          evidence_standard?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          playbook_id?: string
          label?: string
          description?: string | null
          evidence_standard?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      >
      opportunity_playbooks: TableDefinition<
        {
          id: string
          opportunity_id: string
          playbook_id: string
          created_at: string
        },
        {
          id?: string
          opportunity_id: string
          playbook_id: string
          created_at?: string
        },
        {
          id?: string
          opportunity_id?: string
          playbook_id?: string
          created_at?: string
        }
      >
      opportunity_contacts: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          contact_id: string
          buying_roles: string[]
          influence: string
          relationship_strength: string
          stance: string
          is_primary: boolean
          notes: string | null
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          contact_id: string
          buying_roles?: string[]
          influence?: string
          relationship_strength?: string
          stance?: string
          is_primary?: boolean
          notes?: string | null
          created_by_user_id?: string | null
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          contact_id?: string
          buying_roles?: string[]
          influence?: string
          relationship_strength?: string
          stance?: string
          is_primary?: boolean
          notes?: string | null
          created_by_user_id?: string | null
        }
      >
      calls: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          title: string
          call_type: string
          status: Database["public"]["Enums"]["call_status"]
          started_at: string | null
          ended_at: string | null
          ended_reason: string
          duration_limit_seconds: number
          duration_seconds: number | null
          recording_error: string | null
          recording_mime_type: string | null
          recording_ready_at: string | null
          recording_size_bytes: number | null
          recording_status: string
          recording_storage_path: string | null
          recording_url: string | null
          audio_preflight: Json
          audio_source_summary: Json
          guidance_readiness: Json
          retention_expires_at: string
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          title: string
          call_type?: string
          status?: Database["public"]["Enums"]["call_status"]
          started_at?: string | null
          ended_at?: string | null
          ended_reason?: string
          duration_limit_seconds?: number
          duration_seconds?: number | null
          recording_error?: string | null
          recording_mime_type?: string | null
          recording_ready_at?: string | null
          recording_size_bytes?: number | null
          recording_status?: string
          recording_storage_path?: string | null
          recording_url?: string | null
          audio_preflight?: Json
          audio_source_summary?: Json
          guidance_readiness?: Json
          retention_expires_at?: string
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          title?: string
          call_type?: string
          status?: Database["public"]["Enums"]["call_status"]
          started_at?: string | null
          ended_at?: string | null
          ended_reason?: string
          duration_limit_seconds?: number
          duration_seconds?: number | null
          recording_error?: string | null
          recording_mime_type?: string | null
          recording_ready_at?: string | null
          recording_size_bytes?: number | null
          recording_status?: string
          recording_storage_path?: string | null
          recording_url?: string | null
          audio_preflight?: Json
          audio_source_summary?: Json
          guidance_readiness?: Json
          retention_expires_at?: string
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      call_playbooks: TableDefinition<
        {
          id: string
          call_id: string
          playbook_id: string
          created_at: string
        },
        { id?: string; call_id: string; playbook_id: string; created_at?: string },
        { id?: string; call_id?: string; playbook_id?: string; created_at?: string }
      >
      call_contacts: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          contact_id: string
          attendance_status: string
          is_primary: boolean
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          contact_id: string
          attendance_status?: string
          is_primary?: boolean
          created_by_user_id?: string | null
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          call_id?: string
          contact_id?: string
          attendance_status?: string
          is_primary?: boolean
          created_by_user_id?: string | null
        }
      >
      call_speakers: TableDefinition<
        {
          id: string
          call_id: string
          label: string
          display_name: string | null
          role: Database["public"]["Enums"]["speaker_role"]
          contact_id: string | null
          contact_confirmed_at: string | null
          contact_confirmed_by: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          call_id: string
          label: string
          display_name?: string | null
          role?: Database["public"]["Enums"]["speaker_role"]
          contact_id?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          call_id?: string
          label?: string
          display_name?: string | null
          role?: Database["public"]["Enums"]["speaker_role"]
          contact_id?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      transcript_segments: TableDefinition<
        {
          id: string
          call_id: string
          speaker_id: string | null
          start_ms: number | null
          end_ms: number | null
          text: string
          is_final: boolean
          speaker_attribution: string | null
          speaker_attribution_reason: string | null
          speaker_confidence: number | null
          speaker_needs_review: boolean
          speaker_source: string | null
          openai_item_id: string | null
          openai_segment_id: string | null
          audio_source_kind: string | null
          client_turn_id: string | null
          transcription_provider: string | null
          provider_session_id: string | null
          provider_turn_index: number | null
          provider_event_id: string | null
          end_of_turn_confidence: number | null
          word_confidence: number | null
          language_detected: string | null
          diarization_speaker: string | null
          turn_sequence: number | null
          transcription_delay: string | null
          quality_flags: Json
          created_at: string
          updated_at: string
        },
        {
          id?: string
          call_id: string
          speaker_id?: string | null
          start_ms?: number | null
          end_ms?: number | null
          text: string
          is_final?: boolean
          speaker_attribution?: string | null
          speaker_attribution_reason?: string | null
          speaker_confidence?: number | null
          speaker_needs_review?: boolean
          speaker_source?: string | null
          openai_item_id?: string | null
          openai_segment_id?: string | null
          audio_source_kind?: string | null
          client_turn_id?: string | null
          transcription_provider?: string | null
          provider_session_id?: string | null
          provider_turn_index?: number | null
          provider_event_id?: string | null
          end_of_turn_confidence?: number | null
          word_confidence?: number | null
          language_detected?: string | null
          diarization_speaker?: string | null
          turn_sequence?: number | null
          transcription_delay?: string | null
          quality_flags?: Json
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          call_id?: string
          speaker_id?: string | null
          start_ms?: number | null
          end_ms?: number | null
          text?: string
          is_final?: boolean
          speaker_attribution?: string | null
          speaker_attribution_reason?: string | null
          speaker_confidence?: number | null
          speaker_needs_review?: boolean
          speaker_source?: string | null
          openai_item_id?: string | null
          openai_segment_id?: string | null
          audio_source_kind?: string | null
          client_turn_id?: string | null
          transcription_provider?: string | null
          provider_session_id?: string | null
          provider_turn_index?: number | null
          provider_event_id?: string | null
          end_of_turn_confidence?: number | null
          word_confidence?: number | null
          language_detected?: string | null
          diarization_speaker?: string | null
          turn_sequence?: number | null
          transcription_delay?: string | null
          quality_flags?: Json
          created_at?: string
          updated_at?: string
        }
      >
      call_notes: TableDefinition<
        {
          id: string
          call_id: string
          note_type: Database["public"]["Enums"]["call_note_type"]
          text: string
          source_transcript_segment_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          call_id: string
          note_type?: Database["public"]["Enums"]["call_note_type"]
          text: string
          source_transcript_segment_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          call_id?: string
          note_type?: Database["public"]["Enums"]["call_note_type"]
          text?: string
          source_transcript_segment_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      call_intent_ledger: TableDefinition<
        {
          id: string
          workspace_id: string
          call_id: string
          opportunity_id: string
          intent_cluster_id: string
          intent_label: string
          status: string
          confidence: number
          summary: string
          value: string | null
          last_question: string | null
          last_answer: string | null
          source_turn_ids: Json
          related_playbook_field_ids: Json
          reason: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          call_id: string
          opportunity_id: string
          intent_cluster_id: string
          intent_label?: string
          status?: string
          confidence?: number
          summary?: string
          value?: string | null
          last_question?: string | null
          last_answer?: string | null
          source_turn_ids?: Json
          related_playbook_field_ids?: Json
          reason?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          call_id?: string
          opportunity_id?: string
          intent_cluster_id?: string
          intent_label?: string
          status?: string
          confidence?: number
          summary?: string
          value?: string | null
          last_question?: string | null
          last_answer?: string | null
          source_turn_ids?: Json
          related_playbook_field_ids?: Json
          reason?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      opportunity_field_evidence: TableDefinition<
        {
          id: string
          opportunity_id: string
          playbook_field_id: string
          status: Database["public"]["Enums"]["field_evidence_status"]
          value: string | null
          evidence_summary: string | null
          confidence: number | null
          source: string | null
          source_call_id: string | null
          source_transcript_segment_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          opportunity_id: string
          playbook_field_id: string
          status?: Database["public"]["Enums"]["field_evidence_status"]
          value?: string | null
          evidence_summary?: string | null
          confidence?: number | null
          source?: string | null
          source_call_id?: string | null
          source_transcript_segment_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          opportunity_id?: string
          playbook_field_id?: string
          status?: Database["public"]["Enums"]["field_evidence_status"]
          value?: string | null
          evidence_summary?: string | null
          confidence?: number | null
          source?: string | null
          source_call_id?: string | null
          source_transcript_segment_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      opportunity_stakeholders: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          normalized_name: string
          name: string
          role_label: string
          influence_label: string
          status: string
          confidence: number
          evidence_summary: string
          source_call_id: string | null
          source_turn_ids: Json
          contact_id: string | null
          contact_confirmed_at: string | null
          contact_confirmed_by: string | null
          last_seen_at: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          normalized_name: string
          name: string
          role_label?: string
          influence_label?: string
          status?: string
          confidence?: number
          evidence_summary?: string
          source_call_id?: string | null
          source_turn_ids?: Json
          contact_id?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          normalized_name?: string
          name?: string
          role_label?: string
          influence_label?: string
          status?: string
          confidence?: number
          evidence_summary?: string
          source_call_id?: string | null
          source_turn_ids?: Json
          contact_id?: string | null
          contact_confirmed_at?: string | null
          contact_confirmed_by?: string | null
          last_seen_at?: string
          created_at?: string
          updated_at?: string
        }
      >
      live_guidance_events: TableDefinition<
        {
          id: string
          call_id: string
          opportunity_id: string
          recommended_question: string
          target_playbook_field_id: string | null
          reason: string | null
          selected_call_type: string | null
          selected_playbooks: Json
          covered_intents: Json
          missing_gaps: Json
          conversation_flow: Json
          ui_mode: string | null
          conversation_state: Json
          candidate_scores: Json
          source_turn_ids: Json
          guidance_latency_ms: number | null
          created_at: string
        },
        {
          id?: string
          call_id: string
          opportunity_id: string
          recommended_question: string
          target_playbook_field_id?: string | null
          reason?: string | null
          selected_call_type?: string | null
          selected_playbooks?: Json
          covered_intents?: Json
          missing_gaps?: Json
          conversation_flow?: Json
          ui_mode?: string | null
          conversation_state?: Json
          candidate_scores?: Json
          source_turn_ids?: Json
          guidance_latency_ms?: number | null
          created_at?: string
        },
        {
          id?: string
          call_id?: string
          opportunity_id?: string
          recommended_question?: string
          target_playbook_field_id?: string | null
          reason?: string | null
          selected_call_type?: string | null
          selected_playbooks?: Json
          covered_intents?: Json
          missing_gaps?: Json
          conversation_flow?: Json
          ui_mode?: string | null
          conversation_state?: Json
          candidate_scores?: Json
          source_turn_ids?: Json
          guidance_latency_ms?: number | null
          created_at?: string
        }
      >
      live_guidance_feedback: TableDefinition<
        {
          id: string
          call_id: string
          opportunity_id: string
          guidance_event_id: string | null
          action: string
          question: string | null
          target: string | null
          playbook_label: string | null
          reason: string | null
          created_at: string
        },
        {
          id?: string
          call_id: string
          opportunity_id: string
          guidance_event_id?: string | null
          action: string
          question?: string | null
          target?: string | null
          playbook_label?: string | null
          reason?: string | null
          created_at?: string
        },
        {
          id?: string
          call_id?: string
          opportunity_id?: string
          guidance_event_id?: string | null
          action?: string
          question?: string | null
          target?: string | null
          playbook_label?: string | null
          reason?: string | null
          created_at?: string
        }
      >
      next_call_briefs: TableDefinition<
        {
          id: string
          opportunity_id: string
          previous_call_id: string | null
          objective: string | null
          suggested_opening: string | null
          focus_questions: Json
          missing_evidence: Json
          risk_notes: Json
          recommended_next_step: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          opportunity_id: string
          previous_call_id?: string | null
          objective?: string | null
          suggested_opening?: string | null
          focus_questions?: Json
          missing_evidence?: Json
          risk_notes?: Json
          recommended_next_step?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          opportunity_id?: string
          previous_call_id?: string | null
          objective?: string | null
          suggested_opening?: string | null
          focus_questions?: Json
          missing_evidence?: Json
          risk_notes?: Json
          recommended_next_step?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      post_call_outputs: TableDefinition<
        {
          id: string
          call_id: string
          follow_up_email: string | null
          next_call_plan: string | null
          account_updates: Json
          opportunity_updates: Json
          missing_info: Json
          created_at: string
          updated_at: string
        },
        {
          id?: string
          call_id: string
          follow_up_email?: string | null
          next_call_plan?: string | null
          account_updates?: Json
          opportunity_updates?: Json
          missing_info?: Json
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          call_id?: string
          follow_up_email?: string | null
          next_call_plan?: string | null
          account_updates?: Json
          opportunity_updates?: Json
          missing_info?: Json
          created_at?: string
          updated_at?: string
        }
      >
      seller_research_profiles: TableDefinition<
        {
          id: string
          workspace_id: string
          user_id: string
          seller_company: string
          seller_domain: string | null
          product_context: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id?: string
          seller_company: string
          seller_domain?: string | null
          product_context: string
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          user_id?: string
          seller_company?: string
          seller_domain?: string | null
          product_context?: string
          created_at?: string
          updated_at?: string
        }
      >
      account_enrichment_profiles: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          business_summary: string | null
          likely_buying_triggers: string | null
          strategic_priorities: string | null
          current_tech_stack: string | null
          hiring_growth_signals: string | null
          recent_news_signals: string | null
          procurement_signals: string | null
          review_sentiment_signals: string | null
          likely_stakeholders: string | null
          discovery_angles: string | null
          risk_flags: string | null
          source_notes: string | null
          confidence: string | null
          last_enriched_at: string | null
          created_by_user_id: string | null
          updated_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          business_summary?: string | null
          likely_buying_triggers?: string | null
          strategic_priorities?: string | null
          current_tech_stack?: string | null
          hiring_growth_signals?: string | null
          recent_news_signals?: string | null
          procurement_signals?: string | null
          review_sentiment_signals?: string | null
          likely_stakeholders?: string | null
          discovery_angles?: string | null
          risk_flags?: string | null
          source_notes?: string | null
          confidence?: string | null
          last_enriched_at?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          business_summary?: string | null
          likely_buying_triggers?: string | null
          strategic_priorities?: string | null
          current_tech_stack?: string | null
          hiring_growth_signals?: string | null
          recent_news_signals?: string | null
          procurement_signals?: string | null
          review_sentiment_signals?: string | null
          likely_stakeholders?: string | null
          discovery_angles?: string | null
          risk_flags?: string | null
          source_notes?: string | null
          confidence?: string | null
          last_enriched_at?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      account_enrichment_runs: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          status: string
          requested_account_name: string | null
          requested_domain: string | null
          proposed_core_updates: Json
          applied_core_updates: Json
          suggested_core_updates: Json
          sales_signals: Json
          sources: Json
          error_message: string | null
          created_by_user_id: string | null
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          status?: string
          requested_account_name?: string | null
          requested_domain?: string | null
          proposed_core_updates?: Json
          applied_core_updates?: Json
          suggested_core_updates?: Json
          sales_signals?: Json
          sources?: Json
          error_message?: string | null
          created_by_user_id?: string | null
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          status?: string
          requested_account_name?: string | null
          requested_domain?: string | null
          proposed_core_updates?: Json
          applied_core_updates?: Json
          suggested_core_updates?: Json
          sales_signals?: Json
          sources?: Json
          error_message?: string | null
          created_by_user_id?: string | null
          created_at?: string
        }
      >
      contact_enrichment_profiles: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          contact_id: string
          professional_summary: string | null
          role_scope: string | null
          likely_priorities: string | null
          likely_kpis: string | null
          relevant_experience: string | null
          recent_professional_signals: string | null
          discovery_angles: string | null
          caveats: string | null
          confidence: number | null
          sources: Json
          last_enriched_at: string | null
          created_by_user_id: string | null
          updated_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          contact_id: string
          professional_summary?: string | null
          role_scope?: string | null
          likely_priorities?: string | null
          likely_kpis?: string | null
          relevant_experience?: string | null
          recent_professional_signals?: string | null
          discovery_angles?: string | null
          caveats?: string | null
          confidence?: number | null
          sources?: Json
          last_enriched_at?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          contact_id?: string
          professional_summary?: string | null
          role_scope?: string | null
          likely_priorities?: string | null
          likely_kpis?: string | null
          relevant_experience?: string | null
          recent_professional_signals?: string | null
          discovery_angles?: string | null
          caveats?: string | null
          confidence?: number | null
          sources?: Json
          last_enriched_at?: string | null
          created_by_user_id?: string | null
          updated_by_user_id?: string | null
        }
      >
      contact_enrichment_runs: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          contact_id: string
          status: string
          model: string | null
          requested_full_name: string | null
          requested_account_name: string | null
          proposed_core_updates: Json
          applied_core_updates: Json
          enrichment_payload: Json
          sources: Json
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_by_user_id: string | null
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          contact_id: string
          status?: string
          model?: string | null
          requested_full_name?: string | null
          requested_account_name?: string | null
          proposed_core_updates?: Json
          applied_core_updates?: Json
          enrichment_payload?: Json
          sources?: Json
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_by_user_id?: string | null
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          contact_id?: string
          status?: string
          model?: string | null
          requested_full_name?: string | null
          requested_account_name?: string | null
          proposed_core_updates?: Json
          applied_core_updates?: Json
          enrichment_payload?: Json
          sources?: Json
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_by_user_id?: string | null
        }
      >
      csv_import_runs: TableDefinition<
        {
          id: string
          workspace_id: string
          import_type: string
          file_name: string | null
          row_count: number
          created_count: number
          updated_count: number
          skipped_count: number
          failed_count: number
          failure_rows: Json
          enrichment_enabled: boolean
          enrichment_queued_count: number
          enrichment_paused_count: number
          enrichment_skipped_count: number
          enrichment_already_tracked_count: number
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          import_type: string
          file_name?: string | null
          row_count?: number
          created_count?: number
          updated_count?: number
          skipped_count?: number
          failed_count?: number
          failure_rows?: Json
          enrichment_enabled?: boolean
          enrichment_queued_count?: number
          enrichment_paused_count?: number
          enrichment_skipped_count?: number
          enrichment_already_tracked_count?: number
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          import_type?: string
          file_name?: string | null
          row_count?: number
          created_count?: number
          updated_count?: number
          skipped_count?: number
          failed_count?: number
          failure_rows?: Json
          enrichment_enabled?: boolean
          enrichment_queued_count?: number
          enrichment_paused_count?: number
          enrichment_skipped_count?: number
          enrichment_already_tracked_count?: number
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      ai_enrichment_jobs: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string | null
          import_run_id: string | null
          job_type: string
          status: string
          idempotency_key: string
          requested_account_name: string | null
          requested_domain: string | null
          priority: number
          attempts: number
          max_attempts: number
          run_after: string
          locked_at: string | null
          locked_by: string | null
          last_error: string | null
          created_by_user_id: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id?: string | null
          import_run_id?: string | null
          job_type?: string
          status?: string
          idempotency_key: string
          requested_account_name?: string | null
          requested_domain?: string | null
          priority?: number
          attempts?: number
          max_attempts?: number
          run_after?: string
          locked_at?: string | null
          locked_by?: string | null
          last_error?: string | null
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string | null
          import_run_id?: string | null
          job_type?: string
          status?: string
          idempotency_key?: string
          requested_account_name?: string | null
          requested_domain?: string | null
          priority?: number
          attempts?: number
          max_attempts?: number
          run_after?: string
          locked_at?: string | null
          locked_by?: string | null
          last_error?: string | null
          created_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      customer_research_runs: TableDefinition<
        {
          id: string
          call_id: string | null
          account_id: string
          opportunity_id: string | null
          contact_id: string | null
          enabled: boolean
          customer_contact: string | null
          customer_role: string | null
          seller_company: string | null
          seller_domain: string | null
          product_context: string | null
          trusted_sources: Json
          research_summary: string | null
          question_angle: string | null
          created_by_user_id: string | null
          created_at: string
        },
        {
          id?: string
          call_id?: string | null
          account_id: string
          opportunity_id?: string | null
          contact_id?: string | null
          enabled?: boolean
          customer_contact?: string | null
          customer_role?: string | null
          seller_company?: string | null
          seller_domain?: string | null
          product_context?: string | null
          trusted_sources?: Json
          research_summary?: string | null
          question_angle?: string | null
          created_by_user_id?: string | null
          created_at?: string
        },
        {
          id?: string
          call_id?: string | null
          account_id?: string
          opportunity_id?: string | null
          contact_id?: string | null
          enabled?: boolean
          customer_contact?: string | null
          customer_role?: string | null
          seller_company?: string | null
          seller_domain?: string | null
          product_context?: string | null
          trusted_sources?: Json
          research_summary?: string | null
          question_angle?: string | null
          created_by_user_id?: string | null
          created_at?: string
        }
      >
      user_ai_settings: TableDefinition<
        {
          id: string
          user_id: string
          workspace_id: string
          provider: string
          openai_api_key_encrypted: string | null
          key_last_four: string | null
          key_fingerprint: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          user_id?: string
          workspace_id: string
          provider?: string
          openai_api_key_encrypted?: string | null
          key_last_four?: string | null
          key_fingerprint?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          user_id?: string
          workspace_id?: string
          provider?: string
          openai_api_key_encrypted?: string | null
          key_last_four?: string | null
          key_fingerprint?: string | null
          created_at?: string
          updated_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: {
      is_workspace_member: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      current_salesframe_session_key: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_workspace_session_active: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_member_with_active_session: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      is_workspace_owner: {
        Args: { target_workspace_id: string }
        Returns: boolean
      }
      can_access_opportunity: {
        Args: { target_opportunity_id: string }
        Returns: boolean
      }
      can_access_call: {
        Args: { target_call_id: string }
        Returns: boolean
      }
      can_access_contact: {
        Args: { target_contact_id: string }
        Returns: boolean
      }
      normalize_linkedin_contact_url: {
        Args: { value: string }
        Returns: string
      }
      can_access_playbook: {
        Args: { target_playbook_id: string }
        Returns: boolean
      }
      replace_opportunity_contacts: {
        Args: { target_opportunity_id: string; assignments: Json }
        Returns: Database["public"]["Tables"]["opportunity_contacts"]["Row"][]
      }
      replace_call_contacts: {
        Args: { target_call_id: string; assignments: Json }
        Returns: Database["public"]["Tables"]["call_contacts"]["Row"][]
      }
      get_latest_contact_enrichment_runs: {
        Args: { target_contact_ids: string[] }
        Returns: {
          contact_id: string
          status: string
          error_message: string | null
          created_at: string
        }[]
      }
      finalize_contact_enrichment_run: {
        Args: {
          target_run_id: string
          target_contact_id: string
          target_workspace_id: string
          target_account_id: string
          target_user_id: string
          model_name: string
          profile_payload: Json
          core_fields: Json
          result_payload: Json
          source_payload: Json
        }
        Returns: boolean
      }
      workspace_id_from_storage_path: {
        Args: { object_name: string }
        Returns: string | null
      }
    }
    Enums: {
      workspace_role: "owner" | "member"
      field_evidence_status: "missing" | "asked" | "weak" | "confirmed"
      call_status: "planned" | "active" | "processing" | "post_call_draft" | "reviewed" | "needs_attention" | "archived"
      speaker_role: "seller" | "customer" | "customer_2" | "customer_3" | "unknown"
      call_note_type: "ai_note" | "manual_note" | "evidence" | "summary" | "action_item"
    }
    CompositeTypes: Record<string, never>
  }
}

export type Tables<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof Database["public"]["Tables"],
> = Database["public"]["Tables"][TableName]["Update"]

export type Enums<EnumName extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][EnumName]
