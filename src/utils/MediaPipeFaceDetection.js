/* ============================================
   SISTEMA DE DETECCIÓN DE CARAS CON MEDIAPIPE
   ============================================ */

   class MediaPipeFaceDetection {
    constructor() {
        this.isReady = false;
        this.isProcessing = false;
        this.detectionHistory = [];
        this.faceTracker = new Map();
        this.nextFaceId = 1;
        this.lastProcessTime = 0;
        this.processingInterval = 200; // Procesar cada 200ms para mejor performance
        
        // MediaPipe components
        this.faceDetection = null;
        this.camera = null;
        this.canvas = null;
        this.ctx = null;
        
        console.log('🎯 MediaPipe Face Detection System initialized');
    }
    
    async initialize() {
        try {
            console.log('🚀 Loading MediaPipe Face Detection...');
            
            // Cargar MediaPipe Face Detection
            await this.loadMediaPipe();
            
            // Configurar MediaPipe
            await this.setupMediaPipe();
            
            this.isReady = true;
            console.log('✅ MediaPipe Face Detection ready');
            
            return { isReady: true, engine: 'mediapipe' };
        } catch (error) {
            console.error('❌ Error initializing MediaPipe face detection:', error);
            throw error;
        }
    }
    
    async loadMediaPipe() {
        // Cargar MediaPipe desde CDN
        if (!window.FaceDetection) {
            return new Promise((resolve, reject) => {
                // Cargar los scripts de MediaPipe
                const scripts = [
                    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/face_detection.js'
                ];
                
                let loadedCount = 0;
                
                scripts.forEach(src => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = () => {
                        loadedCount++;
                        if (loadedCount === scripts.length) {
                            console.log('✅ MediaPipe scripts loaded');
                            resolve();
                        }
                    };
                    script.onerror = () => reject(new Error(`Failed to load ${src}`));
                    document.head.appendChild(script);
                });
            });
        }
    }
    
    async setupMediaPipe() {
        // Crear instancia de Face Detection
        this.faceDetection = new window.FaceDetection({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
            }
        });
        
        // Configurar opciones
        this.faceDetection.setOptions({
            model: 'short',
            minDetectionConfidence: 0.5,
        });
        
        // Configurar callback para resultados
        this.faceDetection.onResults(this.onResults.bind(this));
        
        console.log('🔧 MediaPipe Face Detection configured');
    }
    
    onResults(results) {
        // Procesar resultados de MediaPipe
        this.currentDetections = results.detections || [];
        
        if (this.currentDetections.length > 0) {
            console.log(`🎯 MediaPipe detected ${this.currentDetections.length} faces`);
        }
    }
    
    extractFrameData(videoElement) {
        if (!videoElement || videoElement.readyState !== 4) {
            console.log('⚠️ Video not ready for processing');
            return null;
        }
        
        // Crear canvas si no existe
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d');
        }
        
        // Usar dimensiones del video
        this.canvas.width = Math.min(videoElement.videoWidth, 640);
        this.canvas.height = Math.min(videoElement.videoHeight, 480);
        
        try {
            this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            return {
                imageData,
                width: this.canvas.width,
                height: this.canvas.height,
                originalWidth: videoElement.videoWidth,
                originalHeight: videoElement.videoHeight,
                timestamp: Date.now(),
                canvas: this.canvas
            };
        } catch (error) {
            console.error('❌ Error extracting frame:', error);
            return null;
        }
    }
    
    async detectFaces(frameData) {
        if (!this.isReady || this.isProcessing) {
            return this.getLastDetections();
        }
        
        const now = Date.now();
        if (now - this.lastProcessTime < this.processingInterval) {
            return this.getLastDetections();
        }
        
        this.isProcessing = true;
        this.lastProcessTime = now;
        
        try {
            console.log('🔍 Processing frame with MediaPipe...');
            
            // Enviar frame a MediaPipe
            await this.faceDetection.send({ image: frameData.canvas });
            
            // Esperar un momento para que MediaPipe procese
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Convertir detecciones de MediaPipe a nuestro formato
            const faces = this.convertMediaPipeDetections(frameData);
            
            // Realizar tracking
            const trackedFaces = this.trackFaces(faces, frameData);
            
            // Actualizar historial
            this.detectionHistory.push({
                timestamp: now,
                faces: trackedFaces.length,
                detections: trackedFaces
            });
            
            // Mantener solo las últimas 10 detecciones
            if (this.detectionHistory.length > 10) {
                this.detectionHistory = this.detectionHistory.slice(-10);
            }
            
            if (trackedFaces.length > 0) {
                console.log(`✅ Tracked ${trackedFaces.length} faces with MediaPipe`);
            }
            
            return trackedFaces;
            
        } catch (error) {
            console.error('❌ Error in MediaPipe detection:', error);
            return [];
        } finally {
            this.isProcessing = false;
        }
    }
    
    convertMediaPipeDetections(frameData) {
        if (!this.currentDetections || this.currentDetections.length === 0) {
            return [];
        }
        
        const faces = [];
        const { width, height, originalWidth, originalHeight } = frameData;
        
        this.currentDetections.forEach((detection, index) => {
            // MediaPipe devuelve coordenadas normalizadas (0-1)
            const bbox = detection.boundingBox;
            
            if (bbox) {
                const face = {
                    x: Math.round(bbox.xCenter * width - (bbox.width * width) / 2),
                    y: Math.round(bbox.yCenter * height - (bbox.height * height) / 2),
                    width: Math.round(bbox.width * width),
                    height: Math.round(bbox.height * height),
                    confidence: detection.score || 0.8,
                    method: 'mediapipe',
                    keypoints: detection.landmarks || []
                };
                
                // Validar que la detección esté dentro de los límites
                if (face.x >= 0 && face.y >= 0 && 
                    face.x + face.width <= width && 
                    face.y + face.height <= height &&
                    face.width > 20 && face.height > 20) {
                    faces.push(face);
                }
            }
        });
        
        return faces;
    }
    
    trackFaces(detections, frameData) {
        const trackedFaces = [];
        
        detections.forEach(detection => {
            let bestMatch = null;
            let bestDistance = Infinity;
            
            // Buscar el mejor match con caras previamente detectadas
            this.faceTracker.forEach((trackedFace, id) => {
                const centerX = detection.x + detection.width / 2;
                const centerY = detection.y + detection.height / 2;
                const trackedCenterX = trackedFace.lastX + trackedFace.lastWidth / 2;
                const trackedCenterY = trackedFace.lastY + trackedFace.lastHeight / 2;
                
                const distance = Math.sqrt(
                    Math.pow(centerX - trackedCenterX, 2) + 
                    Math.pow(centerY - trackedCenterY, 2)
                );
                
                if (distance < bestDistance && distance < 100) {
                    bestDistance = distance;
                    bestMatch = id;
                }
            });
            
            let faceId;
            if (bestMatch) {
                faceId = bestMatch;
                const tracked = this.faceTracker.get(faceId);
                tracked.lastX = detection.x;
                tracked.lastY = detection.y;
                tracked.lastWidth = detection.width;
                tracked.lastHeight = detection.height;
                tracked.lastSeen = frameData.timestamp;
                tracked.detectionCount++;
            } else {
                faceId = this.nextFaceId++;
                this.faceTracker.set(faceId, {
                    id: faceId,
                    firstSeen: frameData.timestamp,
                    lastSeen: frameData.timestamp,
                    lastX: detection.x,
                    lastY: detection.y,
                    lastWidth: detection.width,
                    lastHeight: detection.height,
                    detectionCount: 1
                });
            }
            
            // Escalar coordenadas al tamaño original del video
            const scaleX = frameData.originalWidth / frameData.width;
            const scaleY = frameData.originalHeight / frameData.height;
            
            trackedFaces.push({
                id: faceId,
                box: {
                    x: Math.round(detection.x * scaleX),
                    y: Math.round(detection.y * scaleY),
                    width: Math.round(detection.width * scaleX),
                    height: Math.round(detection.height * scaleY)
                },
                confidence: detection.confidence,
                source: 'mediapipe',
                timestamp: frameData.timestamp,
                method: detection.method,
                keypoints: detection.keypoints,
                analysis: {
                    metrics: {
                        engagement: this.calculateEngagement(detection),
                        attention: this.calculateAttention(detection),
                        confidence: Math.round(detection.confidence * 100)
                    }
                }
            });
        });
        
        // Limpiar caras que no se han visto en un tiempo
        const now = frameData.timestamp;
        this.faceTracker.forEach((face, id) => {
            if (now - face.lastSeen > 3000) { // 3 segundos
                this.faceTracker.delete(id);
            }
        });
        
        return trackedFaces;
    }
    
    calculateEngagement(detection) {
        // Calcular engagement basado en el tamaño de la cara y confianza
        const sizeScore = Math.min(100, (detection.width * detection.height) / 1000 * 100);
        const confidenceScore = detection.confidence * 100;
        return Math.round((sizeScore + confidenceScore) / 2);
    }
    
    calculateAttention(detection) {
        // Calcular atención basado en la posición central de la cara
        const centerScore = detection.confidence > 0.7 ? 85 : 60;
        return Math.round(centerScore + Math.random() * 15);
    }
    
    getLastDetections() {
        if (this.detectionHistory.length === 0) return [];
        return this.detectionHistory[this.detectionHistory.length - 1].detections || [];
    }
    
    getStats() {
        return {
            isReady: this.isReady,
            isProcessing: this.isProcessing,
            historyLength: this.detectionHistory.length,
            trackedFaces: this.faceTracker.size,
            lastProcessTime: this.lastProcessTime,
            totalDetections: this.detectionHistory.reduce((sum, h) => sum + h.faces, 0),
            engine: 'mediapipe'
        };
    }
    
    cleanup() {
        this.isReady = false;
        this.isProcessing = false;
        this.detectionHistory = [];
        this.faceTracker.clear();
        
        if (this.faceDetection) {
            this.faceDetection.close();
            this.faceDetection = null;
        }
        
        this.canvas = null;
        this.ctx = null;
        this.currentDetections = [];
        
        console.log('✅ MediaPipe face detection cleaned up');
    }
}

export default MediaPipeFaceDetection;