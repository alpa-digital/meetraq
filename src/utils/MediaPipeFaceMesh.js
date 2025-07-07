/* ============================================
   SISTEMA DE DETECCIÓN DE CARAS CON MEDIAPIPE FACE MESH - VERSIÓN MEJORADA
   ============================================ */

   class MediaPipeFaceMesh {
    constructor() {
        this.isReady = false;
        this.isProcessing = false;
        this.detectionHistory = [];
        this.faceTracker = new Map();
        this.nextFaceId = 1;
        this.lastProcessTime = 0;
        this.processingInterval = 50; // Reducido a 50ms para respuesta más rápida
        
        // MediaPipe components
        this.faceMesh = null;
        this.camera = null;
        this.canvas = null;
        this.ctx = null;
        this.currentDetections = [];
        
        // Configuración mejorada para detección a distancia
        this.config = {
            // Sensibilidad mejorada para detectar caras más pequeñas/lejanas
            minDetectionConfidence: 0.3, // Reducido de 0.5 a 0.3
            minTrackingConfidence: 0.3,  // Reducido de 0.5 a 0.3
            maxNumFaces: 4,              // Aumentado para detectar más caras
            refineLandmarks: true,       // Activado para mejor precisión
            minFaceSize: 20,            // Reducido para caras más pequeñas
            maxFaceSize: 800,           // Aumentado para caras muy cercanas
            
            // Thresholds más sensibles para detección rápida
            gaze: {
                yawThreshold: 12,        // Más sensible para respuesta rápida
                pitchThreshold: 10,      // Más sensible para respuesta rápida
                rollThreshold: 15,       // Reducido para mejor detección
                confidenceThreshold: 0.5 // Más permisivo para respuesta rápida
            },
            
            // Configuración de preprocessing de imagen
            imageProcessing: {
                enhanceContrast: true,
                normalizeIllumination: true,
                scaleFactor: 1.2        // Factor de escala para mejor detección
            }
        };
        
        // Head pose calculation constants - Mejorados
        this.FACE_LANDMARKS = {
            // Puntos principales para head pose
            NOSE_TIP: 1,
            NOSE_BRIDGE: 6,
            NOSE_BASE: 2,
            
            // Ojos
            LEFT_EYE_CENTER: 33,
            RIGHT_EYE_CENTER: 263,
            LEFT_EYE_INNER: 133,
            RIGHT_EYE_INNER: 362,
            LEFT_EYE_OUTER: 130,
            RIGHT_EYE_OUTER: 359,
            
            // Párpados para detección de ojos cerrados
            LEFT_EYE_TOP: 159,
            LEFT_EYE_BOTTOM: 145,
            RIGHT_EYE_TOP: 386,
            RIGHT_EYE_BOTTOM: 374,
            
            // Contorno facial
            LEFT_EAR: 234,
            RIGHT_EAR: 454,
            CHIN: 175,
            FOREHEAD: 10,
            LEFT_CHEEK: 116,
            RIGHT_CHEEK: 345,
            
            // Boca
            LEFT_MOUTH: 61,
            RIGHT_MOUTH: 291,
            MOUTH_TOP: 13,
            MOUTH_BOTTOM: 14,
            
            // Puntos adicionales para mejor cálculo 3D
            LEFT_TEMPLE: 234,
            RIGHT_TEMPLE: 454,
            JAW_LEFT: 172,
            JAW_RIGHT: 397
        };
        
        // Modelo 3D simplificado de cabeza para pose estimation
        this.HEAD_MODEL_POINTS = [
            [0.0, 0.0, 0.0],           // Nose tip
            [0.0, -330.0, -65.0],      // Chin
            [-225.0, 170.0, -135.0],   // Left eye left corner
            [225.0, 170.0, -135.0],    // Right eye right corner
            [-150.0, -150.0, -125.0],  // Left Mouth corner
            [150.0, -150.0, -125.0]    // Right mouth corner
        ];
        
        console.log('🎯 MediaPipe Face Mesh System initialized with enhanced settings');
    }
    
    async initialize() {
        try {
            console.log('🚀 Loading MediaPipe Face Mesh with enhanced detection...');
            
            // Cargar MediaPipe Face Mesh
            await this.loadMediaPipe();
            
            // Configurar MediaPipe Face Mesh con configuración mejorada
            await this.setupMediaPipe();
            
            this.isReady = true;
            console.log('✅ Enhanced MediaPipe Face Mesh ready');
            
            return { isReady: true, engine: 'mediapipe-facemesh-enhanced' };
        } catch (error) {
            console.error('❌ Error initializing enhanced MediaPipe face mesh:', error);
            throw error;
        }
    }
    
    async loadMediaPipe() {
        if (!window.FaceMesh) {
            return new Promise((resolve, reject) => {
                const scripts = [
                    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
                    'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
                ];
                
                let loadedScripts = 0;
                
                scripts.forEach(src => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = () => {
                        loadedScripts++;
                        if (loadedScripts === scripts.length) {
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
        this.faceMesh = new FaceMesh({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
            }
        });
        
        // Configuración mejorada
        this.faceMesh.setOptions({
            maxNumFaces: this.config.maxNumFaces,
            refineLandmarks: this.config.refineLandmarks,
            minDetectionConfidence: this.config.minDetectionConfidence,
            minTrackingConfidence: this.config.minTrackingConfidence,
            selfieMode: false,
            enableFaceGeometry: false,
            staticImageMode: false
        });
        
        this.faceMesh.onResults((results) => {
            this.currentDetections = results.multiFaceLandmarks || [];
        });
        
        await this.faceMesh.initialize();
    }
    
    // Preprocesamiento mejorado de imagen
    preprocessImage(imageData, width, height) {
        if (!this.config.imageProcessing.enhanceContrast && 
            !this.config.imageProcessing.normalizeIllumination) {
            return imageData;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        
        // Crear ImageData
        const imgData = ctx.createImageData(width, height);
        imgData.data.set(imageData);
        
        // Aplicar mejoras
        if (this.config.imageProcessing.enhanceContrast) {
            this.enhanceContrast(imgData.data);
        }
        
        if (this.config.imageProcessing.normalizeIllumination) {
            this.normalizeIllumination(imgData.data, width, height);
        }
        
        return imgData.data;
    }
    
    enhanceContrast(data) {
        const factor = 1.3; // Factor de contraste
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, (data[i] - 128) * factor + 128));     // R
            data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * factor + 128)); // G
            data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * factor + 128)); // B
        }
    }
    
    normalizeIllumination(data, width, height) {
        // Calcular luminancia promedio
        let totalLuminance = 0;
        for (let i = 0; i < data.length; i += 4) {
            const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            totalLuminance += luminance;
        }
        const avgLuminance = totalLuminance / (width * height);
        
        // Normalizar hacia luminancia target
        const targetLuminance = 128;
        const factor = targetLuminance / avgLuminance;
        
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * factor);     // R
            data[i + 1] = Math.min(255, data[i + 1] * factor); // G
            data[i + 2] = Math.min(255, data[i + 2] * factor); // B
        }
    }
    
    extractFrameData(videoElement) {
        if (!videoElement || videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
            return null;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Aplicar factor de escala para mejor detección
        const scaleFactor = this.config.imageProcessing.scaleFactor;
        const scaledWidth = Math.round(videoElement.videoWidth * scaleFactor);
        const scaledHeight = Math.round(videoElement.videoHeight * scaleFactor);
        
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Dibujar video escalado
        ctx.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);
        
        // Obtener datos de imagen
        const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
        
        // Aplicar preprocesamiento
        const processedData = this.preprocessImage(imageData.data, scaledWidth, scaledHeight);
        
        return {
            canvas: canvas,
            imageData: processedData,
            width: scaledWidth,
            height: scaledHeight,
            originalWidth: videoElement.videoWidth,
            originalHeight: videoElement.videoHeight,
            timestamp: Date.now()
        };
    }
    
    async detectFaces(frameData) {
        if (!this.isReady || this.isProcessing) {
            return [];
        }
        
        const now = Date.now();
        if (now - this.lastProcessTime < this.processingInterval) {
            return this.getLastDetections();
        }
        
        this.isProcessing = true;
        this.lastProcessTime = now;
        
        try {
            // Procesar con MediaPipe
            await this.faceMesh.send({ image: frameData.canvas });
            
            // Esperar para que MediaPipe procese
            await new Promise(resolve => setTimeout(resolve, 30));
            
            // Convertir detecciones de MediaPipe a nuestro formato
            const faces = this.convertFaceMeshDetections(frameData);
            
            // Filtrar detecciones por tamaño mínimo (mejorado para distancia)
            const validFaces = faces.filter(face => {
                const faceArea = face.width * face.height;
                const minArea = this.config.minFaceSize * this.config.minFaceSize;
                const maxArea = this.config.maxFaceSize * this.config.maxFaceSize;
                
                return faceArea >= minArea && faceArea <= maxArea;
            });
            
            // Realizar tracking
            const trackedFaces = this.trackFaces(validFaces, frameData);
            
            // Actualizar historial
            this.detectionHistory.push({
                timestamp: now,
                faces: trackedFaces.length,
                detections: trackedFaces
            });
            
            if (this.detectionHistory.length > 15) {
                this.detectionHistory = this.detectionHistory.slice(-15);
            }
            
            if (trackedFaces.length > 0) {
                console.log(`✅ Enhanced tracking: ${trackedFaces.length} faces`);
                trackedFaces.forEach((face, i) => {
                    console.log(`  Face ${i+1}: Distance Score: ${face.analysis?.metrics?.distanceScore || 'N/A'}, Gaze: ${face.gazeDirection?.direction}`);
                });
            }
            
            return trackedFaces;
            
        } catch (error) {
            console.error('❌ Error in enhanced Face Mesh detection:', error);
            return [];
        } finally {
            this.isProcessing = false;
        }
    }
    
    convertFaceMeshDetections(frameData) {
        if (!this.currentDetections || this.currentDetections.length === 0) {
            return [];
        }
        
        const faces = [];
        const { width, height } = frameData;
        
        this.currentDetections.forEach((landmarks, index) => {
            if (!landmarks || landmarks.length < 468) {
                return;
            }
            
            // Calcular bounding box desde landmarks
            const bbox = this.calculateBoundingBox(landmarks, width, height);
            
            // Calcular distancia estimada de la cara
            const distanceInfo = this.calculateFaceDistance(landmarks, width, height);
            
            // Calcular head pose mejorado
            const headPose = this.calculateEnhancedHeadPose(landmarks, width, height);
            
            // Calcular estado de ojos mejorado
            const eyeState = this.calculateEnhancedEyeState(landmarks);
            
            // Calcular dirección de mirada mejorada
            const gazeDirection = this.calculateEnhancedGazeDirection(headPose, eyeState, landmarks);
            
            const face = {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height,
                confidence: this.calculateDetectionConfidence(landmarks, distanceInfo, headPose),
                method: 'mediapipe-facemesh-enhanced',
                landmarks: landmarks,
                headPose: headPose,
                eyeState: eyeState,
                gazeDirection: gazeDirection,
                distanceInfo: distanceInfo
            };
            
            // Validar detección
            if (this.isValidDetection(face, width, height)) {
                faces.push(face);
            }
        });
        
        return faces;
    }
    
    calculateFaceDistance(landmarks, width, height) {
        try {
            // Calcular distancia basada en la distancia entre ojos
            const leftEye = landmarks[this.FACE_LANDMARKS.LEFT_EYE_CENTER];
            const rightEye = landmarks[this.FACE_LANDMARKS.RIGHT_EYE_CENTER];
            
            const eyeDistance = Math.sqrt(
                Math.pow((rightEye.x - leftEye.x) * width, 2) + 
                Math.pow((rightEye.y - leftEye.y) * height, 2)
            );
            
            // Distancia promedio entre ojos es ~63mm
            // A 60cm de distancia, en una imagen de 640px de ancho, esto sería ~67px
            const referenceEyeDistance = 67; // píxeles a distancia de referencia
            const referenceCameraDistance = 60; // cm
            
            const estimatedDistance = (referenceEyeDistance * referenceCameraDistance) / eyeDistance;
            
            // Clasificar proximidad
            let proximityLevel;
            let distanceScore;
            
            if (estimatedDistance < 30) {
                proximityLevel = 'very_close';
                distanceScore = 100;
            } else if (estimatedDistance < 50) {
                proximityLevel = 'close';
                distanceScore = 85;
            } else if (estimatedDistance < 80) {
                proximityLevel = 'optimal';
                distanceScore = 95;
            } else if (estimatedDistance < 120) {
                proximityLevel = 'far';
                distanceScore = 70;
            } else {
                proximityLevel = 'very_far';
                distanceScore = 50;
            }
            
            return {
                estimatedDistance: Math.round(estimatedDistance),
                eyeDistance: Math.round(eyeDistance),
                proximityLevel,
                distanceScore,
                isOptimalDistance: proximityLevel === 'optimal' || proximityLevel === 'close'
            };
            
        } catch (error) {
            console.error('❌ Error calculating face distance:', error);
            return {
                estimatedDistance: 100,
                eyeDistance: 50,
                proximityLevel: 'unknown',
                distanceScore: 60,
                isOptimalDistance: false
            };
        }
    }
    
    calculateEnhancedHeadPose(landmarks, width, height) {
        try {
            // Obtener puntos clave 3D mejorados
            const imagePoints = [
                [landmarks[this.FACE_LANDMARKS.NOSE_TIP].x * width, landmarks[this.FACE_LANDMARKS.NOSE_TIP].y * height],
                [landmarks[this.FACE_LANDMARKS.CHIN].x * width, landmarks[this.FACE_LANDMARKS.CHIN].y * height],
                [landmarks[this.FACE_LANDMARKS.LEFT_EYE_OUTER].x * width, landmarks[this.FACE_LANDMARKS.LEFT_EYE_OUTER].y * height],
                [landmarks[this.FACE_LANDMARKS.RIGHT_EYE_OUTER].x * width, landmarks[this.FACE_LANDMARKS.RIGHT_EYE_OUTER].y * height],
                [landmarks[this.FACE_LANDMARKS.LEFT_MOUTH].x * width, landmarks[this.FACE_LANDMARKS.LEFT_MOUTH].y * height],
                [landmarks[this.FACE_LANDMARKS.RIGHT_MOUTH].x * width, landmarks[this.FACE_LANDMARKS.RIGHT_MOUTH].y * height]
            ];
            
            // Calcular head pose usando geometría mejorada
            const pose = this.solvePnP(imagePoints, this.HEAD_MODEL_POINTS, width, height);
            
            // Calcular ángulos adicionales
            const leftEye = landmarks[this.FACE_LANDMARKS.LEFT_EYE_CENTER];
            const rightEye = landmarks[this.FACE_LANDMARKS.RIGHT_EYE_CENTER];
            const nose = landmarks[this.FACE_LANDMARKS.NOSE_TIP];
            
            // Roll calculado desde la línea de los ojos
            const eyeVector = {
                x: (rightEye.x - leftEye.x) * width,
                y: (rightEye.y - leftEye.y) * height
            };
            const roll = Math.atan2(eyeVector.y, eyeVector.x) * 180 / Math.PI;
            
            return {
                yaw: pose.yaw,
                pitch: pose.pitch,
                roll: roll,
                confidence: this.calculatePoseConfidence(landmarks, pose),
                isLookingForward: Math.abs(pose.yaw) < this.config.gaze.yawThreshold && 
                                Math.abs(pose.pitch) < this.config.gaze.pitchThreshold,
                quality: pose.quality || 0.8
            };
            
        } catch (error) {
            console.error('❌ Error calculating enhanced head pose:', error);
            return {
                yaw: 0,
                pitch: 0,
                roll: 0,
                confidence: 0.5,
                isLookingForward: true,
                quality: 0.5
            };
        }
    }
    
    solvePnP(imagePoints, modelPoints, imageWidth, imageHeight) {
        // Implementación simplificada de PnP para head pose
        const focalLength = imageWidth;
        const center = [imageWidth / 2, imageHeight / 2];
        
        // Calcular yaw basado en la posición horizontal de la nariz
        const noseTip = imagePoints[0];
        const normalizedNoseX = (noseTip[0] - center[0]) / (imageWidth / 2);
        const yaw = normalizedNoseX * 45; // Escalado empírico
        
        // Calcular pitch basado en posiciones relativas
        const chin = imagePoints[1];
        const noseToChingDistance = Math.sqrt(
            Math.pow(noseTip[0] - chin[0], 2) + Math.pow(noseTip[1] - chin[1], 2)
        );
        const normalizedDistance = noseToChingDistance / imageHeight;
        const pitch = (0.15 - normalizedDistance) * 300; // Escalado empírico
        
        return {
            yaw: Math.max(-60, Math.min(60, yaw)),
            pitch: Math.max(-40, Math.min(40, pitch)),
            quality: 0.8
        };
    }
    
    calculatePoseConfidence(landmarks, pose) {
        // Calcular confianza basada en la estabilidad de landmarks clave
        const keyLandmarks = [
            this.FACE_LANDMARKS.NOSE_TIP,
            this.FACE_LANDMARKS.LEFT_EYE_CENTER,
            this.FACE_LANDMARKS.RIGHT_EYE_CENTER,
            this.FACE_LANDMARKS.CHIN
        ];
        
        let stabilityScore = 0;
        keyLandmarks.forEach(idx => {
            const landmark = landmarks[idx];
            if (landmark && landmark.x >= 0 && landmark.x <= 1 && 
                landmark.y >= 0 && landmark.y <= 1) {
                stabilityScore += 0.25;
            }
        });
        
        // Factor en la magnitud de los ángulos
        const angleConfidence = 1 - (Math.abs(pose.yaw) + Math.abs(pose.pitch)) / 120;
        
        return Math.max(0, Math.min(1, (stabilityScore + angleConfidence) / 2));
    }
    
    calculateEnhancedEyeState(landmarks) {
        try {
            // Usar landmarks específicos para ojos - CORREGIDOS
            const leftEyePoints = {
                top: landmarks[159],        // Correcto: párpado superior izquierdo
                bottom: landmarks[145],     // Correcto: párpado inferior izquierdo
                left: landmarks[133],       // Correcto: esquina interna ojo izquierdo
                right: landmarks[130],      // Correcto: esquina externa ojo izquierdo
                center: landmarks[this.FACE_LANDMARKS.LEFT_EYE_CENTER]
            };
            
            const rightEyePoints = {
                top: landmarks[386],        // Correcto: párpado superior derecho
                bottom: landmarks[374],     // Correcto: párpado inferior derecho
                left: landmarks[362],       // Correcto: esquina interna ojo derecho
                right: landmarks[359],      // Correcto: esquina externa ojo derecho
                center: landmarks[this.FACE_LANDMARKS.RIGHT_EYE_CENTER]
            };
            
            // Calcular EAR mejorado con múltiples puntos
            const leftEAR = this.calculatePreciseEAR(leftEyePoints);
            const rightEAR = this.calculatePreciseEAR(rightEyePoints);
            const averageEAR = (leftEAR + rightEAR) / 2;
            
            // Umbrales calibrados específicamente para ojos cerrados
            const blinkThreshold = 0.15;      // Más restrictivo para detectar parpadeo
            const closedThreshold = 0.12;     // Ojos completamente cerrados
            const openThreshold = 0.25;       // Ojos claramente abiertos
            const wideOpenThreshold = 0.35;   // Ojos muy abiertos
            
            // Estados más precisos
            const isBlinking = averageEAR < blinkThreshold;
            const eyesClosed = averageEAR < closedThreshold;
            const eyesOpen = averageEAR > openThreshold;
            const eyesWideOpen = averageEAR > wideOpenThreshold;
            
            // Detectar estado específico
            let eyeState;
            let alertness;
            
            if (eyesClosed) {
                eyeState = 'closed';
                alertness = 0.0;
            } else if (isBlinking) {
                eyeState = 'blinking';
                alertness = 0.1;
            } else if (eyesWideOpen) {
                eyeState = 'wide_open';
                alertness = 1.0;
            } else if (eyesOpen) {
                eyeState = 'open';
                alertness = 0.9;
            } else {
                eyeState = 'partially_closed';
                alertness = 0.4;
            }
            
            // Debug específico para ojos cerrados
            if (averageEAR < 0.2) {
                console.log(`👁️ Eye state debug: EAR=${averageEAR.toFixed(3)}, State=${eyeState}, Left=${leftEAR.toFixed(3)}, Right=${rightEAR.toFixed(3)}`);
            }
            
            return {
                leftEAR,
                rightEAR,
                averageEAR,
                isBlinking,
                eyesOpen: eyesOpen || eyesWideOpen,
                eyesClosed,
                eyeState,
                alertness,
                // Información adicional para debugging
                debug: {
                    belowBlinkThreshold: averageEAR < blinkThreshold,
                    belowClosedThreshold: averageEAR < closedThreshold,
                    aboveOpenThreshold: averageEAR > openThreshold
                }
            };
            
        } catch (error) {
            console.error('❌ Error calculating enhanced eye state:', error);
            return {
                leftEAR: 0.3,
                rightEAR: 0.3,
                averageEAR: 0.3,
                isBlinking: false,
                eyesOpen: true,
                eyesClosed: false,
                eyeState: 'open',
                alertness: 1.0,
                debug: {}
            };
        }
    }
    
    calculatePreciseEAR(eyePoints) {
        // Cálculo más preciso del Eye Aspect Ratio usando múltiples puntos
        try {
            // Distancia vertical principal (centro del párpado)
            const verticalDist1 = Math.sqrt(
                Math.pow(eyePoints.top.x - eyePoints.bottom.x, 2) + 
                Math.pow(eyePoints.top.y - eyePoints.bottom.y, 2)
            );
            
            // Distancia horizontal (ancho del ojo)
            const horizontalDist = Math.sqrt(
                Math.pow(eyePoints.left.x - eyePoints.right.x, 2) + 
                Math.pow(eyePoints.left.y - eyePoints.right.y, 2)
            );
            
            // Calcular EAR con validación
            if (horizontalDist > 0.001) { // Evitar división por cero
                return verticalDist1 / horizontalDist;
            } else {
                return 0.1; // Valor bajo que indica problema
            }
        } catch (error) {
            console.error('❌ Error in precise EAR calculation:', error);
            return 0.3; // Valor por defecto
        }
    }
    
    calculateEnhancedGazeDirection(headPose, eyeState, landmarks) {
        if (!headPose || !eyeState) {
            return {
                isLookingAway: false,
                direction: 'center',
                gazeScore: 0.7,
                confidence: 0,
                attentionLevel: 'medium'
            };
        }
        
        const { yaw, pitch, roll, confidence } = headPose;
        const { eyesOpen, alertness } = eyeState;
        
        // Thresholds mejorados y más sensibles
        const yawThreshold = this.config.gaze.yawThreshold;
        const pitchThreshold = this.config.gaze.pitchThreshold;
        const rollThreshold = this.config.gaze.rollThreshold;
        
        // Determinar dirección con mayor precisión
        let direction = 'center';
        let isLookingAway = false;
        let attentionLevel = 'high';
        
        // Análisis multidimensional de la dirección
        const yawAbs = Math.abs(yaw);
        const pitchAbs = Math.abs(pitch);
        const rollAbs = Math.abs(roll);
        
        if (yawAbs > yawThreshold || pitchAbs > pitchThreshold || rollAbs > rollThreshold) {
            isLookingAway = true;
            attentionLevel = 'low';
            
            // Determinar dirección principal
            if (yawAbs > pitchAbs && yawAbs > rollAbs) {
                direction = yaw > 0 ? 'right' : 'left';
            } else if (pitchAbs > rollAbs) {
                direction = pitch > 0 ? 'down' : 'up';
            } else {
                direction = roll > 0 ? 'tilted_right' : 'tilted_left';
            }
        } else if (yawAbs > yawThreshold * 0.5 || pitchAbs > pitchThreshold * 0.5) {
            attentionLevel = 'medium';
        }
        
        // Factor en el estado de los ojos con mayor peso
        if (!eyesOpen) {
            attentionLevel = 'very_low';
            isLookingAway = true;
            gazeScore *= 0.1; // Penalización severa por ojos cerrados
        } else if (eyeState.eyesClosed) {
            attentionLevel = 'very_low';
            isLookingAway = true;
            gazeScore *= 0.1;
        } else if (eyeState.isBlinking) {
            // Leve penalización por parpadeo, pero no tan severa
            gazeScore *= 0.7;
            if (attentionLevel === 'high') attentionLevel = 'medium';
        }
        
        // Calcular gaze score mejorado
        const yawNormalized = yawAbs / 60;
        const pitchNormalized = pitchAbs / 40;
        const rollNormalized = rollAbs / 30;
        const maxDeviation = Math.max(yawNormalized, pitchNormalized, rollNormalized);
        
        let gazeScore = Math.max(0, 1 - maxDeviation);
        gazeScore *= alertness; // Factor en el estado de alerta
        gazeScore *= confidence; // Factor en la confianza del pose
        
        // Clasificación de atención más responsiva
        if (gazeScore > 0.8 && eyesOpen && !eyeState.eyesClosed) {
            attentionLevel = 'very_high';
        } else if (gazeScore > 0.6 && eyesOpen && !eyeState.eyesClosed) {
            attentionLevel = 'high';
        } else if (gazeScore > 0.4 && eyesOpen) {
            attentionLevel = 'medium';
        } else if (gazeScore > 0.2 || eyeState.isBlinking) {
            attentionLevel = 'low';
        } else {
            attentionLevel = 'very_low';
        }
        
        return {
            isLookingAway,
            direction,
            gazeScore,
            confidence,
            yaw,
            pitch,
            roll,
            eyesOpen,
            attentionLevel,
            details: {
                yawDeviation: yawAbs,
                pitchDeviation: pitchAbs,
                rollDeviation: rollAbs,
                alertnessScore: alertness,
                isEngaged: gazeScore > 0.6 && eyesOpen && attentionLevel !== 'very_low'
            }
        };
    }
    
    calculateDetectionConfidence(landmarks, distanceInfo, headPose) {
        // Confianza basada en múltiples factores
        let confidence = 0.5;
        
        // Factor de landmarks (calidad de detección)
        const landmarkQuality = landmarks.length >= 468 ? 0.3 : 0.1;
        confidence += landmarkQuality;
        
        // Factor de distancia (mejor detección a distancia óptima)
        confidence += (distanceInfo.distanceScore / 100) * 0.3;
        
        // Factor de pose (mejor confianza con cabeza frontal)
        confidence += (headPose.confidence || 0.5) * 0.2;
        
        // Factor de calidad general
        confidence += (headPose.quality || 0.5) * 0.2;
        
        return Math.max(0.3, Math.min(1.0, confidence));
    }
    
    isValidDetection(face, width, height) {
        // Validaciones mejoradas
        const validBounds = face.x >= 0 && face.y >= 0 && 
                           face.x + face.width <= width && 
                           face.y + face.height <= height;
        
        const validSize = face.width >= this.config.minFaceSize && 
                         face.height >= this.config.minFaceSize &&
                         face.width <= this.config.maxFaceSize && 
                         face.height <= this.config.maxFaceSize;
        
        const validConfidence = face.confidence >= this.config.minDetectionConfidence;
        
        const validAspectRatio = face.width > 0 && face.height > 0 && 
                                (face.width / face.height) > 0.5 && 
                                (face.width / face.height) < 2.0;
        
        return validBounds && validSize && validConfidence && validAspectRatio;
    }
    
    calculateBoundingBox(landmarks, width, height) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        // Usar todos los landmarks para un bounding box más preciso
        landmarks.forEach(landmark => {
            const x = landmark.x * width;
            const y = landmark.y * height;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
        
        // Añadir padding adaptivo basado en el tamaño
        const faceWidth = maxX - minX;
        const faceHeight = maxY - minY;
        const padding = Math.max(5, Math.min(faceWidth * 0.1, faceHeight * 0.1));
        
        return {
            x: Math.max(0, Math.round(minX - padding)),
            y: Math.max(0, Math.round(minY - padding)),
            width: Math.round(faceWidth + padding * 2),
            height: Math.round(faceHeight + padding * 2)
        };
    }
    
    trackFaces(detections, frameData) {
        const trackedFaces = [];
        
        detections.forEach(detection => {
            let bestMatch = null;
            let bestDistance = Infinity;
            
            // Buscar el mejor match con tracking mejorado
            this.faceTracker.forEach((trackedFace, id) => {
                const centerX = detection.x + detection.width / 2;
                const centerY = detection.y + detection.height / 2;
                const trackedCenterX = trackedFace.lastX + trackedFace.lastWidth / 2;
                const trackedCenterY = trackedFace.lastY + trackedFace.lastHeight / 2;
                
                const distance = Math.sqrt(
                    Math.pow(centerX - trackedCenterX, 2) + 
                    Math.pow(centerY - trackedCenterY, 2)
                );
                
                // Threshold adaptivo basado en el tamaño de la cara
                const adaptiveThreshold = Math.max(100, Math.min(200, detection.width * 0.8));
                
                if (distance < bestDistance && distance < adaptiveThreshold) {
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
                
                // Mantener historial más corto para respuesta rápida
                tracked.gazeHistory = tracked.gazeHistory || [];
                tracked.gazeHistory.push(detection.gazeDirection);
                if (tracked.gazeHistory.length > 3) { // Reducido de 5 a 3
                    tracked.gazeHistory = tracked.gazeHistory.slice(-3);
                }
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
                    detectionCount: 1,
                    gazeHistory: [detection.gazeDirection]
                });
            }
            
            // Escalar coordenadas al tamaño original
            const scaleX = frameData.originalWidth / frameData.width;
            const scaleY = frameData.originalHeight / frameData.height;
            
            // Calcular métricas mejoradas
            const trackedFace = this.faceTracker.get(faceId);
            const smoothedGaze = this.calculateSmoothedGaze(trackedFace.gazeHistory);
            
            trackedFaces.push({
                id: faceId,
                box: {
                    x: Math.round(detection.x * scaleX),
                    y: Math.round(detection.y * scaleY),
                    width: Math.round(detection.width * scaleX),
                    height: Math.round(detection.height * scaleY)
                },
                confidence: detection.confidence,
                source: 'mediapipe-facemesh-enhanced',
                timestamp: frameData.timestamp,
                method: detection.method,
                landmarks: detection.landmarks,
                headPose: detection.headPose,
                eyeState: detection.eyeState,
                gazeDirection: smoothedGaze,
                distanceInfo: detection.distanceInfo,
                analysis: {
                    metrics: {
                        engagement: this.calculateEnhancedEngagement(detection),
                        attention: this.calculateEnhancedAttention(detection),
                        confidence: Math.round(detection.confidence * 100),
                        gazeScore: Math.round(smoothedGaze.gazeScore * 100),
                        distanceScore: detection.distanceInfo.distanceScore,
                        attentionLevel: smoothedGaze.attentionLevel,
                        headPose: detection.headPose,
                        stability: this.calculateStability(trackedFace)
                    }
                }
            });
        });
        
        // Limpiar caras que no se han visto (timeout adaptivo)
        const now = frameData.timestamp;
        this.faceTracker.forEach((face, id) => {
            const timeout = face.detectionCount > 10 ? 5000 : 2000; // Timeout más largo para caras bien establecidas
            if (now - face.lastSeen > timeout) {
                this.faceTracker.delete(id);
            }
        });
        
        return trackedFaces;
    }
    
    calculateSmoothedGaze(gazeHistory) {
        if (!gazeHistory || gazeHistory.length === 0) {
            return {
                isLookingAway: false,
                direction: 'center',
                gazeScore: 0.7,
                confidence: 0.5,
                attentionLevel: 'medium'
            };
        }
        
        // Usar solo la lectura más reciente para respuesta rápida, 
        // pero con validación de las 2 anteriores para estabilidad
        const mostRecent = gazeHistory[gazeHistory.length - 1];
        const recentReadings = gazeHistory.slice(-2); // Solo últimas 2 lecturas
        
        // Si tenemos lecturas múltiples, validar consistencia
        if (recentReadings.length >= 2) {
            const current = mostRecent;
            const previous = recentReadings[0];
            
            // Si hay cambio significativo en atención, responder inmediatamente
            const attentionChanged = (
                (current.attentionLevel === 'very_low' || current.attentionLevel === 'low') !==
                (previous.attentionLevel === 'very_low' || previous.attentionLevel === 'low')
            );
            
            const eyeStateChanged = current.eyesOpen !== previous.eyesOpen;
            
            // Respuesta inmediata para cambios importantes
            if (attentionChanged || eyeStateChanged) {
                console.log(`🚨 Quick response: Attention=${current.attentionLevel}, Eyes=${current.eyesOpen}`);
                return current; // Usar lectura actual sin suavizado
            }
        }
        
        // Para cambios menores, aplicar suavizado ligero
        if (recentReadings.length >= 2) {
            const current = mostRecent;
            const previous = recentReadings[0];
            
            // Promediar solo para valores estables
            const avgYaw = (current.yaw + previous.yaw) / 2;
            const avgPitch = (current.pitch + previous.pitch) / 2;
            const avgGazeScore = (current.gazeScore + previous.gazeScore) / 2;
            const avgConfidence = (current.confidence + previous.confidence) / 2;
            
            return {
                ...current, // Mantener la mayoría de propiedades actuales
                yaw: avgYaw,
                pitch: avgPitch,
                gazeScore: avgGazeScore,
                confidence: avgConfidence
            };
        }
        
        // Si solo tenemos una lectura, usarla directamente
        return mostRecent;
    }
    
    calculateStability(trackedFace) {
        // Calcular estabilidad del tracking
        const detectionCount = trackedFace.detectionCount;
        const ageMs = Date.now() - trackedFace.firstSeen;
        
        let stabilityScore = 0;
        
        // Factor de consistencia temporal
        if (detectionCount > 10) stabilityScore += 0.4;
        else if (detectionCount > 5) stabilityScore += 0.2;
        
        // Factor de duración
        if (ageMs > 3000) stabilityScore += 0.3;
        else if (ageMs > 1000) stabilityScore += 0.2;
        
        // Factor de suavidad del gaze
        const gazeHistory = trackedFace.gazeHistory || [];
        if (gazeHistory.length > 2) {
            const gazeVariance = this.calculateGazeVariance(gazeHistory);
            stabilityScore += Math.max(0, 0.3 - gazeVariance);
        }
        
        return Math.min(1.0, stabilityScore);
    }
    
    calculateGazeVariance(gazeHistory) {
        if (gazeHistory.length < 2) return 0;
        
        const yaws = gazeHistory.map(g => g.yaw || 0);
        const pitches = gazeHistory.map(g => g.pitch || 0);
        
        const yawMean = yaws.reduce((a, b) => a + b, 0) / yaws.length;
        const pitchMean = pitches.reduce((a, b) => a + b, 0) / pitches.length;
        
        const yawVariance = yaws.reduce((sum, yaw) => sum + Math.pow(yaw - yawMean, 2), 0) / yaws.length;
        const pitchVariance = pitches.reduce((sum, pitch) => sum + Math.pow(pitch - pitchMean, 2), 0) / pitches.length;
        
        return (Math.sqrt(yawVariance) + Math.sqrt(pitchVariance)) / 60; // Normalizado
    }
    
    calculateEnhancedEngagement(detection) {
        const distanceScore = detection.distanceInfo.distanceScore;
        const gazeScore = detection.gazeDirection.gazeScore * 100;
        const confidenceScore = detection.confidence * 100;
        const eyeStateScore = detection.eyeState.eyesOpen ? 100 : 
                             detection.eyeState.isBlinking ? 30 : 60;
        
        // Ponderación mejorada
        const engagement = (distanceScore * 0.2 + gazeScore * 0.4 + 
                           confidenceScore * 0.2 + eyeStateScore * 0.2);
        
        return Math.round(Math.max(0, Math.min(100, engagement)));
    }
    
    calculateEnhancedAttention(detection) {
        const gazeScore = detection.gazeDirection.gazeScore;
        const attentionLevel = detection.gazeDirection.attentionLevel;
        const eyesOpen = detection.eyeState.eyesOpen;
        const alertness = detection.eyeState.alertness;
        
        let attentionScore = gazeScore * 60; // Base score from gaze
        
        // Bonificaciones por nivel de atención
        switch (attentionLevel) {
            case 'very_high': attentionScore += 40; break;
            case 'high': attentionScore += 30; break;
            case 'medium': attentionScore += 15; break;
            case 'low': attentionScore += 5; break;
            case 'very_low': attentionScore -= 10; break;
        }
        
        // Factor de alerta
        attentionScore *= alertness;
        
        // Penalización por ojos cerrados
        if (!eyesOpen) {
            attentionScore *= 0.3;
        }
        
        return Math.round(Math.max(0, Math.min(100, attentionScore)));
    }
    
    getLastDetections() {
        if (this.detectionHistory.length === 0) return [];
        return this.detectionHistory[this.detectionHistory.length - 1].detections || [];
    }
    
    getEnhancedStats() {
        const recent = this.detectionHistory.slice(-5);
        const totalDetections = this.detectionHistory.reduce((sum, h) => sum + h.faces, 0);
        const avgFaces = recent.length > 0 ? 
            recent.reduce((sum, h) => sum + h.faces, 0) / recent.length : 0;
        
        // Estadísticas de calidad
        const lastDetections = this.getLastDetections();
        const avgDistance = lastDetections.length > 0 ?
            lastDetections.reduce((sum, d) => sum + (d.distanceInfo?.estimatedDistance || 100), 0) / lastDetections.length : 100;
        
        const avgAttention = lastDetections.length > 0 ?
            lastDetections.reduce((sum, d) => sum + (d.analysis?.metrics?.attention || 50), 0) / lastDetections.length : 50;
        
        return {
            totalDetections,
            currentFaces: lastDetections.length,
            avgFacesRecent: Math.round(avgFaces * 10) / 10,
            activeTracks: this.faceTracker.size,
            isReady: this.isReady,
            engine: 'mediapipe-facemesh-enhanced',
            quality: {
                avgDistance: Math.round(avgDistance),
                avgAttention: Math.round(avgAttention),
                detectionRate: this.detectionHistory.length > 0 ? 
                    (totalDetections / this.detectionHistory.length) : 0
            }
        };
    }
    
    getStats() {
        return this.getEnhancedStats();
    }
    
    // Método para ajustar configuración en tiempo real
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        
        // Reconfigurar MediaPipe si es necesario
        if (this.faceMesh && newConfig.minDetectionConfidence !== undefined) {
            this.faceMesh.setOptions({
                minDetectionConfidence: this.config.minDetectionConfidence,
                minTrackingConfidence: this.config.minTrackingConfidence
            });
        }
        
        console.log('🔧 Enhanced MediaPipe config updated:', newConfig);
    }
    
    // Método para obtener recomendaciones de posicionamiento
    getPositioningRecommendations() {
        const lastDetections = this.getLastDetections();
        if (lastDetections.length === 0) {
            return {
                hasRecommendations: true,
                recommendations: ['Move closer to the camera for better detection']
            };
        }
        
        const recommendations = [];
        const detection = lastDetections[0];
        
        // Recomendaciones de distancia
        if (detection.distanceInfo) {
            switch (detection.distanceInfo.proximityLevel) {
                case 'very_far':
                    recommendations.push('Move significantly closer to the camera');
                    break;
                case 'far':
                    recommendations.push('Move a bit closer to the camera for optimal detection');
                    break;
                case 'very_close':
                    recommendations.push('Move back from the camera slightly');
                    break;
            }
        }
        
        // Recomendaciones de gaze
        if (detection.gazeDirection) {
            const { direction, attentionLevel } = detection.gazeDirection;
            
            if (attentionLevel === 'low' || attentionLevel === 'very_low') {
                recommendations.push('Look directly at the camera for better attention tracking');
            }
            
            if (direction !== 'center' && direction !== 'tilted_right' && direction !== 'tilted_left') {
                const directionMap = {
                    'left': 'Look more to the right',
                    'right': 'Look more to the left',
                    'up': 'Look down towards the camera',
                    'down': 'Look up towards the camera'
                };
                if (directionMap[direction]) {
                    recommendations.push(directionMap[direction]);
                }
            }
        }
        
        // Recomendaciones de iluminación
        if (detection.confidence < 0.7) {
            recommendations.push('Improve lighting on your face for better detection');
        }
        
        return {
            hasRecommendations: recommendations.length > 0,
            recommendations,
            currentStatus: {
                distance: detection.distanceInfo?.proximityLevel || 'unknown',
                attention: detection.gazeDirection?.attentionLevel || 'unknown',
                confidence: Math.round((detection.confidence || 0.5) * 100)
            }
        };
    }
    
    cleanup() {
        if (this.faceMesh) {
            this.faceMesh.close();
        }
        this.isReady = false;
        this.faceTracker.clear();
        this.detectionHistory = [];
        console.log('🧹 Enhanced MediaPipe Face Mesh cleaned up');
    }
}

export default MediaPipeFaceMesh;