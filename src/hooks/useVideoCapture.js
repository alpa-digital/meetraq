import { useState, useRef, useEffect } from 'react'

export const useVideoCapture = () => {
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [streamType, setStreamType] = useState('') // 'screen' or 'camera'
  
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [])

  const startScreenShare = async () => {
    try {
      setError(null)
      console.log('📺 useVideoCapture: Starting screen share...')
      
      // Detener stream anterior si existe
      if (streamRef.current) {
        stopStream()
      }

      // Solicitar captura de pantalla/ventana
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true // Incluir audio para meetings
      })
      
      console.log('📺 useVideoCapture: Stream obtained, assigning to video element...')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Forzar reproducción
        try {
          await videoRef.current.play()
          console.log('▶️ useVideoCapture: Video playing successfully')
        } catch (playError) {
          console.warn('⚠️ useVideoCapture: Play failed:', playError)
          // Continuar de todas formas, puede reproducirse automáticamente
        }
      } else {
        console.warn('⚠️ useVideoCapture: videoRef.current is null')
      }
      
      streamRef.current = stream
      setIsStreaming(true)
      setStreamType('screen')
      
      // Detectar cuando el usuario para el screen share
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('🛑 useVideoCapture: Screen share ended by user')
        stopStream()
      })
      
      console.log('✅ useVideoCapture: Screen sharing started successfully')
      
      // Log información del stream
      const videoTrack = stream.getVideoTracks()[0]
      if (videoTrack) {
        const settings = videoTrack.getSettings()
        console.log('📊 useVideoCapture: Video track settings:', settings)
      }
      
      return stream
    } catch (err) {
      console.error('❌ useVideoCapture: Error starting screen share:', err)
      setError('Could not start screen sharing. Please allow screen capture permissions.')
      setIsStreaming(false)
      throw err
    }
  }

  const startCameraStream = async () => {
    try {
      setError(null)
      console.log('📷 useVideoCapture: Starting camera stream...')
      
      // Detener stream anterior si existe
      if (streamRef.current) {
        stopStream()
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      console.log('📷 useVideoCapture: Camera stream obtained, assigning to video element...')
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        try {
          await videoRef.current.play()
          console.log('▶️ useVideoCapture: Camera video playing successfully')
        } catch (playError) {
          console.warn('⚠️ useVideoCapture: Camera play failed:', playError)
        }
      }
      
      streamRef.current = stream
      setIsStreaming(true)
      setStreamType('camera')
      
      console.log('✅ useVideoCapture: Camera stream started successfully')
      return stream
    } catch (err) {
      console.error('❌ useVideoCapture: Error starting camera stream:', err)
      setError('Could not start camera. Please check permissions.')
      setIsStreaming(false)
      throw err
    }
  }

  const stopStream = () => {
    console.log('🛑 useVideoCapture: Stopping stream...')
    
    if (streamRef.current) {
      // Detener todas las pistas del stream
      streamRef.current.getTracks().forEach(track => {
        track.stop()
        console.log(`🛑 useVideoCapture: Stopped track: ${track.kind}`)
      })
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
      console.log('🧹 useVideoCapture: Cleared video srcObject')
    }

    setIsStreaming(false)
    setStreamType('')
    setError(null)
    
    console.log('✅ useVideoCapture: Stream stopped successfully')
  }

  // Función para obtener información del stream actual
  const getStreamInfo = () => {
    if (!streamRef.current) return null
    
    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (!videoTrack) return null
    
    return {
      settings: videoTrack.getSettings(),
      capabilities: videoTrack.getCapabilities(),
      readyState: videoRef.current?.readyState || 0,
      dimensions: {
        width: videoRef.current?.videoWidth || 0,
        height: videoRef.current?.videoHeight || 0
      }
    }
  }

  // Debug function
  const debugVideoState = () => {
    console.log('🔧 useVideoCapture Debug Info:')
    console.log('  - isStreaming:', isStreaming)
    console.log('  - streamType:', streamType)
    console.log('  - error:', error)
    console.log('  - videoRef.current:', !!videoRef.current)
    console.log('  - streamRef.current:', !!streamRef.current)
    
    if (videoRef.current) {
      console.log('  - video readyState:', videoRef.current.readyState)
      console.log('  - video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight)
      console.log('  - video srcObject:', !!videoRef.current.srcObject)
    }
    
    if (streamRef.current) {
      console.log('  - stream tracks:', streamRef.current.getTracks().length)
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        console.log('  - video track state:', videoTrack.readyState)
        console.log('  - video track settings:', videoTrack.getSettings())
      }
    }
  }

  return {
    // Estado
    isStreaming,
    error,
    streamType,
    
    // Referencias
    videoRef,
    
    // Funciones
    startScreenShare,
    startCameraStream,
    stopStream,
    
    // Utilidades
    getStreamInfo,
    debugVideoState
  }
}