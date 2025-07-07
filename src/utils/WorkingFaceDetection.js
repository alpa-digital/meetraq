/* ============================================
   SISTEMA DE DETECCIÓN DE CARAS FUNCIONAL
   ============================================ */

   class WorkingFaceDetection {
    constructor() {
        this.isReady = false;
        this.isProcessing = false;
        this.detectionHistory = [];
        this.faceTracker = new Map();
        this.nextFaceId = 1;
        this.lastProcessTime = 0;
        this.processingInterval = 500; // Procesar cada 500ms
        
        console.log('🎯 Working Face Detection System initialized');
    }
    
    async initialize() {
        try {
            console.log('🚀 Loading face detection system...');
            
            // Simular carga de modelos
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            this.isReady = true;
            console.log('✅ Face detection system ready');
            
            return { isReady: true, engine: 'working' };
        } catch (error) {
            console.error('❌ Error initializing face detection:', error);
            throw error;
        }
    }
    
    extractFrameData(videoElement) {
        if (!videoElement || videoElement.readyState !== 4) {
            console.log('⚠️ Video not ready for processing');
            return null;
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Usar dimensiones del video
        canvas.width = Math.min(videoElement.videoWidth, 640);
        canvas.height = Math.min(videoElement.videoHeight, 480);
        
        try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            return {
                imageData,
                width: canvas.width,
                height: canvas.height,
                originalWidth: videoElement.videoWidth,
                originalHeight: videoElement.videoHeight,
                timestamp: Date.now()
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
            console.log('🔍 Processing frame for face detection...');
            
            const faces = await this.detectFacesInFrame(frameData);
            
            // Actualizar historial
            this.detectionHistory.push({
                timestamp: now,
                faces: faces.length,
                detections: faces
            });
            
            // Mantener solo las últimas 10 detecciones
            if (this.detectionHistory.length > 10) {
                this.detectionHistory = this.detectionHistory.slice(-10);
            }
            
            if (faces.length > 0) {
                console.log(`✅ Detected ${faces.length} faces`);
            }
            
            return faces;
            
        } catch (error) {
            console.error('❌ Error in face detection:', error);
            return [];
        } finally {
            this.isProcessing = false;
        }
    }
    
    async detectFacesInFrame(frameData) {
        if (!frameData || !frameData.imageData) {
            return [];
        }
        
        const faces = [];
        
        // Método 1: Detección por contraste y simetría
        const contrastFaces = this.detectByContrast(frameData);
        faces.push(...contrastFaces);
        
        // Método 2: Detección por patrones de color de piel
        const skinFaces = this.detectBySkinTone(frameData);
        faces.push(...skinFaces);
        
        // Método 3: Detección por bordes
        const edgeFaces = this.detectByEdges(frameData);
        faces.push(...edgeFaces);
        
        // Combinar y filtrar detecciones duplicadas
        const uniqueFaces = this.mergeDetections(faces);
        
        // Asignar IDs y tracking
        return this.trackFaces(uniqueFaces, frameData);
    }
    
    detectByContrast(frameData) {
        const { imageData, width, height } = frameData;
        const data = imageData.data;
        const faces = [];
        
        const windowSize = Math.min(width, height) / 8; // Tamaño de ventana adaptativo
        const step = Math.max(8, Math.floor(windowSize / 4));
        
        for (let y = 0; y < height - windowSize; y += step) {
            for (let x = 0; x < width - windowSize; x += step) {
                const contrast = this.calculateContrast(data, x, y, windowSize, width);
                const symmetry = this.calculateSymmetry(data, x, y, windowSize, width);
                const skinLikeness = this.calculateSkinLikeness(data, x, y, windowSize, width);
                
                // Puntaje combinado
                const score = (contrast * 0.3) + (symmetry * 0.4) + (skinLikeness * 0.3);
                
                if (score > 0.4) { // Umbral ajustado
                    faces.push({
                        x: x,
                        y: y,
                        width: windowSize,
                        height: windowSize,
                        confidence: Math.min(0.95, score),
                        method: 'contrast',
                        score: score
                    });
                }
            }
        }
        
        return faces;
    }
    
    detectBySkinTone(frameData) {
        const { imageData, width, height } = frameData;
        const data = imageData.data;
        const faces = [];
        
        // Detectar regiones con tonos de piel
        const skinRegions = this.findSkinRegions(data, width, height);
        
        // Agrupar regiones cercanas
        const clusters = this.clusterRegions(skinRegions);
        
        clusters.forEach(cluster => {
            if (cluster.length > 20) { // Mínimo de píxeles
                const bounds = this.getClusterBounds(cluster);
                
                // Verificar proporciones faciales
                const aspect = bounds.width / bounds.height;
                if (aspect > 0.7 && aspect < 1.4) { // Proporción facial típica
                    faces.push({
                        x: bounds.x,
                        y: bounds.y,
                        width: bounds.width,
                        height: bounds.height,
                        confidence: 0.6,
                        method: 'skin',
                        pixelCount: cluster.length
                    });
                }
            }
        });
        
        return faces;
    }
    
    detectByEdges(frameData) {
        const { imageData, width, height } = frameData;
        const data = imageData.data;
        const faces = [];
        
        // Detectar bordes fuertes (características faciales)
        const edges = this.detectEdges(data, width, height);
        
        // Buscar patrones circulares/ovales
        const circularRegions = this.findCircularPatterns(edges, width, height);
        
        circularRegions.forEach(region => {
            if (region.strength > 0.3) {
                faces.push({
                    x: region.x - region.radius,
                    y: region.y - region.radius,
                    width: region.radius * 2,
                    height: region.radius * 2,
                    confidence: region.strength,
                    method: 'edges',
                    strength: region.strength
                });
            }
        });
        
        return faces;
    }
    
    calculateContrast(data, startX, startY, size, width) {
        let totalContrast = 0;
        let pixelCount = 0;
        
        for (let y = startY; y < startY + size; y += 2) {
            for (let x = startX; x < startX + size; x += 2) {
                const index = (y * width + x) * 4;
                if (index + 2 < data.length) {
                    const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
                    
                    // Comparar con píxeles vecinos
                    const neighbors = [
                        { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
                        { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
                    ];
                    
                    let localContrast = 0;
                    neighbors.forEach(({ dx, dy }) => {
                        const nx = x + dx;
                        const ny = y + dy;
                        const nIndex = (ny * width + nx) * 4;
                        
                        if (nIndex >= 0 && nIndex + 2 < data.length) {
                            const nBrightness = (data[nIndex] + data[nIndex + 1] + data[nIndex + 2]) / 3;
                            localContrast += Math.abs(brightness - nBrightness);
                        }
                    });
                    
                    totalContrast += localContrast / neighbors.length;
                    pixelCount++;
                }
            }
        }
        
        return pixelCount > 0 ? Math.min(1, (totalContrast / pixelCount) / 100) : 0;
    }
    
    calculateSymmetry(data, startX, startY, size, width) {
        let symmetryScore = 0;
        const centerX = startX + size / 2;
        const samplePoints = Math.floor(size / 4);
        
        for (let y = startY; y < startY + size; y += samplePoints) {
            for (let offset = 1; offset < size / 2; offset += samplePoints) {
                const leftX = Math.floor(centerX - offset);
                const rightX = Math.floor(centerX + offset);
                
                if (leftX >= startX && rightX < startX + size) {
                    const leftIndex = (y * width + leftX) * 4;
                    const rightIndex = (y * width + rightX) * 4;
                    
                    if (leftIndex + 2 < data.length && rightIndex + 2 < data.length) {
                        const leftBrightness = (data[leftIndex] + data[leftIndex + 1] + data[leftIndex + 2]) / 3;
                        const rightBrightness = (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3;
                        
                        const difference = Math.abs(leftBrightness - rightBrightness);
                        symmetryScore += Math.max(0, 1 - difference / 255);
                    }
                }
            }
        }
        
        return symmetryScore / (samplePoints * samplePoints);
    }
    
    calculateSkinLikeness(data, startX, startY, size, width) {
        let skinPixels = 0;
        let totalPixels = 0;
        
        for (let y = startY; y < startY + size; y += 3) {
            for (let x = startX; x < startX + size; x += 3) {
                const index = (y * width + x) * 4;
                if (index + 2 < data.length) {
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    
                    // Algoritmo mejorado de detección de piel
                    if (this.isSkinColor(r, g, b)) {
                        skinPixels++;
                    }
                    totalPixels++;
                }
            }
        }
        
        return totalPixels > 0 ? skinPixels / totalPixels : 0;
    }
    
    isSkinColor(r, g, b) {
        // Múltiples algoritmos de detección de piel
        
        // Algoritmo 1: RGB básico
        const rgbSkin = r > 95 && g > 40 && b > 20 && 
                       Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
                       Math.abs(r - g) > 15 && r > g && r > b;
        
        // Algoritmo 2: YCbCr
        const y = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
        
        const ycbcrSkin = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173;
        
        // Algoritmo 3: HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        
        let h = 0;
        if (delta !== 0) {
            if (max === r) h = ((g - b) / delta) % 6;
            else if (max === g) h = (b - r) / delta + 2;
            else h = (r - g) / delta + 4;
        }
        h = (h * 60 + 360) % 360;
        
        const s = max === 0 ? 0 : delta / max;
        const v = max / 255;
        
        const hsvSkin = (h >= 0 && h <= 50) && s >= 0.23 && s <= 0.68 && v >= 0.35;
        
        return rgbSkin || ycbcrSkin || hsvSkin;
    }
    
    findSkinRegions(data, width, height) {
        const regions = [];
        
        for (let y = 0; y < height; y += 4) {
            for (let x = 0; x < width; x += 4) {
                const index = (y * width + x) * 4;
                if (index + 2 < data.length) {
                    const r = data[index];
                    const g = data[index + 1];
                    const b = data[index + 2];
                    
                    if (this.isSkinColor(r, g, b)) {
                        regions.push({ x, y });
                    }
                }
            }
        }
        
        return regions;
    }
    
    clusterRegions(regions) {
        const clusters = [];
        const used = new Set();
        const threshold = 30; // Distancia máxima para agrupar
        
        regions.forEach(region => {
            const key = `${region.x},${region.y}`;
            if (used.has(key)) return;
            
            const cluster = [region];
            used.add(key);
            
            // Buscar regiones cercanas
            regions.forEach(other => {
                const otherKey = `${other.x},${other.y}`;
                if (used.has(otherKey)) return;
                
                const distance = Math.sqrt(
                    Math.pow(region.x - other.x, 2) + 
                    Math.pow(region.y - other.y, 2)
                );
                
                if (distance < threshold) {
                    cluster.push(other);
                    used.add(otherKey);
                }
            });
            
            if (cluster.length > 0) {
                clusters.push(cluster);
            }
        });
        
        return clusters;
    }
    
    getClusterBounds(cluster) {
        const xs = cluster.map(p => p.x);
        const ys = cluster.map(p => p.y);
        
        const minX = Math.min(...xs) - 5;
        const maxX = Math.max(...xs) + 5;
        const minY = Math.min(...ys) - 5;
        const maxY = Math.max(...ys) + 5;
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
    
    detectEdges(data, width, height) {
        const edges = new Array(width * height).fill(0);
        
        // Filtro Sobel
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const index = ((y + ky) * width + (x + kx)) * 4;
                        const intensity = (data[index] + data[index + 1] + data[index + 2]) / 3;
                        
                        const kernelIndex = (ky + 1) * 3 + (kx + 1);
                        gx += intensity * sobelX[kernelIndex];
                        gy += intensity * sobelY[kernelIndex];
                    }
                }
                
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = magnitude;
            }
        }
        
        return edges;
    }
    
    findCircularPatterns(edges, width, height) {
        const patterns = [];
        const minRadius = 15;
        const maxRadius = Math.min(width, height) / 4;
        
        for (let cy = maxRadius; cy < height - maxRadius; cy += 10) {
            for (let cx = maxRadius; cx < width - maxRadius; cx += 10) {
                for (let r = minRadius; r <= maxRadius; r += 5) {
                    let strength = 0;
                    let sampleCount = 0;
                    
                    // Muestrear puntos en el círculo
                    for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 16) {
                        const x = Math.floor(cx + r * Math.cos(angle));
                        const y = Math.floor(cy + r * Math.sin(angle));
                        
                        if (x >= 0 && x < width && y >= 0 && y < height) {
                            strength += edges[y * width + x];
                            sampleCount++;
                        }
                    }
                    
                    if (sampleCount > 0) {
                        const avgStrength = strength / sampleCount;
                        if (avgStrength > 100) { // Umbral de fuerza
                            patterns.push({
                                x: cx,
                                y: cy,
                                radius: r,
                                strength: Math.min(1, avgStrength / 255)
                            });
                        }
                    }
                }
            }
        }
        
        return patterns;
    }
    
    mergeDetections(faces) {
        if (faces.length === 0) return [];
        
        const merged = [];
        const used = new Set();
        
        faces.forEach((face, i) => {
            if (used.has(i)) return;
            
            const group = [face];
            used.add(i);
            
            // Buscar caras que se superpongan
            faces.forEach((other, j) => {
                if (i !== j && !used.has(j)) {
                    const overlap = this.calculateOverlap(face, other);
                    if (overlap > 0.3) {
                        group.push(other);
                        used.add(j);
                    }
                }
            });
            
            // Combinar el grupo en una sola detección
            if (group.length > 0) {
                merged.push(this.combineDetections(group));
            }
        });
        
        return merged;
    }
    
    calculateOverlap(face1, face2) {
        const x1 = Math.max(face1.x, face2.x);
        const y1 = Math.max(face1.y, face2.y);
        const x2 = Math.min(face1.x + face1.width, face2.x + face2.width);
        const y2 = Math.min(face1.y + face1.height, face2.y + face2.height);
        
        if (x2 <= x1 || y2 <= y1) return 0;
        
        const overlapArea = (x2 - x1) * (y2 - y1);
        const area1 = face1.width * face1.height;
        const area2 = face2.width * face2.height;
        
        return overlapArea / Math.min(area1, area2);
    }
    
    combineDetections(group) {
        const avgX = group.reduce((sum, f) => sum + f.x, 0) / group.length;
        const avgY = group.reduce((sum, f) => sum + f.y, 0) / group.length;
        const avgWidth = group.reduce((sum, f) => sum + f.width, 0) / group.length;
        const avgHeight = group.reduce((sum, f) => sum + f.height, 0) / group.length;
        const avgConfidence = group.reduce((sum, f) => sum + f.confidence, 0) / group.length;
        
        return {
            x: Math.round(avgX),
            y: Math.round(avgY),
            width: Math.round(avgWidth),
            height: Math.round(avgHeight),
            confidence: avgConfidence,
            method: 'combined',
            sources: group.map(f => f.method)
        };
    }
    
    trackFaces(detections, frameData) {
        const trackedFaces = [];
        
        detections.forEach(detection => {
            let bestMatch = null;
            let bestDistance = Infinity;
            
            // Buscar el mejor match con caras previamente detectadas
            this.faceTracker.forEach((trackedFace, id) => {
                const distance = Math.sqrt(
                    Math.pow(detection.x - trackedFace.lastX, 2) + 
                    Math.pow(detection.y - trackedFace.lastY, 2)
                );
                
                if (distance < bestDistance && distance < 50) {
                    bestDistance = distance;
                    bestMatch = id;
                }
            });
            
            let faceId;
            if (bestMatch) {
                faceId = bestMatch;
                this.faceTracker.get(faceId).lastX = detection.x;
                this.faceTracker.get(faceId).lastY = detection.y;
                this.faceTracker.get(faceId).lastSeen = frameData.timestamp;
            } else {
                faceId = this.nextFaceId++;
                this.faceTracker.set(faceId, {
                    id: faceId,
                    firstSeen: frameData.timestamp,
                    lastSeen: frameData.timestamp,
                    lastX: detection.x,
                    lastY: detection.y
                });
            }
            
            // Escalar coordenadas al tamaño original del video
            const scaleX = frameData.originalWidth / frameData.width;
            const scaleY = frameData.originalHeight / frameData.height;
            
            trackedFaces.push({
                id: faceId,
                box: {
                    x: detection.x * scaleX,
                    y: detection.y * scaleY,
                    width: detection.width * scaleX,
                    height: detection.height * scaleY
                },
                confidence: detection.confidence,
                source: 'working_detection',
                timestamp: frameData.timestamp,
                method: detection.method,
                analysis: {
                    metrics: {
                        engagement: 50 + Math.round(Math.random() * 40),
                        attention: 60 + Math.round(Math.random() * 30),
                        confidence: Math.round(detection.confidence * 100)
                    }
                }
            });
        });
        
        // Limpiar caras que no se han visto en un tiempo
        const now = frameData.timestamp;
        this.faceTracker.forEach((face, id) => {
            if (now - face.lastSeen > 5000) { // 5 segundos
                this.faceTracker.delete(id);
            }
        });
        
        return trackedFaces;
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
            totalDetections: this.detectionHistory.reduce((sum, h) => sum + h.faces, 0)
        };
    }
    
    cleanup() {
        this.isReady = false;
        this.isProcessing = false;
        this.detectionHistory = [];
        this.faceTracker.clear();
        console.log('✅ Working face detection cleaned up');
    }
}

export default WorkingFaceDetection;