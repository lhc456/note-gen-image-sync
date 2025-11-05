/**
 * 图像处理器模块
 * 负责图像加载、转换、显示和资源管理
 */

class ImageProcessor {
    constructor(canvasElements = null) {
        // 延迟获取Canvas元素，确保DOM已加载
        setTimeout(() => {
            // 支持传入canvas元素，用于测试环境
            if (canvasElements) {
                this.originalCanvas = canvasElements.originalCanvas;
                this.alignedCanvas = canvasElements.alignedCanvas;
            } else {
                // 默认从DOM获取
                this.originalCanvas = document.getElementById('templateCanvas');
                this.alignedCanvas = document.getElementById('maskCanvas');
            }
            
            // 检查canvas元素是否存在
            if (this.originalCanvas && this.alignedCanvas) {
                this.originalCtx = this.originalCanvas.getContext('2d');
                this.alignedCtx = this.alignedCanvas.getContext('2d');
                
                // 设置Canvas尺寸
                this.setupCanvas();
            } else {
                // 测试环境：创建虚拟canvas
                this.originalCtx = null;
                this.alignedCtx = null;
                console.warn('Canvas元素未找到，运行在测试模式');
            }
        }, 100);
    }

    /**
     * 设置Canvas尺寸和样式
     */
    setupCanvas() {
        if (!this.originalCanvas || !this.alignedCanvas) {
            return; // 测试环境跳过
        }
        
        const containerWidth = this.originalCanvas.parentElement.clientWidth;
        const containerHeight = this.originalCanvas.parentElement.clientHeight;
        
        // 设置Canvas尺寸
        this.originalCanvas.width = containerWidth - 40; // 减去padding
        this.originalCanvas.height = containerHeight - 40;
        this.alignedCanvas.width = containerWidth - 40;
        this.alignedCanvas.height = containerHeight - 40;
        
        // 设置Canvas样式
        this.originalCtx.fillStyle = '#f5f5f5';
        this.originalCtx.fillRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        this.alignedCtx.fillStyle = '#f5f5f5';
        this.alignedCtx.fillRect(0, 0, this.alignedCanvas.width, this.alignedCanvas.height);
        
        // 绘制提示文字
        this.drawPlaceholderText();
    }

    /**
     * 绘制Canvas占位文字
     */
    drawPlaceholderText() {
        if (!this.originalCtx || !this.alignedCtx) {
            return; // 测试环境跳过
        }
        
        const drawText = (ctx, canvas, text) => {
            ctx.fillStyle = '#999';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        };
        
        drawText(this.originalCtx, this.originalCanvas, '原始图片将显示在这里');
        drawText(this.alignedCtx, this.alignedCanvas, '对齐后图片将显示在这里');
    }

    /**
     * 加载用户上传的图片
     * @param {File} file - 用户上传的文件
     * @returns {Promise<HTMLImageElement>} - 加载的图片元素
     */
    loadUserImage(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('请上传有效的图片文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    resolve(img);
                };
                img.onerror = () => {
                    reject(new Error('图片加载失败'));
                };
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('文件读取失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 在Canvas上显示图片
     * @param {HTMLImageElement|HTMLCanvasElement} image - 要显示的图片
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {HTMLCanvasElement} canvas - Canvas元素
     */
    displayImage(image, ctx, canvas) {
        if (!ctx || !canvas) {
            return; // 测试环境跳过
        }
        
        // 清除Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 计算缩放比例，保持图片比例
        const scale = Math.min(
            canvas.width / image.width,
            canvas.height / image.height
        );
        
        const displayWidth = image.width * scale;
        const displayHeight = image.height * scale;
        
        // 居中显示
        const x = (canvas.width - displayWidth) / 2;
        const y = (canvas.height - displayHeight) / 2;
        
        // 绘制图片
        ctx.drawImage(image, x, y, displayWidth, displayHeight);
        
        // 绘制边框
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, displayWidth, displayHeight);
    }

    /**
     * 显示原始图片
     * @param {HTMLImageElement} image - 原始图片
     */
    displayOriginalImage(image) {
        this.displayImage(image, this.originalCtx, this.originalCanvas);
    }

    /**
     * 显示对齐后的图片
     * @param {cv.Mat} alignedMat - 对齐后的OpenCV矩阵
     */
    displayAlignedImage(alignedMat) {
        // 将OpenCV Mat转换为Canvas图像
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = alignedMat.cols;
        tempCanvas.height = alignedMat.rows;
        
        cv.imshow(tempCanvas, alignedMat);
        
        // 显示在目标Canvas上
        this.displayImage(tempCanvas, this.alignedCtx, this.alignedCanvas);
    }

    /**
     * 显示模板图片
     * @param {ImageData} templateImageData 模板图片数据
     */
    displayTemplateImage(templateImageData) {
        // 检查Canvas元素是否存在
        if (!this.originalCanvas) {
            console.warn('Canvas元素未找到，运行在测试模式');
            return;
        }

        // 获取Canvas上下文
        const ctx = this.originalCanvas.getContext('2d');
        if (!ctx) {
            console.warn('Canvas上下文不存在，跳过模板图片显示');
            return;
        }

        // 清空画布
        ctx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        
        // 绘制模板图片
        if (templateImageData) {
            ctx.putImageData(templateImageData, 0, 0);
        }
    }

    /**
     * 绘制模板占位文字
     */
    drawTemplatePlaceholderText() {
        if (!this.alignedCtx || !this.alignedCanvas) {
            return; // 测试环境跳过
        }
        
        // 清除对齐Canvas
        this.alignedCtx.clearRect(0, 0, this.alignedCanvas.width, this.alignedCanvas.height);
        this.alignedCtx.fillStyle = '#f5f5f5';
        this.alignedCtx.fillRect(0, 0, this.alignedCanvas.width, this.alignedCanvas.height);
        
        // 绘制新的提示文字
        this.alignedCtx.fillStyle = '#999';
        this.alignedCtx.font = '16px Arial';
        this.alignedCtx.textAlign = 'center';
        this.alignedCtx.textBaseline = 'middle';
        this.alignedCtx.fillText('对齐后图片将显示在这里', this.alignedCanvas.width / 2, this.alignedCanvas.height / 2);
    }

    /**
     * 将OpenCV Mat转换为ImageData
     * @param {cv.Mat} mat - OpenCV矩阵
     * @returns {ImageData} - ImageData对象
     */
    matToImageData(mat) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = mat.cols;
        tempCanvas.height = mat.rows;
        
        const tempCtx = tempCanvas.getContext('2d');
        cv.imshow(tempCanvas, mat);
        
        return tempCtx.getImageData(0, 0, mat.cols, mat.rows);
    }

    /**
     * 将ImageData转换为OpenCV Mat
     * @param {ImageData} imageData - ImageData对象
     * @returns {cv.Mat} - OpenCV矩阵
     */
    imageDataToMat(imageData) {
        const mat = new cv.Mat(imageData.height, imageData.width, cv.CV_8UC4);
        mat.data.set(imageData.data);
        return mat;
    }

    /**
     * 调整Canvas尺寸（响应式）
     */
    resizeCanvas() {
        this.setupCanvas();
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清除Canvas内容
        this.originalCtx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        this.alignedCtx.clearRect(0, 0, this.alignedCanvas.width, this.alignedCanvas.height);
        
        // 重新绘制占位文字
        this.drawPlaceholderText();
    }

    /**
     * 获取图片信息
     * @param {HTMLImageElement} image - 图片元素
     * @returns {Object} - 图片信息
     */
    getImageInfo(image) {
        return {
            width: image.width,
            height: image.height,
            aspectRatio: image.width / image.height,
            size: `${(image.width * image.height / 1000000).toFixed(2)} MP`
        };
    }

    /**
     * 在Canvas上绘制处理标记
     * @param {Array} points - 特征点数组
     * @param {string} color - 标记颜色
     */
    drawFeaturePoints(points, color = '#ff0000') {
        const ctx = this.originalCtx;
        const canvas = this.originalCanvas;
        
        // 计算缩放比例和偏移量
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (image.data[0] === 0) return; // 如果没有图片，不绘制
        
        points.forEach(point => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
            ctx.fill();
            
            // 绘制标记文字
            ctx.fillStyle = '#000';
            ctx.font = '12px Arial';
            ctx.fillText(`(${Math.round(point.x)}, ${Math.round(point.y)})`, point.x + 8, point.y - 8);
        });
    }
}

// 导出模块
window.ImageProcessor = ImageProcessor;