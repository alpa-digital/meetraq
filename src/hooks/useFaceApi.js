import { useState, useEffect, useRef } from 'react'
import MediaPipeFaceDetection from '../utils/MediaPipeFaceDetection'

export const useFaceAPI = () => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const faceDetectionRef = useRef(null)
  const initializationAttempts = useRef(0)
  const maxInitializationAttempts = 3

  useEffect(() => {
    initializeDetection()
    
    return () => {
      if (faceDetectionRef.current) {
        try {
          faceDetectionRef.current.cleanup()
        } catch (error) {
          console.error('❌ Error in cleanup:', error)
        }
        faceDetectionRef.current = null
      }
    }
  }, [])

  const initializeDetection = async () => {
    if (initializationAttempts.current >= maxInitializationAttempts) {
      setError('Failed to initialize MediaPipe after multiple attempts. Check your internet connection.')
      return
    }

    setIsLoading(true)
    setError(null)
    initializationAttempts.current++

    try {
      console.log(`🚀 Initializing MediaPipe Face Detection (attempt ${initializationAttempts.current})...`)
      
      // Crear nueva instancia del sistema MediaPipe
      faceDetectionRef.current = new MediaPipeFaceDetection()
      
      // Inicializar MediaPipe (esto carga los scripts y modelos)
      const result = await faceDetectionRef.current.initialize()
      
      if (result && result.isReady) {
        setIsLoaded(true)
        setError(null)
        console.log('✅ MediaPipe Face Detection System ready:', result.engine)
        
        // Test simple después de que MediaPipe esté listo
        setTimeout(() => {
          testDetectionSystem()
        }, 2000)
        
      } else {
        throw new Error('MediaPipe initialization returned invalid result')
      }
      
    } catch (error) {
      console.error(`❌ MediaPipe initialization attempt ${initializationAttempts.current} failed:`, error)
      
      let errorMessage = `MediaPipe Error (attempt ${initializationAttempts.current}): ${error.message}`
      
      // Mensajes de error específicos
      if (error.message.includes('Failed to load')) {
        errorMessage = 'Cannot load MediaPipe. Check your internet connection.'
      } else if (error.message.includes('FaceDetection')) {
        errorMessage = 'MediaPipe Face Detection not available. Browser may not support it.'
      }
      
      setError(errorMessage)
      setIsLoaded(false)
      
      // Retry after delay if not max attempts
      if (initializationAttempts.current < maxInitializationAttempts) {
        console.log(`🔄 Retrying MediaPipe initialization in 5 seconds... (${initializationAttempts.current}/${maxInitializationAttempts})`)
        setTimeout(() => {
          initializeDetection()
        }, 5000)
      } else {
        console.error('🚫 MediaPipe initialization failed after all attempts')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const reloadFaceAPI = async () => {
    console.log('🔄 Reloading MediaPipe Face Detection...')
    
    if (faceDetectionRef.current) {
      try {
        faceDetectionRef.current.cleanup()
      } catch (error) {
        console.error('❌ Error in cleanup during reload:', error)
      }
      faceDetectionRef.current = null
    }
    
    initializationAttempts.current = 0
    await initializeDetection()
  }

  const testDetectionSystem = async () => {
    if (!faceDetectionRef.current || !isLoaded) {
      console.log('⚠️ Cannot test - MediaPipe not ready')
      return
    }

    try {
      console.log('🧪 Testing MediaPipe detection system...')
      
      // Crear un canvas de prueba con un patrón que simule rostros
      const testCanvas = document.createElement('canvas')
      testCanvas.width = 640
      testCanvas.height = 480
      const testCtx = testCanvas.getContext('2d')
      
      // Fondo claro típico de videoconferencia
      testCtx.fillStyle = '#f5f5f5'
      testCtx.fillRect(0, 0, testCanvas.width, testCanvas.height)
      
      // Simular 2 rostros en posiciones típicas de meeting
      // Rostro 1 (izquierda)
      testCtx.fillStyle = '#deb887' // tono de piel
      testCtx.fillRect(120, 150, 100, 120)
      testCtx.fillStyle = '#333'
      testCtx.fillRect(135, 175, 8, 4) // ojo izq
      testCtx.fillRect(185, 175, 8, 4) // ojo der
      testCtx.fillRect(165, 195, 4, 8) // nariz
      testCtx.fillRect(150, 220, 20, 3) // boca
      
      // Rostro 2 (derecha)
      testCtx.fillStyle = '#d2b48c' // otro tono de piel
      testCtx.fillRect(420, 120, 120, 140)
      testCtx.fillStyle = '#222'
      testCtx.fillRect(440, 150, 10, 5) // ojo izq
      testCtx.fillRect(500, 150, 10, 5) // ojo der
      testCtx.fillRect(475, 175, 5, 10) // nariz
      testCtx.fillRect(460, 205, 25, 4) // boca
      
      const testImageData = testCtx.getImageData(0, 0, testCanvas.width, testCanvas.height)
      const testFrameData = {
        imageData: testImageData,
        width: testCanvas.width,
        height: testCanvas.height,
        originalWidth: testCanvas.width,
        originalHeight: testCanvas.height,
        timestamp: Date.now(),
        canvas: testCanvas
      }
      
      const testDetections = await faceDetectionRef.current.detectFaces(testFrameData)
      console.log('✅ MediaPipe detection system test completed:', testDetections?.length || 0, 'detections')
      
      if (testDetections && testDetections.length > 0) {
        console.log('🎯 Test detection details:', testDetections.map(d => ({
          confidence: d.confidence,
          size: `${d.box.width}x${d.box.height}`,
          method: d.method
        })))
      }
      
    } catch (testError) {
      console.warn('⚠️ MediaPipe detection system test failed:', testError)
    }
  }

  const detectFaces = async (videoElement) => {
    // Verificaciones básicas
    if (!isLoaded) {
      console.log('🚫 Detection skipped - MediaPipe not loaded')
      return []
    }
    
    if (!faceDetectionRef.current) {
      console.log('🚫 Detection skipped - no MediaPipe detection instance')
      return []
    }
    
    if (!videoElement) {
      console.log('🚫 Detection skipped - no video element')
      return []
    }

    if (videoElement.readyState !== 4) {
      console.log('⏳ Video not ready for detection, readyState:', videoElement.readyState)
      return []
    }

    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      console.log('⚠️ Video has invalid dimensions:', videoElement.videoWidth, 'x', videoElement.videoHeight)
      return []
    }

    try {
      console.log('🔍 Starting MediaPipe face detection...')

      // Extraer frame del video
      const frameData = faceDetectionRef.current.extractFrameData(videoElement)
      if (!frameData) {
        console.log('❌ Failed to extract frame data from video')
        return []
      }

      console.log(`📊 Frame extracted: ${frameData.width}x${frameData.height} (original: ${frameData.originalWidth}x${frameData.originalHeight})`)

      // Detectar caras con MediaPipe
      const detections = await faceDetectionRef.current.detectFaces(frameData)
      
      if (detections && detections.length > 0) {
        console.log(`🎯 MediaPipe detection successful: ${detections.length} faces found`)
        detections.forEach((face, i) => {
          console.log(`  Face ${i+1}: confidence=${face.confidence.toFixed(2)}, box=${face.box.x},${face.box.y} ${face.box.width}x${face.box.height}`)
        })
      } else {
        console.log('ℹ️ No faces detected in current frame')
      }

      return detections || []

    } catch (error) {
      console.error('❌ MediaPipe face detection error:', error)
      
      // Si hay error en la detección, intentar reinicializar
      if (error.message.includes('detection') && initializationAttempts.current < maxInitializationAttempts) {
        console.log('🔄 Detection error, attempting to reinitialize MediaPipe...')
        setTimeout(() => {
          reloadFaceAPI()
        }, 1000)
      }
      
      return []
    }
  }

  const getDetectionStats = () => {
    if (!faceDetectionRef.current) return null
    return faceDetectionRef.current.getStats()
  }

  const getCurrentDetections = () => {
    if (!faceDetectionRef.current) return []
    return faceDetectionRef.current.getLastDetections()
  }

  return {
    // Estado del sistema
    isLoaded: isLoaded,
    isLoading: isLoading,
    error: error,
    
    // Funciones principales
    detectFaces,
    reloadFaceAPI,
    
    // Utilidades
    getDetectionStats,
    getCurrentDetections,
    
    // Información del motor
    engineType: 'mediapipe',
    isReady: isLoaded && !error,
    
    // Debug
    testDetectionSystem: process.env.NODE_ENV === 'development' ? testDetectionSystem : null
  }
}