import React, { useState, useEffect } from 'react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

const Pricing = () => {
  const { user } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [debug, setDebug] = useState('Iniciando...')

  useEffect(() => {
    console.log('🔧 Pricing component mounted')
    loadPlans()
    if (user) {
      loadUserProfile()
    }
  }, [user])

  // Función helper para parsear features de forma segura
  const parseFeatures = (plan) => {
    let features = []
    
    try {
      // Si features es un string, intentar parsearlo como JSON
      if (typeof plan.features === 'string') {
        features = JSON.parse(plan.features)
      } 
      // Si features ya es un array, usarlo directamente
      else if (Array.isArray(plan.features)) {
        features = plan.features
      }
      
      // Verificar que es un array válido
      if (!Array.isArray(features) || features.length === 0) {
        throw new Error('Invalid features array')
      }
      
      return features
      
    } catch (error) {
      console.warn(`Error parsing features for plan ${plan.name}:`, error)
      
      // Fallback features basado en el tipo de plan
      return plan.slug === 'pro' 
        ? [
            'Sesiones ilimitadas', 
            'Participantes ilimitados', 
            'Analíticas avanzadas',
            'Exportar reportes',
            'Soporte prioritario'
          ]
        : [
            'Hasta 3 sesiones por mes',
            'Máximo 5 participantes', 
            'Analíticas básicas'
          ]
    }
  }

  const loadPlans = async () => {
    try {
      setDebug('Cargando planes...')
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')

      if (error) throw error
      
      console.log('📋 Planes cargados:', data)
      setPlans(data)
      setDebug('Planes cargados correctamente')
    } catch (error) {
      console.error('❌ Error loading plans:', error)
      setDebug('Error cargando planes: ' + error.message)
      
      // Planes por defecto si hay error
      setPlans([
        {
          id: 'free-default',
          name: 'Free',
          slug: 'free',
          description: 'Plan básico gratuito',
          price_monthly: 0,
          features: ["Hasta 3 sesiones por mes", "Máximo 5 participantes", "Analíticas básicas"],
          limits: {"sessions_per_month": 3, "max_participants": 5},
          sort_order: 1
        },
        {
          id: 'pro-default',
          name: 'Pro',
          slug: 'pro',
          description: 'Plan profesional con todas las funciones',
          price_monthly: 29.99,
          features: ["Sesiones ilimitadas", "Participantes ilimitados", "Analíticas avanzadas", "Exportar reportes", "Soporte prioritario"],
          limits: {"sessions_per_month": -1, "max_participants": -1},
          stripe_price_id_monthly: import.meta.env.VITE_STRIPE_PRO_PRICE_ID,
          sort_order: 2
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const loadUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_end_date, stripe_customer_id')
        .eq('id', user.id)
        .single()

      if (error) throw error
      
      console.log('👤 Perfil de usuario:', data)
      setUserProfile(data)
    } catch (error) {
      console.error('❌ Error loading user profile:', error)
      setUserProfile({ subscription_status: 'free' })
    }
  }

  const handleUpgrade = async (plan) => {
    if (!user) {
      alert('🔐 Debes iniciar sesión para suscribirte')
      return
    }
  
    if (plan.slug === 'free') {
      alert('ℹ️ Ya estás en el plan gratuito')
      return
    }
  
    const priceId = plan.stripe_price_id_monthly || import.meta.env.VITE_STRIPE_PRO_PRICE_ID
    
    if (!priceId) {
      alert('❌ Error: Price ID de Stripe no configurado para este plan')
      console.error('Price ID no encontrado para plan:', plan)
      return
    }
  
    setProcessingPlan(plan.slug)
    console.log('🚀 Iniciando checkout para plan:', plan.name)
    console.log('💰 Price ID:', priceId)
  
    try {
      const stripe = await stripePromise
  
      if (!stripe) {
        throw new Error('Stripe no se pudo cargar')
      }
  
      console.log('💳 Stripe cargado, verificando sesión...')
  
      // PASO 1: Verificar que tenemos una sesión activa
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        console.error('❌ Error de sesión:', sessionError)
        throw new Error('Sesión expirada. Por favor, cierra sesión e inicia sesión nuevamente.')
      }
  
      console.log('✅ Sesión verificada, llamando a Edge Function...')
  
      // PASO 2: Llamar a la Edge Function con el token correcto
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId: priceId,
          successUrl: `${window.location.origin}/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/pricing?subscription=canceled`
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
  
      console.log('📡 Response from Edge Function:', { data, error })
  
      if (error) {
        console.error('❌ Error from Edge Function:', error)
        
        // Manejo específico de errores
        if (error.message?.includes('Missing authorization header')) {
          throw new Error('Error de autenticación. Cierra sesión e inicia sesión nuevamente.')
        } else if (error.message?.includes('Unauthorized')) {
          throw new Error('Sesión expirada. Inicia sesión nuevamente.')
        } else if (error.message?.includes('non-2xx status code')) {
          // Si hay un error 400, vamos a hacer una llamada de prueba
          console.log('🔍 Haciendo llamada de diagnóstico...')
          
          try {
            const testResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                priceId: priceId,
                successUrl: `${window.location.origin}/dashboard?subscription=success`,
                cancelUrl: `${window.location.origin}/pricing?subscription=canceled`
              })
            })
            
            const testData = await testResponse.json()
            console.log('🔍 Test response:', testData)
            
            if (testResponse.ok && testData.id) {
              // Si la llamada directa funciona, usar esos datos
              const result = await stripe.redirectToCheckout({
                sessionId: testData.id,
              })
              
              if (result.error) {
                throw new Error(result.error.message)
              }
              return // Salir aquí si funciona
            }
          } catch (testError) {
            console.error('🔍 Test call failed:', testError)
          }
          
          throw new Error('Servicio de pagos temporalmente no disponible. Intenta en unos minutos.')
        } else {
          throw new Error(error.message || 'Error desconocido al procesar el pago')
        }
      }
  
      if (!data || !data.id) {
        console.error('❌ Invalid response data:', data)
        throw new Error('No se pudo crear la sesión de checkout')
      }
  
      console.log('✅ Checkout session creada:', data.id)
  
      // PASO 3: Redirigir a Stripe Checkout
      const result = await stripe.redirectToCheckout({
        sessionId: data.id,
      })
  
      if (result.error) {
        console.error('❌ Error redirigiendo a Stripe:', result.error)
        throw new Error(result.error.message)
      }
  
    } catch (error) {
      console.error('❌ Error completo en handleUpgrade:', error)
      
      let userMessage = 'Error al procesar el pago'
      
      if (error.message.includes('Sesión expirada') || error.message.includes('autenticación')) {
        userMessage = '🔐 Tu sesión ha expirado.\n\n1. Cierra sesión\n2. Inicia sesión nuevamente\n3. Intenta el pago otra vez'
      } else if (error.message.includes('temporalmente no disponible')) {
        userMessage = '⚠️ Servicio de pagos temporalmente no disponible.\nIntenta nuevamente en unos minutos.'
      } else if (error.message.includes('Stripe no se pudo cargar')) {
        userMessage = '💳 Error al cargar Stripe.\nVerifica tu conexión a internet.'
      } else {
        userMessage = `❌ ${error.message}`
      }
      
      alert(userMessage)
    } finally {
      setProcessingPlan(null)
    }
  }

  const getPlanStatus = (plan) => {
    if (!userProfile) return 'available'
    
    if (userProfile.subscription_status === plan.slug) {
      return 'current'
    }
    
    if (plan.slug === 'free') {
      return userProfile.subscription_status === 'free' ? 'current' : 'downgrade'
    }
    
    return 'upgrade'
  }

  const getButtonText = (plan) => {
    if (processingPlan === plan.slug) {
      return 'Procesando...'
    }
    
    const status = getPlanStatus(plan)
    
    switch (status) {
      case 'current':
        return 'Plan Actual'
      case 'upgrade':
        return 'Actualizar'
      case 'downgrade':
        return 'Cambiar Plan'
      default:
        return plan.slug === 'free' ? 'Gratis' : 'Comenzar'
    }
  }

  const getButtonStyle = (plan) => {
    if (processingPlan === plan.slug) {
      return 'bg-gray-400 text-white cursor-wait'
    }
    
    const status = getPlanStatus(plan)
    
    if (status === 'current') {
      return 'bg-gray-300 text-gray-500 cursor-not-allowed'
    }
    
    if (plan.slug === 'pro') {
      return 'bg-blue-600 text-white hover:bg-blue-700 transition-colors'
    }
    
    return 'bg-gray-600 text-white hover:bg-gray-700 transition-colors'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando planes de suscripción...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white py-24">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header de debug (solo en desarrollo) */}
        {import.meta.env.DEV && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">🔧 Debug Info</h2>
            <p className="text-blue-700">{debug}</p>
            <div className="mt-2 text-sm text-blue-600">
              <p>Usuario: {user ? `✅ ${user.email}` : '❌ No autenticado'}</p>
              <p>Stripe Key: {import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ? '✅ Configurada' : '❌ Falta'}</p>
              <p>Price ID: {import.meta.env.VITE_STRIPE_PRO_PRICE_ID ? '✅ Configurado' : '❌ Falta'}</p>
              <p>Plan actual: {userProfile?.subscription_status || 'free'}</p>
            </div>
          </div>
        )}

        {/* Título principal */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Planes de Meetraq
          </h1>
          <p className="text-xl text-gray-600">
            Mejora tus reuniones con analíticas avanzadas de engagement
          </p>
        </div>

        {/* Planes */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl p-8 ring-1 xl:p-10 ${
                plan.slug === 'pro'
                  ? 'ring-2 ring-blue-600 bg-blue-50'
                  : 'ring-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-x-4">
                <h3 className="text-2xl font-bold text-gray-900">
                  {plan.name}
                </h3>
                {plan.slug === 'pro' && (
                  <span className="rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-600">
                    Más Popular
                  </span>
                )}
              </div>
              
              <p className="mt-4 text-sm leading-6 text-gray-600">
                {plan.description}
              </p>
              
              <p className="mt-6 flex items-baseline gap-x-1">
                <span className="text-4xl font-bold tracking-tight text-gray-900">
                  ${plan.price_monthly}
                </span>
                <span className="text-sm font-semibold leading-6 text-gray-600">
                  /mes
                </span>
              </p>

              <button
                onClick={() => handleUpgrade(plan)}
                disabled={getPlanStatus(plan) === 'current' || processingPlan === plan.slug}
                className={`mt-8 block w-full rounded-md px-3 py-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${getButtonStyle(plan)}`}
              >
                {getButtonText(plan)}
              </button>

              {/* Features con parsing mejorado */}
              <ul className="mt-8 space-y-3 text-sm leading-6 text-gray-600">
                {parseFeatures(plan).map((feature, index) => (
                  <li key={index} className="flex gap-x-3">
                    <CheckIcon className="h-6 w-5 flex-none text-blue-600" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Mostrar límites si existen */}
              {plan.limits && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Límites:</h4>
                  <ul className="space-y-1 text-xs text-gray-600">
                    {(() => {
                      try {
                        const limits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
                        return (
                          <>
                            {limits.sessions_per_month === -1 ? (
                              <li>• Sesiones ilimitadas</li>
                            ) : (
                              <li>• {limits.sessions_per_month} sesiones por mes</li>
                            )}
                            {limits.max_participants === -1 ? (
                              <li>• Participantes ilimitados</li>
                            ) : (
                              <li>• Máximo {limits.max_participants} participantes</li>
                            )}
                          </>
                        )
                      } catch {
                        return <li>• Límites del plan {plan.name}</li>
                      }
                    })()}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Información adicional */}
        <div className="text-center mt-16">
          <p className="text-gray-600 mb-2">
            🔒 Pago seguro procesado por Stripe
          </p>
          <p className="text-gray-600 mb-2">
            ✨ Todos los planes incluyen soporte técnico y actualizaciones gratuitas
          </p>
          <p className="text-sm text-gray-500">
            📞 Puedes cancelar tu suscripción en cualquier momento
          </p>
        </div>

        {/* Mensaje de estado de suscripción */}
        {user && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-green-100 text-green-800">
              {userProfile?.subscription_status === 'pro' ? (
                <>🎉 ¡Tienes acceso PRO activo!</>
              ) : (
                <>🆓 Actualmente en plan gratuito</>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Pricing