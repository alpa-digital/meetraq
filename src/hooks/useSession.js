import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export const useSession = () => {
  const { user } = useAuth()
  const [currentSession, setCurrentSession] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [error, setError] = useState(null)
  
  const sessionDataRef = useRef({
    participantData: [],
    alerts: [],
    startTime: null
  })

  const startSession = async (sessionName = 'Untitled Session') => {
    if (!user) {
      setError('User not authenticated')
      return null
    }

    try {
      setError(null)
      
      // Usar un UUID temporal si Supabase no está disponible
      const sessionData = {
        id: `temp_${Date.now()}`,
        user_id: user.id,
        name: sessionName,
        start_time: new Date().toISOString(),
        total_participants: 0,
        avg_engagement: 0
      }

      // Intentar insertar en Supabase, pero continuar si falla
      try {
        const { data, error: insertError } = await supabase
          .from('analysis_sessions')
          .insert([sessionData])
          .select()
          .single()

        if (insertError) {
          console.warn('Supabase insert failed, using local session:', insertError)
          // Continuar con sesión local
        } else {
          sessionData.id = data.id
          console.log('✅ Session created in Supabase:', data.id)
        }
      } catch (supabaseError) {
        console.warn('Supabase not available, using local session:', supabaseError)
        // Continuar con sesión local
      }

      setCurrentSession(sessionData)
      setIsRecording(true)
      sessionDataRef.current = {
        participantData: [],
        alerts: [],
        startTime: Date.now()
      }

      console.log('✅ Session started:', sessionData.id)
      return sessionData
    } catch (err) {
      console.error('❌ Error starting session:', err)
      setError(err.message)
      return null
    }
  }

  const endSession = async () => {
    if (!currentSession) {
      setError('No active session')
      return null
    }

    try {
      setError(null)
      
      const endTime = new Date().toISOString()
      const durationSeconds = Math.floor((Date.now() - sessionDataRef.current.startTime) / 1000)
      
      // Calcular métricas finales
      const participantData = sessionDataRef.current.participantData
      const avgEngagement = participantData.length > 0
        ? participantData.reduce((sum, p) => sum + (p.engagement_score || 0), 0) / participantData.length
        : 0

      const maxEngagement = participantData.length > 0
        ? Math.max(...participantData.map(p => p.engagement_score || 0))
        : 0

      const minEngagement = participantData.length > 0
        ? Math.min(...participantData.map(p => p.engagement_score || 0))
        : 0

      const totalParticipants = new Set(participantData.map(p => p.participant_index)).size

      const { data, error: updateError } = await supabase
        .from('analysis_sessions')
        .update({
          end_time: endTime,
          duration_seconds: durationSeconds,
          total_participants: totalParticipants,
          avg_engagement: avgEngagement,
          max_engagement: maxEngagement,
          min_engagement: minEngagement,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentSession.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      setCurrentSession(null)
      setIsRecording(false)
      sessionDataRef.current = {
        participantData: [],
        alerts: [],
        startTime: null
      }

      console.log('✅ Session ended:', data.id)
      return data
    } catch (err) {
      console.error('❌ Error ending session:', err)
      setError(err.message)
      return null
    }
  }

  const saveParticipantData = async (participantAnalysis) => {
    if (!currentSession || !isRecording) {
      return false
    }

    try {
      const participantDataBatch = participantAnalysis.map((participant, index) => ({
        session_id: currentSession.id,
        participant_index: index,
        timestamp: new Date().toISOString(),
        engagement_score: participant.analysis?.metrics?.engagement || 0,
        attention_score: participant.analysis?.metrics?.attention || 0,
        happiness_score: participant.analysis?.metrics?.happiness || 0,
        fatigue_score: participant.analysis?.metrics?.fatigue || 0,
        estimated_age: participant.analysis?.age,
        estimated_gender: participant.analysis?.gender,
        gender_confidence: participant.analysis?.genderConfidence,
        expressions: participant.analysis?.expressions || {},
        face_box: participant.box ? {
          x: participant.box.x,
          y: participant.box.y,
          width: participant.box.width,
          height: participant.box.height
        } : null
      }))

      // Guardar en cache local siempre
      sessionDataRef.current.participantData.push(...participantDataBatch)

      // Intentar guardar en Supabase si está disponible
      try {
        const { error: insertError } = await supabase
          .from('participant_data')
          .insert(participantDataBatch)

        if (insertError) {
          console.warn('Failed to save to Supabase, data cached locally:', insertError)
        }
      } catch (supabaseError) {
        console.warn('Supabase not available, data cached locally:', supabaseError)
      }

      return true
    } catch (err) {
      console.error('Error in saveParticipantData:', err)
      return false
    }
  }

  const saveAlert = async (alertData) => {
    if (!currentSession || !isRecording) {
      return false
    }

    try {
      const alertRecord = {
        session_id: currentSession.id,
        alert_type: alertData.type === 'warning' ? 'low_engagement' : 'high_fatigue',
        message: alertData.message,
        severity: alertData.type === 'alert' ? 'alert' : 'warning',
        participant_index: alertData.participantIndex,
        trigger_value: alertData.triggerValue,
        threshold_value: alertData.threshold,
        created_at: new Date().toISOString()
      }

      // Guardar en cache local siempre
      sessionDataRef.current.alerts.push(alertRecord)

      // Intentar guardar en Supabase si está disponible
      try {
        const { error: insertError } = await supabase
          .from('system_alerts')
          .insert([alertRecord])

        if (insertError) {
          console.warn('Failed to save alert to Supabase, cached locally:', insertError)
        }
      } catch (supabaseError) {
        console.warn('Supabase not available, alert cached locally:', supabaseError)
      }

      return true
    } catch (err) {
      console.error('Error in saveAlert:', err)
      return false
    }
  }

  const getUserSessions = async (limit = 10) => {
    if (!user) return { data: [], error: 'User not authenticated' }

    try {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .select(`
          *,
          system_alerts(count)
        `)
        .eq('user_id', user.id)
        .order('start_time', { ascending: false })
        .limit(limit)

      return { data: data || [], error }
    } catch (err) {
      return { data: [], error: err.message }
    }
  }

  const getSessionDetails = async (sessionId) => {
    if (!user) return { data: null, error: 'User not authenticated' }

    try {
      const { data: session, error: sessionError } = await supabase
        .from('analysis_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single()

      if (sessionError) {
        return { data: null, error: sessionError.message }
      }

      // Obtener datos de participantes
      const { data: participantData, error: participantError } = await supabase
        .from('participant_data')
        .select('*')
        .eq('session_id', sessionId)
        .order('timestamp', { ascending: true })

      // Obtener alertas
      const { data: alerts, error: alertsError } = await supabase
        .from('system_alerts')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      return {
        data: {
          session,
          participantData: participantData || [],
          alerts: alerts || []
        },
        error: participantError || alertsError
      }
    } catch (err) {
      return { data: null, error: err.message }
    }
  }

  return {
    currentSession,
    isRecording,
    error,
    startSession,
    endSession,
    saveParticipantData,
    saveAlert,
    getUserSessions,
    getSessionDetails,
    sessionData: sessionDataRef.current
  }
}