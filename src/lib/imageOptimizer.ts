/**
 * HSTNLX Image Optimization Engine
 * Handles client-side compression and resizing to maintain 
 * high-performance UI on low-end mobile devices.
 */

export const compressImage = async (file: File | Blob, maxWidth = 2048, quality = 0.92): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const tempCanvas = document.createElement('canvas');
                const originalWidth = img.width;
                const originalHeight = img.height;
                const longestEdge = Math.max(originalWidth, originalHeight);

                // Keep original dimensions unless very large (prevents softness on mobile uploads)
                const scale = longestEdge > maxWidth ? maxWidth / longestEdge : 1;
                const width = Math.max(1, Math.round(originalWidth * scale));
                const height = Math.max(1, Math.round(originalHeight * scale));

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error('Canvas context failure'));
                const tempCtx = tempCanvas.getContext('2d');
                if (!tempCtx) return reject(new Error('Canvas context failure'));

                // Highest-quality interpolation to keep details sharp after resize
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                /**
                 * Multi-step downscaling preserves detail better than one-shot resize,
                 * especially for high-res camera images (similar to marketplace pipelines).
                 */
                tempCanvas.width = originalWidth;
                tempCanvas.height = originalHeight;
                tempCtx.imageSmoothingEnabled = true;
                tempCtx.imageSmoothingQuality = "high";
                tempCtx.drawImage(img, 0, 0);

                let currentWidth = originalWidth;
                let currentHeight = originalHeight;

                while (currentWidth * 0.5 > width && currentHeight * 0.5 > height) {
                    currentWidth = Math.max(width, Math.floor(currentWidth * 0.5));
                    currentHeight = Math.max(height, Math.floor(currentHeight * 0.5));

                    const stepCanvas = document.createElement('canvas');
                    stepCanvas.width = currentWidth;
                    stepCanvas.height = currentHeight;
                    const stepCtx = stepCanvas.getContext('2d');
                    if (!stepCtx) return reject(new Error('Canvas context failure'));
                    stepCtx.imageSmoothingEnabled = true;
                    stepCtx.imageSmoothingQuality = "high";
                    stepCtx.drawImage(tempCanvas, 0, 0, currentWidth, currentHeight);
                    tempCanvas.width = currentWidth;
                    tempCanvas.height = currentHeight;
                    tempCtx.drawImage(stepCanvas, 0, 0);
                }

                ctx.drawImage(tempCanvas, 0, 0, width, height);

                // Adaptive quality: preserve details for smaller images, compress large images safely
                const megapixels = (width * height) / 1_000_000;
                const adaptiveQuality = megapixels > 4 ? Math.max(0.88, quality - 0.03) : Math.min(0.95, quality + 0.02);

                canvas.toBlob(
                    (blob) => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failure'));
                    },
                    'image/jpeg',
                    adaptiveQuality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

/**
 * 🛠️ QUALITY AUDIT ENGINE
 * Analyzes frame brightness and contrast to prevent low-conversion uploads.
 */
export async function checkImageQuality(file: Blob): Promise<{ isLowQuality: boolean; warnings: string[] }> {
    return new Promise((resolve) => {
        const img = new Image()
        img.src = URL.createObjectURL(file)
        img.onload = () => {
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")
            if (!ctx) return resolve({ isLowQuality: false, warnings: [] })

            canvas.width = 100
            canvas.height = 100
            ctx.drawImage(img, 0, 0, 100, 100)
            
            const imageData = ctx.getImageData(0, 0, 100, 100)
            const data = imageData.data
            let colorSum = 0

            for (let i = 0; i < data.length; i += 4) {
                const avg = (data[i] + data[i+1] + data[i+2]) / 3
                colorSum += avg
            }

            const brightness = colorSum / (100 * 100)
            const warnings: string[] = []
            
            if (brightness < 45) warnings.push("Image detected as low brightness. Natural light recommended.")
            if (brightness > 230) warnings.push("Image detected as overexposed. Check lighting.")

            resolve({
                isLowQuality: warnings.length > 0,
                warnings
            })
            URL.revokeObjectURL(img.src)
        }
        img.onerror = () => resolve({ isLowQuality: false, warnings: [] })
    })
}

/**
 * 🎨 LUXURY BACKGROUND PROTOCOL
 * Converts transparent PNG (from remove.bg) into a premium white-background JPEG.
 */
export async function addWhiteBackground(base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = "anonymous" // Prevent CORS issues
        img.src = base64Image
        
        img.onload = () => {
            const canvas = document.createElement("canvas")
            const ctx = canvas.getContext("2d")
            if (!ctx) return reject(new Error("Canvas context failure"))

            canvas.width = img.width
            canvas.height = img.height

            // 1. Fill white background
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            // 2. Composite the optimized asset
            ctx.drawImage(img, 0, 0)

            // 3. Export as high-quality JPEG
            const finalImage = canvas.toDataURL("image/jpeg", 0.95)
            resolve(finalImage)
        }
        img.onerror = (err) => reject(err)
    })
}
