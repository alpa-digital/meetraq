// hooks/useSubscription.js - Versión mejorada
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

export const useSubscription = () => {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cargar suscripción del usuario
  const loadSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Loading subscription for user:', user.id)
      
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle() // Usar maybeSingle() en lugar de single()

      if (error) {
        console.error('❌ Error loading subscription:', error)
        throw error
      }

      console.log('📋 Subscription data:', data)
      setSubscription(data) // data puede ser null, que está bien
      
    } catch (err) {
      console.error('💥 Error in loadSubscription:', err)
      setError(err.message)
      // En caso de error, asumir que no hay suscripción
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSubscription()
  }, [loadSubscription])

  // Verificar si el usuario tiene acceso premium
  const hasProAccess = useCallback(() => {
    if (!subscription) return false
    
    if (subscription.plan_type === 'pro' && subscription.status === 'active') {
      return true
    }
    
    if (subscription.plan_type === 'free_trial' && subscription.trial_ends_at) {
      return new Date() < new Date(subscription.trial_ends_at)
    }
    
    return false
  }, [subscription])

  // Verificar si está en trial
  const isInTrial = useCallback(() => {
    if (!subscription) return false
    return subscription.plan_type === 'free_trial' && 
           subscription.trial_ends_at && 
           new Date() < new Date(subscription.trial_ends_at)
  }, [subscription])

  // Días restantes de trial
  const trialDaysLeft = useCallback(() => {
    if (!subscription || subscription.plan_type !== 'free_trial') return 0
    
    const now = new Date()
    const trialEnd = new Date(subscription.trial_ends_at)
    const diffTime = trialEnd - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return Math.max(0, diffDays)
  }, [subscription])

  // Verificar si el trial ha expirado
  const isTrialExpired = useCallback(() => {
    if (!subscription || subscription.plan_type !== 'free_trial') return false
    return new Date() >= new Date(subscription.trial_ends_at)
  }, [subscription])

  // Iniciar trial gratuito
  const startFreeTrial = async () => {
    if (!user) {
      return { success: false, error: 'Usuario no autenticado' }
    }

    if (subscription) {
      return { success: false, error: 'Ya tienes una suscripción activa' }
    }

    try {
      setLoading(true)
      setError(null)
      
      const trialEndDate = new Date()
      trialEndDate.setDate(trialEndDate.getDate() + 7)

      const { data, error } = await supabase
        .from('subscriptions')
        .insert([
          {
            user_id: user.id,
            plan_type: 'free_trial',
            status: 'active',
            trial_ends_at: trialEndDate.toISOString(),
            current_period_start: new Date().toISOString(),
            current_period_end: trialEndDate.toISOString()
          }
        ])
        .select()
        .single()

      if (error) throw error

      setSubscription(data)
      return { success: true, data }
      
    } catch (err) {
      console.error('Error starting free trial:', err)
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  // Crear checkout de Stripe para PRO
  const createProCheckout = async () => {
    if (!user) {
      throw new Error('Usuario no autenticado')
    }

    try {
      setLoading(true)
      
      const stripe = await stripePromise
      if (!stripe) throw new Error('Stripe no disponible')

      // Llamar a la Edge Function para crear checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
          successUrl: `${window.location.origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`
        }
      })

      if (error) throw error

      // Redirigir a Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: data.id,
      })

      if (result.error) {
        throw new Error(result.error.message)
      }

    } catch (err) {
      console.error('Error creating checkout:', err)
      setError(err.message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Refrescar suscripción
  const refreshSubscription = () => {
    loadSubscription()
  }

  return {
    subscription,
    loading,
    error,
    hasProAccess: hasProAccess(),
    isInTrial: isInTrial(),
    trialDaysLeft: trialDaysLeft(),
    isTrialExpired: isTrialExpired(),
    startFreeTrial,
    createProCheckout,
    refreshSubscription
  }
}