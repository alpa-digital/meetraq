import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, getCurrentUser, getProfile } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión inicial
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email)
        
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await getProfile(userId)
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error)
        return
      }
      
      if (data) {
        setProfile(data)
      } else {
        // Crear perfil si no existe
        await createProfile(userId)
      }
    } catch (error) {
      console.error('Error in loadProfile:', error)
    }
  }

  const createProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email: user?.email,
            subscription_status: 'free',
            settings: {
              alerts_enabled: true,
              auto_save: true,
              alert_threshold: 0.3
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Error creating profile:', error)
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error in createProfile:', error)
    }
  }

  const signIn = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign in error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signUp = async (email, password) => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) {
        throw error
      }

      return { data, error: null }
    } catch (error) {
      console.error('Sign up error:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }

      setUser(null)
      setProfile(null)
      return { error: null }
    } catch (error) {
      console.error('Sign out error:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: 'No user logged in' }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ 
          ...updates, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setProfile(data)
      }

      return { data, error: null }
    } catch (error) {
      console.error('Update profile error:', error)
      return { data: null, error }
    }
  }

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        throw error
      }

      return { error: null }
    } catch (error) {
      console.error('Reset password error:', error)
      return { error }
    }
  }

  const updatePassword = async (password) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password
      })

      if (error) {
        throw error
      }

      return { error: null }
    } catch (error) {
      console.error('Update password error:', error)
      return { error }
    }
  }

  const upgradeToPro = async () => {
    if (!user) return { error: 'No user logged in' }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'pro',
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 año
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setProfile(data)
      }

      return { data, error: null }
    } catch (error) {
      console.error('Upgrade to Pro error:', error)
      return { data: null, error }
    }
  }

  const cancelSubscription = async () => {
    if (!user) return { error: 'No user logged in' }
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'free',
          subscription_end_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setProfile(data)
      }

      return { data, error: null }
    } catch (error) {
      console.error('Cancel subscription error:', error)
      return { data: null, error }
    }
  }

  const updateSettings = async (newSettings) => {
    if (!user || !profile) return { error: 'No user or profile loaded' }
    
    try {
      const updatedSettings = {
        ...profile.settings,
        ...newSettings
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          settings: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (data) {
        setProfile(data)
      }

      return { data, error: null }
    } catch (error) {
      console.error('Update settings error:', error)
      return { data: null, error }
    }
  }

  const checkSubscriptionStatus = () => {
    if (!profile) return { isActive: false, isPro: false, daysLeft: 0 }

    const isPro = profile.subscription_status === 'pro'
    const endDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null
    const now = new Date()
    
    if (!isPro || !endDate) {
      return { isActive: false, isPro: false, daysLeft: 0 }
    }

    const isActive = endDate > now
    const daysLeft = Math.max(0, Math.ceil((endDate - now) / (1000 * 60 * 60 * 24)))

    return { isActive, isPro: true, daysLeft }
  }

  const getSubscriptionLimits = () => {
    const subscriptionStatus = checkSubscriptionStatus()
    
    if (subscriptionStatus.isPro && subscriptionStatus.isActive) {
      return {
        maxSessionDuration: null, // Sin límite
        maxParticipants: null, // Sin límite
        maxSessionsPerMonth: null, // Sin límite
        dataRetentionDays: 365,
        canExportData: true,
        hasPrioritySupport: true
      }
    }

    // Límites del plan gratuito
    return {
      maxSessionDuration: 1800, // 30 minutos
      maxParticipants: 5,
      maxSessionsPerMonth: 10,
      dataRetentionDays: 7,
      canExportData: false,
      hasPrioritySupport: false
    }
  }

  const value = {
    // Estados
    user,
    profile,
    loading,
    
    // Métodos de autenticación
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    
    // Métodos de perfil
    updateProfile,
    
    // Métodos de suscripción
    upgradeToPro,
    cancelSubscription,
    checkSubscriptionStatus,
    getSubscriptionLimits,
    
    // Configuraciones
    updateSettings,
    
    // Helpers
    isAuthenticated: !!user,
    isPro: profile?.subscription_status === 'pro',
    settings: profile?.settings || {}
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}