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
      assistant_threads: TableDefinition<
        {
          id: string
          workspace_id: string
          created_by_user_id: string
          title: string
          archived_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          created_by_user_id: string
          title?: string
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          created_by_user_id?: string
          title?: string
          archived_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      workspace_member_preferences: TableDefinition<
        {
          workspace_id: string
          user_id: string
          interface_mode: string
          active_thread_id: string | null
          last_standard_path: string
          created_at: string
          updated_at: string
        },
        {
          workspace_id: string
          user_id: string
          interface_mode?: string
          active_thread_id?: string | null
          last_standard_path?: string
          created_at?: string
          updated_at?: string
        },
        {
          workspace_id?: string
          user_id?: string
          interface_mode?: string
          active_thread_id?: string | null
          last_standard_path?: string
          created_at?: string
          updated_at?: string
        }
      >
      assistant_messages: TableDefinition<
        {
          id: string
          workspace_id: string
          thread_id: string
          owner_user_id: string
          role: string
          content: string
          client_request_id: string | null
          ordinal: number
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          thread_id: string
          owner_user_id: string
          role: string
          content?: string
          client_request_id?: string | null
          ordinal?: number
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          thread_id?: string
          owner_user_id?: string
          role?: string
          content?: string
          client_request_id?: string | null
          ordinal?: number
          created_at?: string
        }
      >
      assistant_runs: TableDefinition<
        {
          id: string
          workspace_id: string
          thread_id: string
          user_id: string
          client_request_id: string
          user_message_id: string
          assistant_message_id: string | null
          model: string
          status: string
          safe_error_code: string | null
          input_tokens: number | null
          output_tokens: number | null
          tool_rounds: number
          read_operations: number
          started_at: string
          lease_expires_at: string
          completed_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          thread_id: string
          user_id: string
          client_request_id: string
          user_message_id: string
          assistant_message_id?: string | null
          model: string
          status?: string
          safe_error_code?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          tool_rounds?: number
          read_operations?: number
          started_at?: string
          lease_expires_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          thread_id?: string
          user_id?: string
          client_request_id?: string
          user_message_id?: string
          assistant_message_id?: string | null
          model?: string
          status?: string
          safe_error_code?: string | null
          input_tokens?: number | null
          output_tokens?: number | null
          tool_rounds?: number
          read_operations?: number
          started_at?: string
          lease_expires_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      assistant_turn_rate_ledger: TableDefinition<
        {
          id: string
          workspace_id: string
          user_id: string
          client_request_id: string
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id: string
          client_request_id: string
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          user_id?: string
          client_request_id?: string
          created_at?: string
        }
      >
      assistant_action_proposals: TableDefinition<
        {
          id: string
          workspace_id: string
          thread_id: string
          user_id: string
          run_id: string
          capability_id: string
          arguments: Json
          preview: Json
          expected_record_updated_at: string | null
          target_resource_type: string | null
          target_resource_id: string | null
          risk: string
          status: string
          idempotency_key: string
          safe_error_code: string | null
          result_resource_type: string | null
          result_resource_id: string | null
          expires_at: string
          confirmed_at: string | null
          cancelled_at: string | null
          executed_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          thread_id: string
          user_id: string
          run_id: string
          capability_id: string
          arguments: Json
          preview: Json
          expected_record_updated_at?: string | null
          target_resource_type?: string | null
          target_resource_id?: string | null
          risk?: string
          status?: string
          idempotency_key: string
          safe_error_code?: string | null
          result_resource_type?: string | null
          result_resource_id?: string | null
          expires_at?: string
          confirmed_at?: string | null
          cancelled_at?: string | null
          executed_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          thread_id?: string
          user_id?: string
          run_id?: string
          capability_id?: string
          arguments?: Json
          preview?: Json
          expected_record_updated_at?: string | null
          target_resource_type?: string | null
          target_resource_id?: string | null
          risk?: string
          status?: string
          idempotency_key?: string
          safe_error_code?: string | null
          result_resource_type?: string | null
          result_resource_id?: string | null
          expires_at?: string
          confirmed_at?: string | null
          cancelled_at?: string | null
          executed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      assistant_action_events: TableDefinition<
        {
          id: string
          workspace_id: string
          proposal_id: string
          user_id: string
          capability_id: string
          target_resource_type: string | null
          target_resource_id: string | null
          result_resource_type: string | null
          result_resource_id: string | null
          event_type: string
          safe_code: string | null
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          proposal_id: string
          user_id: string
          capability_id: string
          target_resource_type?: string | null
          target_resource_id?: string | null
          result_resource_type?: string | null
          result_resource_id?: string | null
          event_type: string
          safe_code?: string | null
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          proposal_id?: string
          user_id?: string
          capability_id?: string
          target_resource_type?: string | null
          target_resource_id?: string | null
          result_resource_type?: string | null
          result_resource_id?: string | null
          event_type?: string
          safe_code?: string | null
          created_at?: string
        }
      >
      assistant_message_references: TableDefinition<
        {
          id: string
          workspace_id: string
          thread_id: string
          owner_user_id: string
          message_id: string
          reference_type: string
          reference_id: string
          label: string
          route: string
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          thread_id: string
          owner_user_id: string
          message_id: string
          reference_type: string
          reference_id: string
          label: string
          route: string
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          thread_id?: string
          owner_user_id?: string
          message_id?: string
          reference_type?: string
          reference_id?: string
          label?: string
          route?: string
          created_at?: string
        }
      >
      assistant_voice_token_grants: TableDefinition<
        {
          id: string
          workspace_id: string
          user_id: string
          issued_at: string
        },
        {
          id?: string
          workspace_id: string
          user_id: string
          issued_at?: string
        },
        {
          id?: string
          workspace_id?: string
          user_id?: string
          issued_at?: string
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
          capture_method: string
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
          capture_method?: string
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
          capture_method?: string
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
      meeting_bot_sessions: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          requested_by_user_id: string | null
          region: string
          platform: string
          recall_bot_id: string | null
          recall_recording_id: string | null
          recall_transcript_id: string | null
          provider_absence_confirmed_at: string | null
          correlation_token: string
          client_request_id: string
          client_instance_id: string
          client_visibility: string
          client_visibility_updated_at: string
          status: string
          provider_status: string | null
          provider_subcode: string | null
          safe_error_code: string | null
          started_at: string
          joined_at: string | null
          recording_started_at: string | null
          transcript_completed_at: string | null
          final_transcript_watermark_ms: number | null
          transcript_artifact_sha256: string | null
          last_heartbeat_at: string
          disconnect_requested_at: string | null
          disconnect_grace_expires_at: string | null
          ended_at: string | null
          retention_expires_at: string
          media_transfer_status: string
          media_storage_path: string | null
          media_size_bytes: number | null
          media_checksum_sha256: string | null
          provider_media_deleted_at: string | null
          post_call_requested_at: string | null
          post_call_completed_at: string | null
          post_call_error_code: string | null
          post_call_attempts: number
          post_call_locked_at: string | null
          post_call_locked_by: string | null
          processing_locked_at: string | null
          processing_locked_by: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          requested_by_user_id?: string | null
          region?: string
          platform: string
          recall_bot_id?: string | null
          recall_recording_id?: string | null
          recall_transcript_id?: string | null
          provider_absence_confirmed_at?: string | null
          correlation_token?: string
          client_request_id: string
          client_instance_id: string
          client_visibility?: string
          client_visibility_updated_at?: string
          status?: string
          provider_status?: string | null
          provider_subcode?: string | null
          safe_error_code?: string | null
          started_at?: string
          joined_at?: string | null
          recording_started_at?: string | null
          transcript_completed_at?: string | null
          final_transcript_watermark_ms?: number | null
          transcript_artifact_sha256?: string | null
          last_heartbeat_at?: string
          disconnect_requested_at?: string | null
          disconnect_grace_expires_at?: string | null
          ended_at?: string | null
          retention_expires_at?: string
          media_transfer_status?: string
          media_storage_path?: string | null
          media_size_bytes?: number | null
          media_checksum_sha256?: string | null
          provider_media_deleted_at?: string | null
          post_call_requested_at?: string | null
          post_call_completed_at?: string | null
          post_call_error_code?: string | null
          post_call_attempts?: number
          post_call_locked_at?: string | null
          post_call_locked_by?: string | null
          processing_locked_at?: string | null
          processing_locked_by?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          call_id?: string
          requested_by_user_id?: string | null
          region?: string
          platform?: string
          recall_bot_id?: string | null
          recall_recording_id?: string | null
          recall_transcript_id?: string | null
          provider_absence_confirmed_at?: string | null
          correlation_token?: string
          client_request_id?: string
          client_instance_id?: string
          client_visibility?: string
          client_visibility_updated_at?: string
          status?: string
          provider_status?: string | null
          provider_subcode?: string | null
          safe_error_code?: string | null
          started_at?: string
          joined_at?: string | null
          recording_started_at?: string | null
          transcript_completed_at?: string | null
          final_transcript_watermark_ms?: number | null
          transcript_artifact_sha256?: string | null
          last_heartbeat_at?: string
          disconnect_requested_at?: string | null
          disconnect_grace_expires_at?: string | null
          ended_at?: string | null
          retention_expires_at?: string
          media_transfer_status?: string
          media_storage_path?: string | null
          media_size_bytes?: number | null
          media_checksum_sha256?: string | null
          provider_media_deleted_at?: string | null
          post_call_requested_at?: string | null
          post_call_completed_at?: string | null
          post_call_error_code?: string | null
          post_call_attempts?: number
          post_call_locked_at?: string | null
          post_call_locked_by?: string | null
          processing_locked_at?: string | null
          processing_locked_by?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      meeting_bot_usage_ledger: TableDefinition<
        {
          id: string
          session_id: string
          workspace_id: string
          requested_by_user_id: string | null
          reserved_minutes: number
          consumed_minutes: number
          finalized_at: string | null
          created_at: string
        },
        {
          id?: string
          session_id: string
          workspace_id: string
          requested_by_user_id?: string | null
          reserved_minutes: number
          consumed_minutes?: number
          finalized_at?: string | null
          created_at?: string
        },
        {
          id?: string
          session_id?: string
          workspace_id?: string
          requested_by_user_id?: string | null
          reserved_minutes?: number
          consumed_minutes?: number
          finalized_at?: string | null
          created_at?: string
        }
      >
      meeting_bot_provisioning_private: TableDefinition<
        {
          session_id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          encrypted_meeting_url: string
          encryption_iv: string
          encryption_auth_tag: string
          url_fingerprint: string
          status: string
          attempt_count: number
          max_attempts: number
          next_attempt_at: string | null
          locked_at: string | null
          locked_by: string | null
          expires_at: string
          last_http_status: number | null
          last_safe_error_code: string | null
          created_at: string
          updated_at: string
        },
        {
          session_id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          encrypted_meeting_url: string
          encryption_iv: string
          encryption_auth_tag: string
          url_fingerprint: string
          status?: string
          attempt_count?: number
          max_attempts?: number
          next_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          expires_at?: string
          last_http_status?: number | null
          last_safe_error_code?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          session_id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          call_id?: string
          encrypted_meeting_url?: string
          encryption_iv?: string
          encryption_auth_tag?: string
          url_fingerprint?: string
          status?: string
          attempt_count?: number
          max_attempts?: number
          next_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          expires_at?: string
          last_http_status?: number | null
          last_safe_error_code?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      meeting_bot_participants: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          session_id: string
          provider_participant_id: string
          display_name: string | null
          platform: string
          is_host: boolean
          joined_at: string | null
          left_at: string | null
          speech_started_at: string | null
          speech_ended_at: string | null
          last_spoke_at: string | null
          is_speaking: boolean
          call_speaker_id: string | null
          matched_contact_id: string | null
          party: string
          match_provenance: string
          match_confidence: number | null
          matched_at: string | null
          corrected_by_user_id: string | null
          correction_locked: boolean
          correction_prompted_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          session_id: string
          provider_participant_id: string
          display_name?: string | null
          platform: string
          is_host?: boolean
          joined_at?: string | null
          left_at?: string | null
          speech_started_at?: string | null
          speech_ended_at?: string | null
          last_spoke_at?: string | null
          is_speaking?: boolean
          call_speaker_id?: string | null
          matched_contact_id?: string | null
          party?: string
          match_provenance?: string
          match_confidence?: number | null
          matched_at?: string | null
          corrected_by_user_id?: string | null
          correction_locked?: boolean
          correction_prompted_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          call_id?: string
          session_id?: string
          provider_participant_id?: string
          display_name?: string | null
          platform?: string
          is_host?: boolean
          joined_at?: string | null
          left_at?: string | null
          speech_started_at?: string | null
          speech_ended_at?: string | null
          last_spoke_at?: string | null
          is_speaking?: boolean
          call_speaker_id?: string | null
          matched_contact_id?: string | null
          party?: string
          match_provenance?: string
          match_confidence?: number | null
          matched_at?: string | null
          corrected_by_user_id?: string | null
          correction_locked?: boolean
          correction_prompted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      meeting_bot_turn_buffers: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          session_id: string
          participant_id: string
          status: string
          utterances: Json
          buffered_text: string
          provider_event_ids: Json
          start_ms: number | null
          end_ms: number | null
          last_utterance_at: string | null
          speech_ended_at: string | null
          commit_after: string | null
          committed_at: string | null
          committed_transcript_segment_id: string | null
          processing_locked_at: string | null
          processing_locked_by: string | null
          version: number
          expires_at: string
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          call_id: string
          session_id: string
          participant_id: string
          status?: string
          utterances?: Json
          buffered_text?: string
          provider_event_ids?: Json
          start_ms?: number | null
          end_ms?: number | null
          last_utterance_at?: string | null
          speech_ended_at?: string | null
          commit_after?: string | null
          committed_at?: string | null
          committed_transcript_segment_id?: string | null
          processing_locked_at?: string | null
          processing_locked_by?: string | null
          version?: number
          expires_at?: string
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          call_id?: string
          session_id?: string
          participant_id?: string
          status?: string
          utterances?: Json
          buffered_text?: string
          provider_event_ids?: Json
          start_ms?: number | null
          end_ms?: number | null
          last_utterance_at?: string | null
          speech_ended_at?: string | null
          commit_after?: string | null
          committed_at?: string | null
          committed_transcript_segment_id?: string | null
          processing_locked_at?: string | null
          processing_locked_by?: string | null
          version?: number
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      >
      meeting_bot_webhook_events: TableDefinition<
        {
          id: string
          session_id: string | null
          region: string
          webhook_id: string
          event_type: string
          recall_bot_id: string | null
          event_timestamp: string | null
          payload_ciphertext: string | null
          payload_iv: string | null
          payload_auth_tag: string | null
          payload_hash: string
          status: string
          attempts: number
          max_attempts: number
          next_attempt_at: string | null
          locked_at: string | null
          locked_by: string | null
          processed_at: string | null
          expires_at: string
          last_safe_error_code: string | null
          received_at: string
          updated_at: string
        },
        {
          id?: string
          session_id?: string | null
          region: string
          webhook_id: string
          event_type: string
          recall_bot_id?: string | null
          event_timestamp?: string | null
          payload_ciphertext?: string | null
          payload_iv?: string | null
          payload_auth_tag?: string | null
          payload_hash: string
          status?: string
          attempts?: number
          max_attempts?: number
          next_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          processed_at?: string | null
          expires_at?: string
          last_safe_error_code?: string | null
          received_at?: string
          updated_at?: string
        },
        {
          id?: string
          session_id?: string | null
          region?: string
          webhook_id?: string
          event_type?: string
          recall_bot_id?: string | null
          event_timestamp?: string | null
          payload_ciphertext?: string | null
          payload_iv?: string | null
          payload_auth_tag?: string | null
          payload_hash?: string
          status?: string
          attempts?: number
          max_attempts?: number
          next_attempt_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          processed_at?: string | null
          expires_at?: string
          last_safe_error_code?: string | null
          received_at?: string
          updated_at?: string
        }
      >
      deepgram_token_grants: TableDefinition<
        {
          id: string
          workspace_id: string
          call_id: string
          user_id: string
          issued_at: string
        },
        {
          id?: string
          workspace_id: string
          call_id: string
          user_id: string
          issued_at?: string
        },
        {
          id?: string
          workspace_id?: string
          call_id?: string
          user_id?: string
          issued_at?: string
        }
      >
      recording_upload_reconciliations: TableDefinition<
        {
          cleanup_started_at: string | null
          id: string
          storage_path: string
          workspace_id: string
          call_id: string
          user_id: string
          created_at: string
          expires_at: string
        },
        {
          cleanup_started_at?: string | null
          id?: string
          storage_path: string
          workspace_id: string
          call_id: string
          user_id: string
          created_at?: string
          expires_at?: string
        },
        {
          cleanup_started_at?: string | null
          id?: string
          storage_path?: string
          workspace_id?: string
          call_id?: string
          user_id?: string
          created_at?: string
          expires_at?: string
        }
      >
      recording_upload_rollout_control: TableDefinition<
        {
          singleton_id: number
          enforce_after: string
          updated_at: string
        },
        {
          singleton_id?: number
          enforce_after?: string
          updated_at?: string
        },
        {
          singleton_id?: number
          enforce_after?: string
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
          capture_provider: string | null
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
          capture_provider?: string | null
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
          capture_provider?: string | null
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
          workspace_id: string
          account_id: string
          opportunity_id: string
          previous_call_id: string | null
          source_meeting_bot_session_id: string | null
          schema_version: number
          generated_at: string
          completed_context_fingerprint: string | null
          applied_next_step: string | null
          applied_next_step_by: string | null
          applied_next_step_at: string | null
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
          workspace_id: string
          account_id: string
          opportunity_id: string
          previous_call_id?: string | null
          source_meeting_bot_session_id?: string | null
          schema_version?: number
          generated_at?: string
          completed_context_fingerprint?: string | null
          applied_next_step?: string | null
          applied_next_step_by?: string | null
          applied_next_step_at?: string | null
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
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          previous_call_id?: string | null
          source_meeting_bot_session_id?: string | null
          schema_version?: number
          generated_at?: string
          completed_context_fingerprint?: string | null
          applied_next_step?: string | null
          applied_next_step_by?: string | null
          applied_next_step_at?: string | null
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
      next_call_brief_attempts: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          source_call_id: string
          brief_id: string | null
          requested_by_user_id: string | null
          client_request_id: string
          status: "queued" | "processing" | "completed" | "failed"
          attempt_count: number
          pending_context_fingerprint: string
          safe_error_code: string | null
          worker_locked_at: string | null
          worker_locked_by: string | null
          dispatch_locked_at: string | null
          dispatch_locked_by: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          source_call_id: string
          brief_id?: string | null
          requested_by_user_id?: string | null
          client_request_id: string
          status?: "queued" | "processing" | "completed" | "failed"
          attempt_count?: number
          pending_context_fingerprint: string
          safe_error_code?: string | null
          worker_locked_at?: string | null
          worker_locked_by?: string | null
          dispatch_locked_at?: string | null
          dispatch_locked_by?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          source_call_id?: string
          brief_id?: string | null
          requested_by_user_id?: string | null
          client_request_id?: string
          status?: "queued" | "processing" | "completed" | "failed"
          attempt_count?: number
          pending_context_fingerprint?: string
          safe_error_code?: string | null
          worker_locked_at?: string | null
          worker_locked_by?: string | null
          dispatch_locked_at?: string | null
          dispatch_locked_by?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      >
      next_call_brief_refresh_requests: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          requested_by_user_id: string
          client_request_id: string
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          requested_by_user_id: string
          client_request_id: string
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          requested_by_user_id?: string
          client_request_id?: string
          created_at?: string
        }
      >
      next_call_brief_items: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          brief_id: string
          kind: "opening" | "question" | "watch"
          position: number
          text: string
          intent_cluster_id: string | null
          related_playbook_field_id: string | null
          learning_target: string | null
          why_it_matters: string | null
          suggested_response: string | null
          basis: "transcript" | "methodology_gap" | "seller_context" | "inference"
          needs_confirmation: boolean
          created_at: string
          updated_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          brief_id: string
          kind: "opening" | "question" | "watch"
          position: number
          text: string
          intent_cluster_id?: string | null
          related_playbook_field_id?: string | null
          learning_target?: string | null
          why_it_matters?: string | null
          suggested_response?: string | null
          basis: "transcript" | "methodology_gap" | "seller_context" | "inference"
          needs_confirmation?: boolean
          created_at?: string
          updated_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          brief_id?: string
          kind?: "opening" | "question" | "watch"
          position?: number
          text?: string
          intent_cluster_id?: string | null
          related_playbook_field_id?: string | null
          learning_target?: string | null
          why_it_matters?: string | null
          suggested_response?: string | null
          basis?: "transcript" | "methodology_gap" | "seller_context" | "inference"
          needs_confirmation?: boolean
          created_at?: string
          updated_at?: string
        }
      >
      next_call_brief_item_sources: TableDefinition<
        {
          id: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          brief_id: string
          item_id: string
          position: number
          source_kind: "transcript_segment" | "call_note" | "opportunity_field_evidence"
          source_call_id: string | null
          transcript_segment_id: string | null
          call_note_id: string | null
          opportunity_field_evidence_id: string | null
          created_at: string
        },
        {
          id?: string
          workspace_id: string
          account_id: string
          opportunity_id: string
          brief_id: string
          item_id: string
          position: number
          source_kind: "transcript_segment" | "call_note" | "opportunity_field_evidence"
          source_call_id?: string | null
          transcript_segment_id?: string | null
          call_note_id?: string | null
          opportunity_field_evidence_id?: string | null
          created_at?: string
        },
        {
          id?: string
          workspace_id?: string
          account_id?: string
          opportunity_id?: string
          brief_id?: string
          item_id?: string
          position?: number
          source_kind?: "transcript_segment" | "call_note" | "opportunity_field_evidence"
          source_call_id?: string | null
          transcript_segment_id?: string | null
          call_note_id?: string | null
          opportunity_field_evidence_id?: string | null
          created_at?: string
        }
      >
      post_call_outputs: TableDefinition<
        {
          id: string
          call_id: string
          source_meeting_bot_session_id: string | null
          generation_result: Json | null
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
          source_meeting_bot_session_id?: string | null
          generation_result?: Json | null
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
          source_meeting_bot_session_id?: string | null
          generation_result?: Json | null
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
          server_authorized_at: string | null
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
          server_authorized_at?: string | null
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
          server_authorized_at?: string | null
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
      create_meeting_bot_session: {
        Args: {
          target_call_id: string
          target_user_id: string
          target_client_request_id: string
          target_client_instance_id: string
          target_platform: string
          target_region: string
          target_url_ciphertext: string
          target_url_iv: string
          target_url_auth_tag: string
          target_url_fingerprint: string
          target_user_limit?: number
          target_workspace_limit?: number
          target_global_limit?: number
          target_rate_window_minutes?: number
          target_user_rolling_creation_limit?: number
          target_workspace_rolling_creation_limit?: number
          target_user_daily_bot_limit?: number
          target_workspace_daily_bot_limit?: number
          target_user_daily_minute_limit?: number
          target_workspace_daily_minute_limit?: number
          target_reserved_bot_minutes?: number
        }
        Returns: Database["public"]["Tables"]["meeting_bot_sessions"]["Row"][]
      }
      reconnect_meeting_bot_session: {
        Args: {
          target_session_id: string
          target_user_id: string
          target_client_instance_id: string
        }
        Returns: Database["public"]["Tables"]["meeting_bot_sessions"]["Row"][]
      }
      transition_meeting_bot_call_to_browser_capture: {
        Args: {
          target_call_id: string
          target_session_id: string
          target_capture_method: string
        }
        Returns: Database["public"]["Tables"]["calls"]["Row"][]
      }
      claim_due_meeting_bot_provisioning: {
        Args: {
          worker_id: string
          batch_limit?: number
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["meeting_bot_provisioning_private"]["Row"][]
      }
      claim_due_meeting_bot_turn_buffers: {
        Args: {
          worker_id: string
          batch_limit?: number
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["meeting_bot_turn_buffers"]["Row"][]
      }
      claim_due_meeting_bot_recovery: {
        Args: {
          worker_id: string
          batch_limit?: number
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["meeting_bot_sessions"]["Row"][]
      }
      claim_meeting_bot_post_call: {
        Args: {
          target_session_id: string
          worker_id: string
          lease_seconds?: number
          force_retry?: boolean
        }
        Returns: Database["public"]["Tables"]["meeting_bot_sessions"]["Row"][]
      }
      claim_meeting_bot_webhook_event: {
        Args: {
          target_region: string
          target_webhook_id: string
          worker_id: string
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["meeting_bot_webhook_events"]["Row"][]
      }
      correct_meeting_bot_participant_attribution: {
        Args: {
          target_session_id: string
          target_participant_id: string
          target_user_id: string
          target_contact_id: string | null
          target_party: string
        }
        Returns: Database["public"]["Tables"]["meeting_bot_participants"]["Row"][]
      }
      expire_meeting_bot_private_data: {
        Args: { batch_limit?: number }
        Returns: {
          provisioning_deleted: number
          webhook_scrubbed: number
          turn_buffers_scrubbed: number
        }[]
      }
      claim_deepgram_token_grant: {
        Args: {
          target_user_id: string
          target_workspace_id: string
          target_call_id: string
          grant_limit?: number
          window_seconds?: number
        }
        Returns: boolean
      }
      claim_assistant_voice_token_grant: {
        Args: {
          target_user_id: string
          target_workspace_id: string
          grant_limit?: number
          window_seconds?: number
        }
        Returns: boolean
      }
      ensure_assistant_default_thread: {
        Args: {
          target_workspace_id: string
          target_user_id: string
        }
        Returns: Json
      }
      begin_assistant_run: {
        Args: {
          target_thread_id: string
          target_user_id: string
          target_client_request_id: string
          target_model: string
          target_content: string
          target_title: string
        }
        Returns: Json
      }
      complete_assistant_run: {
        Args: {
          target_run_id: string
          target_user_id: string
          target_content: string
          target_input_tokens: number | null
          target_output_tokens: number | null
          target_tool_rounds: number
          target_read_operations: number
          target_references?: Json
        }
        Returns: Json
      }
      fail_assistant_run: {
        Args: {
          target_run_id: string
          target_user_id: string
          target_safe_error_code: string
          target_tool_rounds: number
          target_read_operations: number
        }
        Returns: boolean
      }
      renew_assistant_run_lease: {
        Args: {
          target_run_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      create_assistant_action_proposal: {
        Args: {
          target_run_id: string
          target_user_id: string
          target_capability_id: string
          target_arguments: Json
          target_preview: Json
          target_expected_record_updated_at: string | null
          target_resource_type: string | null
          target_resource_id: string | null
          target_risk: string
          target_idempotency_key: string
          target_expires_at: string
        }
        Returns: Json
      }
      cancel_assistant_action_proposal: {
        Args: {
          target_proposal_id: string
          target_user_id: string
        }
        Returns: Json
      }
      delete_assistant_thread: {
        Args: {
          target_thread_id: string
          target_user_id: string
        }
        Returns: boolean
      }
      recover_stale_assistant_state: {
        Args: { batch_limit?: number }
        Returns: Json
      }
      execute_assistant_action_proposal: {
        Args: {
          target_proposal_id: string
          target_user_id: string
        }
        Returns: Json
      }
      register_call_recording_upload: {
        Args: {
          target_workspace_id: string
          target_call_id: string
          target_storage_path: string
        }
        Returns: boolean
      }
      has_active_recording_upload_registration: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_recording_upload_registration_enforced: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      claim_expired_recording_upload_reconciliations: {
        Args: {
          batch_limit?: number
          stale_claim_seconds?: number
        }
        Returns: {
          id: string
          workspace_id: string
          call_id: string
          storage_path: string
          cleanup_started_at: string
        }[]
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
      claim_next_call_brief_generation: {
        Args: {
          target_opportunity_id: string
          target_user_id: string
          target_client_request_id: string
          target_context_fingerprint: string
        }
        Returns: Database["public"]["Tables"]["next_call_brief_attempts"]["Row"][]
      }
      claim_next_call_brief_refresh_request: {
        Args: {
          target_opportunity_id: string
          target_user_id: string
          target_client_request_id: string
        }
        Returns: boolean
      }
      resolve_next_call_source_call: {
        Args: { target_opportunity_id: string }
        Returns: Database["public"]["Tables"]["calls"]["Row"][]
      }
      claim_next_call_brief_attempt: {
        Args: {
          target_attempt_id: string
          worker_id: string
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["next_call_brief_attempts"]["Row"][]
      }
      claim_due_next_call_brief_dispatches: {
        Args: {
          worker_id: string
          batch_limit?: number
          lease_seconds?: number
        }
        Returns: Database["public"]["Tables"]["next_call_brief_attempts"]["Row"][]
      }
      complete_next_call_brief_generation: {
        Args: {
          target_attempt_id: string
          target_worker_id: string
          target_outcome: string
          target_leave_with: string
          target_items: Json
        }
        Returns: Database["public"]["Tables"]["next_call_briefs"]["Row"][]
      }
      fail_next_call_brief_generation: {
        Args: {
          target_attempt_id: string
          target_worker_id: string
          target_safe_error_code: string
        }
        Returns: undefined
      }
      release_next_call_brief_generation: {
        Args: { target_attempt_id: string; target_worker_id: string }
        Returns: boolean
      }
      apply_next_call_brief_step: {
        Args: {
          target_brief_id: string
          target_user_id: string
          target_next_step: string
          expected_opportunity_updated_at: string
        }
        Returns: Database["public"]["Tables"]["opportunities"]["Row"][]
      }
      refresh_next_call_brief_fingerprint: {
        Args: {
          target_brief_id: string
          target_context_fingerprint: string
          expected_opportunity_updated_at: string
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
