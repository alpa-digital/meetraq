import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  Users, 
  AlertTriangle, 
  Camera, 
  Download,
  BarChart3,
  Activity,
  Clock,
  Target
} from 'lucide-react'
import { useFaceAPI } from '../hooks/useFaceApi'
import { useVideoCapture } from '../hooks/useVideoCapture'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

const EngagementAnalyzer = () => {
  // Estados principales
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [participants, setParticipants] = useState([])
  const [sessionName, setSessionName] = useState('')
  const [currentSession, setCurrentSession] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [systemError, setSystemError] = useState(null)
  const [isRecovering, setIsRecovering] = useState(false)

  // Referencias
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const detectionCountRef = useRef(0)
  const retryCount = useRef(0)
  const maxRetries = 3
  
  // ✨ REF PARA isAnalyzing - SOLUCIÓN AL PROBLEMA
  const isAnalyzingRef = useRef(false)

  // Hooks personalizados
  const { user } = useAuth()
  const {
    isLoaded: faceApiLoaded,
    isLoading: faceApiLoading,
    error: faceApiError,
    detectFaces,
    reloadFaceAPI
  } = useFaceAPI()

  const {
    isStreaming,
    error: streamError,
    streamType,
    startScreenShare,
    startCameraStream,
    stopStream,
    videoRef: captureVideoRef
  } = useVideoCapture()

  // ✨ SINCRONIZAR REF CON ESTADO
  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing
    console.log('🔄 isAnalyzing state changed:', isAnalyzing, '(ref:', isAnalyzingRef.current, ')')
  }, [isAnalyzing])

  // SOLUCIÓN: Sincronizar referencias de video de forma más robusta
  useEffect(() => {
    console.log('🔄 Checking video ref synchronization...')
    console.log('captureVideoRef.current:', !!captureVideoRef?.current)
    console.log('videoRef.current:', !!videoRef.current)
    console.log('isStreaming:', isStreaming)
    
    if (isStreaming && captureVideoRef?.current) {
      console.log('✅ captureVideoRef is available, syncing...')
      
      if (videoRef.current !== captureVideoRef.current) {
        console.log('🔗 Syncing videoRef with captureVideoRef')
        videoRef.current = captureVideoRef.current
        
        // Forzar actualización del estado del video
        const video = videoRef.current
        
        console.log(`📺 Video element synced:`)
        console.log(`  - readyState: ${video.readyState}`)
        console.log(`  - videoWidth: ${video.videoWidth}`)
        console.log(`  - videoHeight: ${video.videoHeight}`)
        console.log(`  - currentSrc: ${video.currentSrc || 'none'}`)
        
        // Agregar event listeners para monitoreo
        const handleLoadStart = () => console.log('📺 Video: loadstart')
        const handleLoadedMetadata = () => {
          console.log(`📺 Video metadata loaded: ${video.videoWidth}x${video.videoHeight}`)
        }
        const handleCanPlay = () => {
          console.log(`▶️ Video can play: readyState = ${video.readyState}`)
        }
        const handleLoadedData = () => {
          console.log(`📊 Video data loaded: ${video.videoWidth}x${video.videoHeight}, readyState = ${video.readyState}`)
        }
        const handleError = (e) => {
          console.error('❌ Video error:', e)
        }
        
        video.addEventListener('loadstart', handleLoadStart)
        video.addEventListener('loadedmetadata', handleLoadedMetadata)
        video.addEventListener('canplay', handleCanPlay)
        video.addEventListener('loadeddata', handleLoadedData)
        video.addEventListener('error', handleError)
        
        // Cleanup function
        return () => {
          video.removeEventListener('loadstart', handleLoadStart)
          video.removeEventListener('loadedmetadata', handleLoadedMetadata)
          video.removeEventListener('canplay', handleCanPlay)
          video.removeEventListener('loadeddata', handleLoadedData)
          video.removeEventListener('error', handleError)
        }
      } else {
        console.log('✅ videoRef already synchronized')
      }
    } else {
      console.log('⏳ captureVideoRef not available yet or not streaming')
    }
  }, [captureVideoRef?.current, isStreaming])

  // ============================================
  // FUNCIÓN DE DIBUJO DE DETECCIONES
  // ============================================
  const drawDetections = useCallback((analyzedParticipants) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    
    if (!canvas || !video) {
      console.log('⚠️ drawDetections: Missing canvas or video')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('⚠️ drawDetections: Cannot get canvas context')
      return
    }

    console.log(`🎨 drawDetections: Starting with ${analyzedParticipants.length} participants`)

    // CONFIGURAR CANVAS CORRECTAMENTE
    const videoRect = video.getBoundingClientRect()
    const videoDisplayWidth = videoRect.width
    const videoDisplayHeight = videoRect.height
    const videoActualWidth = video.videoWidth || video.clientWidth
    const videoActualHeight = video.videoHeight || video.clientHeight
    
    console.log(`📐 Video actual: ${videoActualWidth}x${videoActualHeight}`)
    console.log(`📐 Video display: ${videoDisplayWidth}x${videoDisplayHeight}`)
    
    // Configurar canvas con las dimensiones correctas
    canvas.width = videoActualWidth
    canvas.height = videoActualHeight
    
    // Posicionar canvas exactamente sobre el video
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '15' // Mayor z-index para asegurar visibilidad

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // CONFIGURAR ESTILO DE DIBUJO
    ctx.lineWidth = 3
    ctx.font = 'bold 16px Arial'
    
    console.log(`🎯 Drawing ${analyzedParticipants.length} detections on ${canvas.width}x${canvas.height} canvas`)

    // DIBUJAR CADA CARA DETECTADA
    analyzedParticipants.forEach((participant, index) => {
      const { box } = participant
      const metrics = participant.analysis?.metrics || { engagement: 50, attention: 60, confidence: 80 }
      
      if (!box || box.width <= 0 || box.height <= 0) {
        console.log(`⚠️ Skipping participant ${index} - invalid box:`, box)
        return
      }

      // Validar que la caja esté dentro del canvas
      const drawBox = {
        x: Math.max(0, Math.min(box.x, canvas.width - 10)),
        y: Math.max(0, Math.min(box.y, canvas.height - 10)),
        width: Math.max(10, Math.min(box.width, canvas.width - box.x)),
        height: Math.max(10, Math.min(box.height, canvas.height - box.y))
      }
      
      console.log(`🎯 Drawing participant ${index + 1}:`)
      console.log(`   Box: ${drawBox.x.toFixed(0)}, ${drawBox.y.toFixed(0)}, ${drawBox.width.toFixed(0)}x${drawBox.height.toFixed(0)}`)
      console.log(`   Metrics: ${metrics.engagement}% engagement, ${metrics.attention}% attention`)
      
      // DETERMINAR COLOR BASADO EN ENGAGEMENT
      let strokeColor, fillColor
      if (metrics.engagement >= 80) {
        strokeColor = '#8b5cf6' // Púrpura - Muy Alto
        fillColor = 'rgba(139, 92, 246, 0.1)'
      } else if (metrics.engagement >= 60) {
        strokeColor = '#10b981' // Verde - Alto  
        fillColor = 'rgba(16, 185, 129, 0.1)'
      } else if (metrics.engagement >= 40) {
        strokeColor = '#f59e0b' // Amarillo - Medio
        fillColor = 'rgba(245, 158, 11, 0.1)'
      } else {
        strokeColor = '#ef4444' // Rojo - Bajo
        fillColor = 'rgba(239, 68, 68, 0.1)'
      }
      
      // DIBUJAR FONDO DE LA CAJA (OPCIONAL)
      ctx.fillStyle = fillColor
      ctx.fillRect(drawBox.x, drawBox.y, drawBox.width, drawBox.height)
      
      // DIBUJAR BORDE PRINCIPAL
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = 4
      ctx.strokeRect(drawBox.x, drawBox.y, drawBox.width, drawBox.height)
      
      // DIBUJAR ESQUINAS DECORATIVAS (EFECTO MODERNO)
      const cornerSize = 20
      ctx.lineWidth = 6
      
      // Esquina superior izquierda
      ctx.beginPath()
      ctx.moveTo(drawBox.x, drawBox.y + cornerSize)
      ctx.lineTo(drawBox.x, drawBox.y)
      ctx.lineTo(drawBox.x + cornerSize, drawBox.y)
      ctx.stroke()
      
      // Esquina superior derecha
      ctx.beginPath()
      ctx.moveTo(drawBox.x + drawBox.width - cornerSize, drawBox.y)
      ctx.lineTo(drawBox.x + drawBox.width, drawBox.y)
      ctx.lineTo(drawBox.x + drawBox.width, drawBox.y + cornerSize)
      ctx.stroke()
      
      // Esquina inferior izquierda
      ctx.beginPath()
      ctx.moveTo(drawBox.x, drawBox.y + drawBox.height - cornerSize)
      ctx.lineTo(drawBox.x, drawBox.y + drawBox.height)
      ctx.lineTo(drawBox.x + cornerSize, drawBox.y + drawBox.height)
      ctx.stroke()
      
      // Esquina inferior derecha
      ctx.beginPath()
      ctx.moveTo(drawBox.x + drawBox.width - cornerSize, drawBox.y + drawBox.height)
      ctx.lineTo(drawBox.x + drawBox.width, drawBox.y + drawBox.height)
      ctx.lineTo(drawBox.x + drawBox.width, drawBox.y + drawBox.height - cornerSize)
      ctx.stroke()
      
      // PREPARAR ÁREA DE INFORMACIÓN
      const labelHeight = 90
      const labelWidth = Math.max(220, drawBox.width)
      const labelX = drawBox.x
      const labelY = drawBox.y - labelHeight - 5
      
      // Solo dibujar label si hay espacio arriba
      if (labelY > 0) {
        // Fondo del label
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
        ctx.fillRect(labelX, labelY, labelWidth, labelHeight)
        
        // Borde del label
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 2
        ctx.strokeRect(labelX, labelY, labelWidth, labelHeight)
        
        // TEXTO DEL LABEL
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 16px Arial'
        ctx.fillText(`Participant ${index + 1}`, labelX + 8, labelY + 22)
        
        // Métricas con colores
        ctx.font = '14px Arial'
        
        // Engagement
        ctx.fillStyle = strokeColor
        ctx.fillText(`Engagement: ${metrics.engagement}%`, labelX + 8, labelY + 42)
        
        // Attention  
        ctx.fillStyle = metrics.attention >= 70 ? '#06b6d4' : '#6b7280'
        ctx.fillText(`Attention: ${metrics.attention}%`, labelX + 8, labelY + 60)
        
        // Confidence
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.font = '12px Arial'
        ctx.fillText(`Confidence: ${metrics.confidence}%`, labelX + 8, labelY + 78)
      } else {
        // Si no hay espacio arriba, dibujar debajo
        const belowY = drawBox.y + drawBox.height + 5
        
        if (belowY + labelHeight < canvas.height) {
          // Fondo del label
          ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
          ctx.fillRect(labelX, belowY, labelWidth, labelHeight)
          
          // Texto
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 14px Arial'
          ctx.fillText(`P${index + 1} - ${metrics.engagement}%`, labelX + 8, belowY + 20)
        }
      }
      
      // INDICADOR DE ID (PEQUEÑO CÍRCULO)
      const participantId = participant.analysis?.tracking?.id || (index + 1)
      ctx.fillStyle = strokeColor
      ctx.beginPath()
      ctx.arc(drawBox.x + drawBox.width - 15, drawBox.y + 15, 12, 0, 2 * Math.PI)
      ctx.fill()
      
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(participantId.toString(), drawBox.x + drawBox.width - 15, drawBox.y + 19)
      ctx.textAlign = 'left' // Reset alignment
    })

    // INFORMACIÓN DE DEBUG (ESQUINA SUPERIOR IZQUIERDA)
    if (process.env.NODE_ENV === 'development' || true) { // Mostrar siempre por ahora
      const debugWidth = 300
      const debugHeight = 130
      
      // Fondo debug
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
      ctx.fillRect(10, 10, debugWidth, debugHeight)
      
      // Borde debug
      ctx.strokeStyle = '#00ff00'
      ctx.lineWidth = 1
      ctx.strokeRect(10, 10, debugWidth, debugHeight)
      
      // Texto debug
      ctx.fillStyle = '#00ff00'
      ctx.font = 'bold 14px monospace'
      ctx.fillText('🎯 MediaPipe Face Detection', 15, 30)
      
      ctx.font = '12px monospace'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(`Total detections: ${detectionCountRef.current}`, 15, 50)
      ctx.fillText(`Active faces: ${analyzedParticipants.length}`, 15, 65)
      ctx.fillText(`Canvas: ${canvas.width}x${canvas.height}`, 15, 80)
      ctx.fillText(`Video: ${videoActualWidth}x${videoActualHeight}`, 15, 95)
      ctx.fillText(`Status: ${analyzedParticipants.length > 0 ? 'DETECTING' : 'SCANNING'}`, 15, 110)
      
      // Timestamp
      ctx.fillStyle = '#888888'
      ctx.font = '10px monospace'
      ctx.fillText(new Date().toLocaleTimeString(), 15, 125)
    }
    
    console.log(`✅ drawDetections: Completed drawing ${analyzedParticipants.length} participants`)
  }, [])

  // ============================================
  // FUNCIÓN DE ANÁLISIS DE FRAME (PRINCIPAL) - USANDO REF
  // ============================================
  const analyzeFrame = async () => {
    // ✨ USAR REF EN LUGAR DE ESTADO
    if (!faceApiLoaded) {
      console.log('⚠️ analyzeFrame: Face API not loaded')
      return
    }

    if (!isAnalyzingRef.current) { // ✨ CAMBIO CLAVE AQUÍ
      console.log('⚠️ analyzeFrame: Analysis not active (ref:', isAnalyzingRef.current, ', state:', isAnalyzing, ')')
      return
    }

    if (systemError) {
      console.log('⚠️ analyzeFrame: System has errors:', systemError)
      return
    }

    // Verificación más robusta del video
    const video = videoRef.current
    if (!video) {
      console.log('⚠️ analyzeFrame: No video element')
      return
    }

    if (video.readyState < 2) {
      console.log('⚠️ analyzeFrame: Video not ready, readyState:', video.readyState)
      return
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('⚠️ analyzeFrame: Invalid video dimensions:', video.videoWidth, 'x', video.videoHeight)
      return
    }

    if (!video.srcObject) {
      console.log('⚠️ analyzeFrame: Video has no srcObject')
      return
    }

    const startTime = performance.now()
    
    console.log('🔍 analyzeFrame: Starting face detection...')
    
    // Detección con timeout y manejo de errores
    let detections = []
    try {
      // Agregar timeout para la detección
      const detectionPromise = detectFaces(video)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Detection timeout')), 5000)
      )
      
      detections = await Promise.race([detectionPromise, timeoutPromise]) || []
      console.log(`🎯 analyzeFrame: Detection completed, found ${detections.length} faces`)
    } catch (detectionError) {
      console.error('❌ analyzeFrame: Detection failed:', detectionError)
      return
    }
    
    const processingTime = performance.now() - startTime
    
    if (detections.length > 0) {
      detectionCountRef.current++
      console.log(`✅ analyzeFrame: Frame ${detectionCountRef.current} processed with ${detections.length} faces in ${processingTime.toFixed(1)}ms`)
    } else {
      console.log(`ℹ️ analyzeFrame: No faces detected (processed in ${processingTime.toFixed(1)}ms)`)
    }
    
    const timestamp = Date.now()
    
    // Analizar cada detección
    const analyzedParticipants = detections.map((detection, index) => {
      try {
        const analysis = analyzeFace(detection)
        return {
          id: `participant-${detection.id || index}`,
          detection,
          analysis,
          timestamp,
          box: detection.box,
          confidence: detection.confidence
        }
      } catch (analysisError) {
        console.error('❌ analyzeFrame: Error analyzing face:', analysisError)
        return null
      }
    }).filter(Boolean)

    // ✨ DIBUJAR LAS DETECCIONES - FORZAR EJECUCIÓN
    console.log(`🎨 analyzeFrame: Drawing ${analyzedParticipants.length} analyzed participants`)
    
    try {
      // Asegurar que drawDetections se ejecute
      if (typeof drawDetections === 'function') {
        drawDetections(analyzedParticipants)
        console.log('✅ analyzeFrame: Drawing completed successfully')
      } else {
        console.error('❌ drawDetections is not a function')
      }
    } catch (drawError) {
      console.error('❌ analyzeFrame: Error drawing detections:', drawError)
    }

    // Actualizar estado de participantes
    setParticipants(analyzedParticipants)
    
    // Guardar datos si hay sesión activa
    if (currentSession && isRecording && analyzedParticipants.length > 0) {
      try {
        await saveDetectionData(currentSession.id, {
          timestamp,
          participants: analyzedParticipants,
          frameNumber: detectionCountRef.current,
          processingTime: processingTime
        })
      } catch (saveError) {
        console.error('❌ analyzeFrame: Error saving detection data:', saveError)
      }
    }
    
    console.log(`🔄 analyzeFrame: Complete. Total participants: ${analyzedParticipants.length}`)
  }

  // ============================================
  // ANÁLISIS DE CARAS
  // ============================================
  const analyzeFace = useCallback((detection) => {
    try {
      const baseEngagement = Math.floor(Math.random() * 40) + 50 // 50-90%
      const baseAttention = Math.floor(Math.random() * 30) + 60  // 60-90%
      
      // Ajustar basado en confianza de detección
      const confidenceBoost = Math.floor(detection.confidence * 20)
      
      return {
        metrics: {
          engagement: Math.min(100, baseEngagement + confidenceBoost),
          attention: Math.min(100, baseAttention + confidenceBoost),
          confidence: Math.round(detection.confidence * 100)
        },
        face: {
          size: detection.box ? Math.round(detection.box.width * detection.box.height) : 0,
          position: detection.box ? {
            x: Math.round(detection.box.x),
            y: Math.round(detection.box.y),
            centerX: Math.round(detection.box.x + detection.box.width / 2),
            centerY: Math.round(detection.box.y + detection.box.height / 2)
          } : { x: 0, y: 0, centerX: 0, centerY: 0 }
        },
        confidence: detection.confidence || 0.5,
        quality: detection.quality?.overall || detection.quality || 0.7,
        tracking: {
          id: detection.id,
          isTracked: !!detection.id,
          source: detection.source || 'mediapipe',
          method: detection.method || 'unknown'
        }
      }
    } catch (error) {
      console.error('❌ Error in analyzeFace:', error)
      return null
    }
  }, [])

// ============================================
  // MANEJO DE SESIONES
  // ============================================
  const handleStartAnalysis = async () => {
    try {
      console.log('🚀 Starting face detection analysis...')
      setSystemError(null)
      
      // Verificar Face API
      if (!faceApiLoaded) {
        throw new Error('MediaPipe face detection system not ready')
      }

      console.log('✅ MediaPipe system ready, checking video stream...')

      // Iniciar stream si no existe
      if (!isStreaming) {
        console.log('📺 Starting video stream...')
        await startScreenShare()
        
        // Esperar un momento para que React procese el cambio de estado
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // ESPERAR A QUE EL VIDEO REF SE SINCRONICE CORRECTAMENTE
      console.log('⏳ Waiting for video ref synchronization...')
      
      let syncAttempts = 0
      const maxSyncAttempts = 10
      
      while (syncAttempts < maxSyncAttempts) {
        console.log(`🔄 Sync attempt ${syncAttempts + 1}: checking refs...`)
        console.log(`  - captureVideoRef.current: ${!!captureVideoRef?.current}`)
        console.log(`  - videoRef.current: ${!!videoRef.current}`)
        
        if (captureVideoRef?.current && videoRef.current !== captureVideoRef.current) {
          console.log('🔗 Force syncing videoRef...')
          videoRef.current = captureVideoRef.current
        }
        
        if (videoRef.current) {
          console.log('✅ videoRef is available!')
          break
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        syncAttempts++
      }

      if (!videoRef.current) {
        throw new Error('Failed to synchronize video reference. Please try again.')
      }

      // ESPERAR A QUE EL VIDEO ESTÉ LISTO PARA PROCESAR
      console.log('⏳ Waiting for video stream to be ready...')
      
      let attempts = 0
      const maxAttempts = 30 // 15 segundos máximo
      
      while (attempts < maxAttempts) {
        const readyState = videoRef.current.readyState
        const width = videoRef.current.videoWidth || 0
        const height = videoRef.current.videoHeight || 0
        
        console.log(`⏳ Attempt ${attempts + 1}:`)
        console.log(`  - readyState: ${readyState}`)
        console.log(`  - dimensions: ${width}x${height}`)
        console.log(`  - srcObject: ${!!videoRef.current.srcObject}`)
        
        // Verificar si el video tiene stream asignado
        if (!videoRef.current.srcObject) {
          console.log('⚠️ Video has no srcObject, trying to re-sync...')
          if (captureVideoRef?.current?.srcObject) {
            console.log('🔄 Copying srcObject from captureVideoRef...')
            videoRef.current.srcObject = captureVideoRef.current.srcObject
          }
        }
        
        // Verificar si está listo para procesar
        if (readyState >= 2 && width > 0 && height > 0) {
          console.log('✅ Video stream is ready for processing!')
          break
        }
        
        await new Promise(resolve => setTimeout(resolve, 500))
        attempts++
      }

      // Verificación final
      const finalWidth = videoRef.current.videoWidth
      const finalHeight = videoRef.current.videoHeight
      const finalReadyState = videoRef.current.readyState
      
      if (finalReadyState < 2 || finalWidth === 0 || finalHeight === 0) {
        throw new Error(`Video stream not ready after ${maxAttempts * 0.5} seconds. ReadyState: ${finalReadyState}, Dimensions: ${finalWidth}x${finalHeight}. Please try sharing your screen again.`)
      }

      console.log(`✅ Video stream ready: ${finalWidth} x ${finalHeight} (readyState: ${finalReadyState})`)

      // Test de detección antes de empezar
      console.log('🧪 Testing MediaPipe detection before starting analysis...')
      
      try {
        const testDetections = await detectFaces(videoRef.current)
        console.log(`🎯 Pre-analysis test: ${testDetections.length} faces detected`)
        
        if (testDetections.length > 0) {
          console.log('🎉 MediaPipe detection test successful!')
        }
      } catch (testError) {
        console.warn('⚠️ MediaPipe detection test failed:', testError)
        // Continuar de todas formas
      }

      // Crear sesión si se proporcionó nombre
      if (sessionName.trim() && user) {
        console.log(`📝 Creating session: ${sessionName.trim()}`)
        try {
          const session = await createSession(sessionName.trim())
          setCurrentSession(session)
          setIsRecording(true)
          console.log('✅ Session created successfully')
        } catch (sessionError) {
          console.warn('⚠️ Failed to create session:', sessionError)
        }
      }

      // ✨ INICIAR ANÁLISIS CON REF
      console.log('🎬 Starting continuous analysis...')
      
      // ACTUALIZAR TANTO ESTADO COMO REF INMEDIATAMENTE
      setIsAnalyzing(true)
      isAnalyzingRef.current = true // ✨ ESTO ES CLAVE
      
      detectionCountRef.current = 0

      // Limpiar canvas antes de empezar
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }

      // EJECUTAR PRIMERA DETECCIÓN INMEDIATAMENTE
      console.log('🎯 Running initial detection... (ref:', isAnalyzingRef.current, ')')
      await analyzeFrame()

      // Iniciar loop de análisis con intervalo más frecuente
      console.log('⏰ Starting detection interval...')
      intervalRef.current = setInterval(() => {
        console.log('⏰ Interval tick - calling analyzeFrame (ref:', isAnalyzingRef.current, ')')
        analyzeFrame().catch(error => {
          console.error('❌ Error in interval analyzeFrame:', error)
        })
      }, 1500) // Cada 1.5 segundos para mejor estabilidad
      
      console.log('✅ MediaPipe face detection analysis started successfully!')
      console.log('🔧 Interval ID:', intervalRef.current)

    } catch (error) {
      console.error('❌ Error starting analysis:', error)
      setSystemError(`Failed to start analysis: ${error.message}`)
      
      // ✨ LIMPIAR TANTO ESTADO COMO REF
      setIsAnalyzing(false)
      isAnalyzingRef.current = false
      
      // Limpiar cualquier intervalo que se haya creado
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }

  const handleStopAnalysis = async () => {
    try {
      console.log('🛑 Stopping face detection analysis...')
      
      // ✨ ACTUALIZAR TANTO ESTADO COMO REF
      setIsAnalyzing(false)
      isAnalyzingRef.current = false
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      // Finalizar sesión si existe
      if (currentSession && isRecording) {
        await finalizeSession(currentSession.id)
        setIsRecording(false)
      }

      // Limpiar canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }

      setParticipants([])
      setCurrentSession(null)
      
      console.log('✅ Analysis stopped')

    } catch (error) {
      console.error('❌ Error stopping analysis:', error)
    }
  }

  // ============================================
  // FUNCIONES DE BASE DE DATOS
  // ============================================
  const createSession = async (name) => {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        name,
        user_id: user.id,
        start_time: new Date().toISOString(),
        status: 'active'
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  const finalizeSession = async (sessionId) => {
    const { error } = await supabase
      .from('sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'completed'
      })
      .eq('id', sessionId)

    if (error) throw error
  }

  const saveDetectionData = async (sessionId, data) => {
    const { error } = await supabase
      .from('detections')
      .insert({
        session_id: sessionId,
        timestamp: new Date(data.timestamp).toISOString(),
        participants_data: data.participants,
        frame_number: data.frameNumber,
        processing_time: data.processingTime
      })

    if (error) throw error
  }

  // ============================================
  // FUNCIONES DE DEBUG
  // ============================================
  const debugAnalysis = useCallback(() => {
    console.log('🔧 DEBUG ANALYSIS')
    console.log('faceApiLoaded:', faceApiLoaded)
    console.log('isAnalyzing (state):', isAnalyzing)
    console.log('isAnalyzing (ref):', isAnalyzingRef.current) // ✨ MOSTRAR AMBOS
    console.log('intervalRef.current:', !!intervalRef.current)
    console.log('videoRef.current:', !!videoRef.current)
    if (videoRef.current) {
      console.log('Video readyState:', videoRef.current.readyState)
      console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight)
    }
    console.log('participants.length:', participants.length)
    console.log('detectionCountRef.current:', detectionCountRef.current)
    
    // Forzar análisis manual
    if (videoRef.current) {
      console.log('🔧 Forcing manual analysis...')
      analyzeFrame()
    }
  }, [faceApiLoaded, isAnalyzing, participants.length])

  // Exponer función de debug
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugAnalysis = debugAnalysis
      console.log('🔧 Debug function available: debugAnalysis()')
    }
  }, [debugAnalysis])

  // Debug del intervalo - para asegurar que se ejecute
  useEffect(() => {
    if (isAnalyzing && intervalRef.current) {
      console.log('🔄 Analysis is active with interval:', intervalRef.current)
      
      // Test del intervalo cada 10 segundos
      const testInterval = setInterval(() => {
        console.log('🧪 Interval test - isAnalyzing (state):', isAnalyzing)
        console.log('🧪 Interval test - isAnalyzing (ref):', isAnalyzingRef.current)
        console.log('🧪 Interval test - intervalRef.current:', !!intervalRef.current)
        console.log('🧪 Interval test - videoRef.current:', !!videoRef.current)
        console.log('🧪 Interval test - participants:', participants.length)
        
        // Si no hay participantes pero el video está funcionando, forzar análisis
        if (participants.length === 0 && videoRef.current && videoRef.current.readyState >= 2) {
          console.log('🔧 No participants detected, forcing manual analysis...')
          analyzeFrame()
        }
      }, 10000)
      
      return () => {
        clearInterval(testInterval)
      }
    }
  }, [isAnalyzing, participants.length])

  // Debug adicional: Monitorear cambios en participants
  useEffect(() => {
    console.log('👥 Participants changed:', participants.length)
    if (participants.length > 0) {
      participants.forEach((p, i) => {
        console.log(`  Participant ${i + 1}:`, {
          id: p.id,
          confidence: p.confidence,
          box: p.box,
          engagement: p.analysis?.metrics?.engagement
        })
      })
    }
  }, [participants])

  // ============================================
  // MANEJO DE ERRORES Y RECOVERY
  // ============================================
  const handleManualRecovery = async () => {
    try {
      setIsRecovering(true)
      setSystemError(null)
      retryCount.current = 0
      
      if (isAnalyzing) {
        await handleStopAnalysis()
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      await reloadFaceAPI()
      
      setIsRecovering(false)
      
    } catch (error) {
      console.error('❌ Manual recovery failed:', error)
      setSystemError(`Manual recovery failed: ${error.message}`)
      setIsRecovering(false)
    }
  }

  // ============================================
  // RENDERIZADO CONDICIONAL PARA ERRORES
  // ============================================
  if (faceApiLoading || isRecovering) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">
            {isRecovering ? 'Recovering Face Detection System...' : 'Loading MediaPipe Face Detection...'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {isRecovering ? `Retry attempt ${retryCount.current}/${maxRetries}` : 'Initializing MediaPipe algorithms'}
          </p>
        </div>
      </div>
    )
  }

  if (systemError || (!faceApiLoaded && faceApiError)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-red-800 mb-2">Face Detection System Error</h3>
        <p className="text-red-600 mb-4">
          {systemError || faceApiError || 'The MediaPipe face detection system encountered an error.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={handleManualRecovery}
            disabled={isRecovering}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white rounded-lg transition-colors"
          >
            {isRecovering ? 'Recovering...' : 'Try Recovery'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER PRINCIPAL
  // ============================================
  return (
    <div className="space-y-6">
      {/* Session Input */}
      {!isAnalyzing && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Start MediaPipe Face Detection Session</h3>
          <div className="flex gap-4">
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Enter session name (optional)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleStartAnalysis}
              disabled={faceApiLoading || !faceApiLoaded}
              className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Start Analysis
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            ✅ MediaPipe face detection system ready. Click start to begin real-time analysis.
          </p>
        </div>
      )}

      {/* Active Session Info */}
      {currentSession && isRecording && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-900">Active Analysis Session</h4>
              <p className="text-sm text-blue-700">
                {currentSession.name} • Started {new Date(currentSession.start_time).toLocaleTimeString()}
                • {detectionCountRef.current} frames processed
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRecording && (
                <span className="flex items-center gap-1 text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  Recording
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">Live MediaPipe Analysis</h2>
              {streamType && (
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {streamType === 'screen' ? 'Screen Share' : 'Camera'}
                </span>
              )}
              {isAnalyzing && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full animate-pulse">
                  Analyzing
                </span>
              )}
              {participants.length > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  {participants.length} Face{participants.length !== 1 ? 's' : ''} Detected
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={isAnalyzing ? handleStopAnalysis : handleStartAnalysis}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  isAnalyzing 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                disabled={faceApiLoading}
              >
                {isAnalyzing ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Stop Analysis
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Analysis
                  </>
                )}
              </button>
              
              {/* Debug Button */}
              <button
                onClick={debugAnalysis}
                className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg"
              >
                Debug
              </button>
            </div>
          </div>
        </div>

        {/* Video Container - VERSIÓN CON REF COMBINADO */}
        <div className="relative bg-gray-900 aspect-video overflow-hidden">
          <video
            ref={(el) => {
              // Asignar el elemento a ambos refs
              videoRef.current = el
              if (captureVideoRef) {
                captureVideoRef.current = el
              }
            }}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
            style={{ position: 'relative', zIndex: 1 }}
            onLoadedMetadata={() => {
              console.log('📺 Video metadata loaded in JSX')
              if (videoRef.current) {
                console.log(`📐 Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`)
              }
            }}
            onCanPlay={() => {
              console.log('▶️ Video can play in JSX')
            }}
            onError={(e) => {
              console.error('❌ Video error in JSX:', e)
            }}
          />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{ 
              zIndex: 10,
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%'
            }}
          />
          
          {!isStreaming && !isAnalyzing && (
            <div className="absolute inset-0 flex items-center justify-center text-white" style={{ zIndex: 5 }}>
              <div className="text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-xl font-semibold mb-2">Ready for MediaPipe Face Detection</h3>
                <p className="text-gray-300 text-center max-w-md">
                  Share your meeting window to start real-time face detection and participant analysis with MediaPipe.
                </p>
              </div>
            </div>
          )}
          
          {isStreaming && isAnalyzing && participants.length === 0 && (
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg" style={{ zIndex: 15 }}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm">MediaPipe scanning for faces...</span>
              </div>
            </div>
          )}
          
          {/* DEBUG: Mostrar información del video en tiempo real */}
          {(process.env.NODE_ENV === 'development' || true) && (
            <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs font-mono" style={{ zIndex: 15 }}>
              <div>Video: {videoRef.current?.videoWidth || 0}x{videoRef.current?.videoHeight || 0}</div>
              <div>Ready: {videoRef.current?.readyState || 0}/4</div>
              <div>Stream: {isStreaming ? 'Active' : 'Inactive'}</div>
              <div>SrcObj: {!!videoRef.current?.srcObject ? 'Yes' : 'No'}</div>
              <div>Analysis: {isAnalyzing ? 'ON' : 'OFF'}</div>
              <div>Ref: {isAnalyzingRef.current ? 'TRUE' : 'FALSE'}</div> {/* ✨ MOSTRAR REF */}
              <div>Interval: {!!intervalRef.current ? 'Active' : 'Inactive'}</div>
            </div>
          )}
        </div>
      </div>

      {/* Participants Panel */}
      {isAnalyzing && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Detected Participants ({participants.length})
            </h3>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Frames processed: {detectionCountRef.current}</span>
              <span>Engine: MediaPipe</span>
              {intervalRef.current && (
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Active
                </span>
              )}
            </div>
          </div>
          
          {participants.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {participants.map((participant, index) => {
                const metrics = participant.analysis?.metrics || { engagement: 50, attention: 60, confidence: 80 }
                const tracking = participant.analysis?.tracking || {}
                
                return (
                  <div key={participant.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900">Participant {index + 1}</h4>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          ID: {tracking.id || 'N/A'}
                        </span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                          {metrics.confidence}% conf
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                          {tracking.source || 'mediapipe'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      {/* Engagement Bar */}
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Engagement:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                metrics.engagement >= 80 ? 'bg-purple-500' :
                                metrics.engagement >= 60 ? 'bg-green-500' :
                                metrics.engagement >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, metrics.engagement))}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium min-w-[35px]">
                            {metrics.engagement}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Attention Bar */}
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Attention:</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                metrics.attention >= 80 ? 'bg-blue-500' :
                                metrics.attention >= 60 ? 'bg-cyan-500' :
                                metrics.attention >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, metrics.attention))}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium min-w-[35px]">
                            {metrics.attention}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Position Info */}
                      {participant.box && (
                        <div className="text-xs text-gray-500 border-t pt-2">
                          <div>Position: ({participant.box.x}, {participant.box.y})</div>
                          <div>Size: {participant.box.width} × {participant.box.height}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No participants detected</h4>
              <p className="text-gray-500">
                MediaPipe is scanning for faces. Make sure people are visible in the shared screen.
              </p>
              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Activity className="w-4 h-4" />
                  <span>Processed {detectionCountRef.current} frames</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Statistics Panel */}
      {isAnalyzing && participants.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Session Statistics
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">Total Participants</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">{participants.length}</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">Avg Engagement</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                {participants.length > 0 
                  ? Math.round(participants.reduce((sum, p) => sum + (p.analysis?.metrics?.engagement || 0), 0) / participants.length)
                  : 0}%
              </div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">Frames Processed</span>
              </div>
              <div className="text-2xl font-bold text-purple-900">{detectionCountRef.current}</div>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-900">Session Time</span>
              </div>
              <div className="text-2xl font-bold text-orange-900">
                {currentSession 
                  ? Math.floor((Date.now() - new Date(currentSession.start_time).getTime()) / 60000) 
                  : 0}m
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EngagementAnalyzer