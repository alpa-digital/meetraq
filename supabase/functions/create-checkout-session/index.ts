import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

console.log('🚀 Edge Function starting...')

// Verificar variables de entorno al inicio
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
const supabaseUrl = Deno.env.get('SUPABASE_URL')  
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

console.log('🔧 Environment variables check:')
console.log('- STRIPE_SECRET_KEY:', stripeSecretKey ? `✅ Present (${stripeSecretKey.substring(0, 7)}...)` : '❌ Missing')
console.log('- SUPABASE_URL:', supabaseUrl ? '✅ Present' : '❌ Missing')
console.log('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Present' : '❌ Missing')

if (!stripeSecretKey) {
  console.error('❌ CRITICAL: STRIPE_SECRET_KEY is missing')
  throw new Error('STRIPE_SECRET_KEY environment variable is required')
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ CRITICAL: Supabase environment variables missing')
  throw new Error('Supabase environment variables are required')
}

// Inicializar Stripe
let stripe: Stripe
try {
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
  })
  console.log('✅ Stripe initialized successfully')
} catch (error) {
  console.error('❌ Failed to initialize Stripe:', error)
  throw error
}

// Inicializar Supabase
const supabase = createClient(supabaseUrl, supabaseServiceKey)
console.log('✅ Supabase initialized successfully')

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('📡 CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID().substring(0, 8)
  console.log(`🚀 [${requestId}] New request: ${req.method} ${req.url}`)

  try {
    // Verificar método
    if (req.method !== 'POST') {
      console.log(`❌ [${requestId}] Invalid method: ${req.method}`)
      throw new Error(`Method ${req.method} not allowed`)
    }

    // Verificar header de autorización
    const authHeader = req.headers.get('Authorization')
    console.log(`🔑 [${requestId}] Auth header present:`, !!authHeader)
    
    if (!authHeader) {
      console.error(`❌ [${requestId}] Missing Authorization header`)
      throw new Error('Missing authorization header')
    }

    // Obtener usuario
    const token = authHeader.replace('Bearer ', '')
    console.log(`🔑 [${requestId}] Token length:`, token.length)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError) {
      console.error(`❌ [${requestId}] Auth error:`, authError)
      throw new Error(`Authentication failed: ${authError.message}`)
    }

    if (!user) {
      console.error(`❌ [${requestId}] No user found`)
      throw new Error('User not found')
    }

    console.log(`✅ [${requestId}] User authenticated: ${user.id} (${user.email})`)

    // Parse request body
    let requestBody
    try {
      requestBody = await req.json()
      console.log(`📋 [${requestId}] Request body:`, requestBody)
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to parse JSON:`, error)
      throw new Error('Invalid JSON in request body')
    }

    const { priceId, successUrl, cancelUrl } = requestBody

    // Validar datos requeridos
    if (!priceId) {
      console.error(`❌ [${requestId}] Missing priceId`)
      throw new Error('priceId is required')
    }

    if (!successUrl || !cancelUrl) {
      console.error(`❌ [${requestId}] Missing URLs`)
      throw new Error('successUrl and cancelUrl are required')
    }

    console.log(`✅ [${requestId}] Request validation passed`)

    // Verificar que el priceId existe en Stripe
    let priceObject
    try {
      priceObject = await stripe.prices.retrieve(priceId)
      console.log(`✅ [${requestId}] Price verified in Stripe:`, priceObject.id)
    } catch (stripeError) {
      console.error(`❌ [${requestId}] Invalid price ID:`, stripeError)
      throw new Error(`Invalid price ID: ${priceId}`)
    }

    // Obtener o crear customer
    let customerId = null
    
    console.log(`👤 [${requestId}] Looking up user profile...`)
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error(`❌ [${requestId}] Profile error:`, profileError)
      throw new Error(`Failed to load user profile: ${profileError.message}`)
    }

    console.log(`👤 [${requestId}] Profile loaded:`, profile)

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id
      console.log(`✅ [${requestId}] Using existing customer: ${customerId}`)
    } else {
      console.log(`🆕 [${requestId}] Creating new Stripe customer...`)
      
      try {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            supabase_user_id: user.id,
          },
        })

        customerId = customer.id
        console.log(`✅ [${requestId}] New customer created: ${customerId}`)

        // Guardar customer ID
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id)

        if (updateError) {
          console.error(`⚠️ [${requestId}] Failed to save customer ID:`, updateError)
        } else {
          console.log(`✅ [${requestId}] Customer ID saved to profile`)
        }
      } catch (stripeError) {
        console.error(`❌ [${requestId}] Failed to create customer:`, stripeError)
        throw new Error(`Failed to create Stripe customer: ${stripeError.message}`)
      }
    }

    console.log(`💳 [${requestId}] Creating checkout session...`)

    // Crear checkout session
    let session
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: user.id,
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
      })

      console.log(`✅ [${requestId}] Checkout session created: ${session.id}`)
      
    } catch (stripeError) {
      console.error(`❌ [${requestId}] Failed to create checkout session:`, stripeError)
      throw new Error(`Failed to create checkout session: ${stripeError.message}`)
    }

    const response = {
      id: session.id,
      url: session.url
    }

    console.log(`✅ [${requestId}] Success! Returning session data`)

    return new Response(
      JSON.stringify(response),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 200,
      }
    )

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message)
    console.error(`❌ [${requestId}] Stack:`, error.stack)
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        requestId: requestId,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        },
        status: 400,
      }
    )
  }
})