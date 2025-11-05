/**
 * 答题卡图像对齐系统主程序
 * 整合图像处理、对齐算法和用户界面交互
 */

class AnswerSheetAlignmentSystem {
    constructor(uiElements = null) {
        this.imageProcessor = null;
        this.aligner = null;
        this.isOpenCVReady = false;
        this.isProcessing = false;
        this.templateLoaded = false;
        this.maskImage = null;
        this.maskOpacity = 0.5; // 默认透明度50%
        
        // UI元素 - 支持测试环境（无UI元素）
        this.uiElements = uiElements || {
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            progressBar: document.getElementById('progressBar'),
            uploadArea: document.getElementById('uploadArea'),
            maskInput: document.getElementById('maskInput'),
            templateStatus: document.getElementById('templateStatus'),
            alignBtn: document.getElementById('alignBtn'),
            recognizeBtn: document.getElementById('recognizeBtn'),
            templateCanvas: document.getElementById('templateCanvas'),
            originalCanvas: document.getElementById('templateCanvas'), // 使用templateCanvas作为原始Canvas
            alignedCanvas: document.getElementById('maskCanvas'), // 使用maskCanvas作为对齐后Canvas
            maskCanvas: document.getElementById('maskCanvas'),
            opacitySlider: document.getElementById('opacitySlider'),
            opacityValue: document.getElementById('opacityValue'),
            messageContainer: document.getElementById('messageContainer')
        };
        
        this.initialize();
    }

    /**
     * 初始化系统
     */
    async initialize() {
        try {
            this.updateStatus('正在初始化系统...', 'processing');
            
            // 等待OpenCV.js加载
            if (typeof cv === 'undefined') {
                this.updateStatus('正在加载OpenCV.js库...', 'processing');
                await this.waitForOpenCV();
            }
            
            // 只在有UI元素时初始化图像处理器
            if (this.uiElements.maskInput || this.uiElements.uploadArea) {
                this.imageProcessor = new ImageProcessor({
                    templateCanvas: this.uiElements.templateCanvas,
                    originalCanvas: this.uiElements.originalCanvas,
                    alignedCanvas: this.uiElements.alignedCanvas
                });
            } else {
                // 测试环境：创建虚拟图像处理器
                this.imageProcessor = {
                    loadUserImage: (file) => {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const img = new Image();
                                img.onload = () => resolve(img);
                                img.onerror = () => reject(new Error('图片加载失败'));
                                img.src = e.target.result;
                            };
                            reader.onerror = () => reject(new Error('文件读取失败'));
                            reader.readAsDataURL(file);
                        });
                    },
                    displayOriginalImage: () => {},
                    displayAlignedImage: () => {},
                    cleanup: () => {}
                };
                console.log('运行在测试模式，使用虚拟图像处理器');
            }
            
            // 初始化对齐器
            this.aligner = new AnswerSheetAligner();
            
            // 系统初始化完成，自动加载模板图片
            this.updateStatus('系统就绪，正在自动加载模板图片...', 'ready');
            this.setupEventListeners();
            
            // 自动加载模板图片
            this.loadAndDisplayTemplateImage();
            
        } catch (error) {
            console.error('系统初始化失败:', error);
            this.updateStatus(`初始化失败: ${error.message}`, 'error');
        }
    }

    /**
     * 等待OpenCV.js加载完成
     */
    waitForOpenCV() {
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    clearInterval(checkInterval);
                    this.isOpenCVReady = true;
                    console.log('OpenCV.js加载完成');
                    if (cv.getBuildInformation) {
                        console.log('OpenCV版本:', cv.getBuildInformation());
                    }
                    resolve();
                }
            }, 100);
            
            // 超时检测
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error('OpenCV.js加载超时'));
            }, 30000);
        });
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 只在有UI元素时设置事件监听器
        if (!this.uiElements.maskInput || !this.uiElements.uploadArea) {
            return;
        }

        // OpenCV加载完成事件
        if (typeof onOpenCVReady === 'function') {
            window.onOpenCVReady = () => {
                this.isOpenCVReady = true;
                this.updateStatus('OpenCV.js 已加载完成', 'ready');
                this.showMessage('OpenCV.js 初始化完成', 'success');
            };
        }

        // 手动加载模板按钮事件
        const loadTemplateBtn = document.getElementById('loadTemplateBtn');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', () => {
                this.loadAndDisplayTemplateImage();
            });
        }

        // 遮罩文件选择事件
        this.uiElements.maskInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleMaskUpload(e.target.files[0]);
            }
        });

        // 对齐按钮事件
        this.uiElements.alignBtn.addEventListener('click', () => {
            this.performAlignment();
        });

        // 识别按钮事件
        if (this.uiElements.recognizeBtn) {
            this.uiElements.recognizeBtn.addEventListener('click', () => {
                this.performRecognition();
            });
        }

        // 透明度滑块事件
        if (this.uiElements.opacitySlider) {
            this.uiElements.opacitySlider.addEventListener('input', (e) => {
                this.maskOpacity = parseInt(e.target.value) / 100;
                this.uiElements.opacityValue.textContent = e.target.value + '%';
                this.updateMaskDisplay();
            });
        }

        // 拖拽事件
        this.uiElements.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uiElements.uploadArea.classList.add('dragover');
        });

        this.uiElements.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            this.uiElements.uploadArea.classList.remove('dragover');
        });

        this.uiElements.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uiElements.uploadArea.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                this.handleMaskUpload(e.dataTransfer.files[0]);
            }
        });

        // 点击上传区域事件
        this.uiElements.uploadArea.addEventListener('click', () => {
            this.uiElements.maskInput.click();
        });

        // 窗口大小变化事件
        window.addEventListener('resize', () => {
            if (this.imageProcessor) {
                this.imageProcessor.resizeCanvas();
            }
        });
    }

    /**
     * 加载模板图片元素（使用Canvas方式）
     * @param {string} imagePath - 模板图片路径
     * @returns {Promise<HTMLImageElement>} - 加载完成的图片元素
     */
    loadTemplateImageElement(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            // 设置跨域属性以避免CORS问题
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (error) => {
                console.error('模板图片加载失败:', error);
                reject(new Error(`模板图片加载失败: ${error.message || '网络错误或文件不存在'}`));
            };
            // 先设置onload/onerror，再设置src
            img.src = imagePath + '?t=' + Date.now(); // 添加时间戳避免缓存
        });
    }

    /**
     * 加载模板图片
     * @param {string} [manualPath] - 手动指定的模板路径
     */
    async loadTemplateImage(manualPath = null) {
        if (this.isProcessing) {
            this.showMessage('系统正在处理中，请稍候...', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            this.updateStatus('正在加载模板图片...', 'processing');
            console.log('开始加载模板图片...');
            
            // 模板图片路径
            const templatePath = manualPath || './images/01.png';
            console.log('模板路径:', templatePath);
            
            // 检查OpenCV是否就绪
            console.log('OpenCV就绪检查:', typeof cv, cv ? cv.Mat ? 'Mat可用' : 'Mat不可用' : 'cv未定义');
            if (typeof cv === 'undefined' || !cv.Mat) {
                // 等待OpenCV加载
                await this.waitForOpenCV();
            }
            
            // 再次检查OpenCV是否就绪
            if (typeof cv === 'undefined' || !cv.Mat) {
                throw new Error('OpenCV.js未加载完成，请刷新页面重试');
            }
            
            this.updateProgress(30);
            
            // 加载模板图片
            console.log('开始加载模板图片元素...');
            const templateImage = await this.loadTemplateImageElement(templatePath);
            console.log('模板图片元素加载完成:', templateImage);
            console.log('图片尺寸:', templateImage.width, 'x', templateImage.height);
            
            // 使用模板图片初始化对齐器
            console.log('开始初始化对齐器...');
            const initSuccess = await this.aligner.initializeWithTemplate(templateImage);
            console.log('对齐器初始化结果:', initSuccess);
            
            if (initSuccess) {
                this.updateProgress(80);
                
                // 显示模板图片
                if (this.imageProcessor && this.imageProcessor.displayOriginalImage) {
                    this.imageProcessor.displayOriginalImage(templateImage);
                }
                
                this.updateProgress(100);
                
                this.templateLoaded = true;
                this.updateTemplateStatus('已加载');
                this.updateStatus('模板加载完成，请上传遮罩图片', 'ready');
                this.showMessage('模板图片加载成功！', 'success');
                
                // 启用对齐按钮
                if (this.uiElements.alignBtn) {
                    this.uiElements.alignBtn.disabled = false;
                }
            } else {
                throw new Error('模板初始化失败');
            }
            
        } catch (error) {
            console.error('模板加载失败:', error);
            this.updateStatus(`模板加载失败: ${error.message}`, 'error');
            this.showMessage(`模板加载失败: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }
    
    drawTemplateToCanvas() {
        if (!this.templateImage || !this.uiElements.templateCanvas) return;
        
        const ctx = this.uiElements.templateCanvas.getContext('2d');
        const canvas = this.uiElements.templateCanvas;
        
        // 清除Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 计算缩放比例，保持图片比例
        const scale = Math.min(canvas.width / this.templateImage.width, 
                              canvas.height / this.templateImage.height);
        const width = this.templateImage.width * scale;
        const height = this.templateImage.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;
        
        // 绘制模板图片
        ctx.drawImage(this.templateImage, x, y, width, height);
    }
    
    /**
     * 使用Canvas直接加载并显示01.png
     */
    loadAndDisplayTemplateImage() {
        const canvas = this.uiElements.templateCanvas;
        if (!canvas) {
            console.error('模板Canvas元素未找到');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('无法获取Canvas上下文');
            return;
        }
        
        // 创建图片对象
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 避免跨域问题
        
        img.onload = () => {
            console.log('01.png加载成功:', img.width, 'x', img.height);
            
            // 清除Canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // 计算缩放比例，保持图片比例
            const scale = Math.min(
                canvas.width / img.width,
                canvas.height / img.height
            );
            
            const displayWidth = img.width * scale;
            const displayHeight = img.height * scale;
            const x = (canvas.width - displayWidth) / 2;
            const y = (canvas.height - displayHeight) / 2;
            
            // 绘制图片
            ctx.drawImage(img, x, y, displayWidth, displayHeight);
            
            // 保存图片引用
            this.templateImage = img;
            this.templateLoaded = true;
            
            console.log('01.png已成功显示在Canvas上');
        };
        
        img.onerror = (error) => {
            console.error('01.png加载失败:', error);
            // 显示错误信息
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ff0000';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('01.png加载失败', canvas.width / 2, canvas.height / 2);
        };
        
        // 加载图片
        img.src = './images/01.png';
    }

    updateMaskDisplay() {
        if (!this.maskImage || !this.uiElements.maskCanvas) return;
        
        const ctx = this.uiElements.maskCanvas.getContext('2d');
        const canvas = this.uiElements.maskCanvas;
        
        // 清除Canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // 设置透明度
        ctx.globalAlpha = this.maskOpacity;
        
        // 计算缩放比例，保持图片比例
        const scale = Math.min(canvas.width / this.maskImage.width, 
                              canvas.height / this.maskImage.height);
        const width = this.maskImage.width * scale;
        const height = this.maskImage.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;
        
        // 绘制遮罩图片
        ctx.drawImage(this.maskImage, x, y, width, height);
        
        // 重置透明度
        ctx.globalAlpha = 1.0;
    }

    /**
     * 处理遮罩图片上传
     * @param {File} file - 上传的遮罩文件
     */
    async handleMaskUpload(file) {
        if (this.isProcessing) {
            this.showMessage('系统正在处理中，请稍候...', 'warning');
            return;
        }

        if (!this.templateLoaded) {
            this.showMessage('请先加载模板图片', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            this.updateStatus('正在处理遮罩图片...', 'processing');
            
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                throw new Error('请上传图片文件（JPG、PNG、BMP格式）');
            }

            // 验证文件大小（最大10MB）
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('图片文件过大，请上传小于10MB的图片');
            }

            this.updateProgress(10);
            
            // 加载遮罩图片
            const maskImage = await this.imageProcessor.loadUserImage(file);
            this.updateProgress(30);
            
            // 显示原始遮罩图片
            this.imageProcessor.displayOriginalImage(maskImage);
            this.updateProgress(50);
            
            // 保存遮罩图片用于对齐
            this.maskImage = maskImage;
            
            // 更新遮罩显示
            this.updateMaskDisplay();
            
            this.updateProgress(100);
            this.updateStatus('遮罩图片加载完成，可以执行对齐', 'ready');
            this.showMessage('遮罩图片加载成功！', 'success');
            
        } catch (error) {
            console.error('遮罩图片处理失败:', error);
            this.updateStatus(`遮罩处理失败: ${error.message}`, 'error');
            this.showMessage(`遮罩处理失败: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 执行图像对齐
     */
    async performAlignment() {
        if (this.isProcessing) {
            this.showMessage('系统正在处理中，请稍候...', 'warning');
            return;
        }

        if (!this.templateLoaded) {
            this.showMessage('请先加载模板图片', 'warning');
            return;
        }

        if (!this.maskImage) {
            this.showMessage('请先上传遮罩图片', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            this.updateStatus('正在执行图像对齐...', 'processing');
            
            this.updateProgress(20);
            
            // 执行图像对齐
            const alignmentResult = await this.aligner.alignUserImage(this.maskImage);
            this.updateProgress(70);
            
            if (alignmentResult.success) {
                // 显示对齐后的图片
                this.imageProcessor.displayAlignedImage(alignmentResult.alignedImage);
                this.updateProgress(100);
                
                this.updateStatus('图像对齐完成！', 'ready');
                this.showMessage('答题卡图像对齐成功！', 'success');
                
            } else {
                throw new Error('图像对齐失败');
            }
            
        } catch (error) {
            console.error('图像对齐失败:', error);
            this.updateStatus(`对齐失败: ${error.message}`, 'error');
            this.showMessage(`对齐失败: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 执行选项识别
     */
    async performRecognition() {
        if (this.isProcessing) {
            this.showMessage('系统正在处理中，请稍候...', 'warning');
            return;
        }

        if (!this.templateLoaded) {
            this.showMessage('请先加载模板图片', 'warning');
            return;
        }

        if (!this.maskImage) {
            this.showMessage('请先上传遮罩图片', 'warning');
            return;
        }

        try {
            this.isProcessing = true;
            this.updateStatus('正在识别填涂选项...', 'processing');
            
            this.updateProgress(10);
            
            // 检查是否已对齐
            if (!this.aligner.isAligned) {
                this.showMessage('检测到图像未对齐，先执行对齐操作', 'warning');
                this.updateProgress(30);
                
                // 先执行对齐
                await this.performAlignment();
                this.updateProgress(50);
            }
            
            // 模拟识别过程
            this.updateProgress(60);
            
            // 创建识别器实例（如果不存在）
            if (!this.recognizer) {
                this.recognizer = new OptionRecognizer();
            }
            
            this.updateProgress(70);
            
            // 执行选项识别（使用模拟识别）
            const recognitionResult = await this.recognizer.simulateRecognition(this.maskImage);
            this.updateProgress(90);
            
            if (recognitionResult.success) {
                // 显示识别结果
                this.visualizeRecognitionResults(recognitionResult);
                this.updateProgress(100);
                
                this.updateStatus('选项识别完成！', 'ready');
                this.showMessage(`识别完成！找到 ${recognitionResult.options.length} 个填涂选项`, 'success');
                
            } else {
                throw new Error('选项识别失败');
            }
            
        } catch (error) {
            console.error('选项识别失败:', error);
            this.updateStatus(`识别失败: ${error.message}`, 'error');
            this.showMessage(`识别失败: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * 可视化识别结果
     * @param {Object} recognitionResult - 识别结果
     */
    visualizeRecognitionResults(recognitionResult) {
        if (!this.uiElements.maskCanvas) return;
        
        const canvas = this.uiElements.maskCanvas;
        const ctx = canvas.getContext('2d');
        
        // 清除之前的标记
        this.updateMaskDisplay();
        
        // 绘制识别结果标记
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        
        recognitionResult.options.forEach((option, index) => {
            // 绘制选项框
            ctx.beginPath();
            ctx.rect(option.x, option.y, option.width, option.height);
            ctx.stroke();
            ctx.fill();
            
            // 绘制选项编号
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Arial';
            ctx.fillText(`${index + 1}`, option.x + 5, option.y + 20);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
        });
    }

    /**
     * 更新模板状态显示
     * @param {string} status - 状态文本
     */
    updateTemplateStatus(status) {
        if (this.uiElements.templateStatus) {
            this.uiElements.templateStatus.textContent = status;
            
            // 根据状态设置样式
            if (status === '已加载') {
                this.uiElements.templateStatus.className = 'status-ready';
            } else {
                this.uiElements.templateStatus.className = 'status-pending';
            }
        }
    }

    updateAlignButtonState() {
        if (this.uiElements.alignBtn) {
            this.uiElements.alignBtn.disabled = !(this.templateLoaded && this.maskImage && this.isOpenCVReady);
        }
    }
    
    updateRecognizeButtonState() {
        if (this.uiElements.recognizeBtn) {
            this.uiElements.recognizeBtn.disabled = !(this.templateLoaded && this.maskImage && this.isOpenCVReady);
        }
    }

    /**
     * 显示消息
     * @param {string} message - 消息内容
     * @param {string} type - 消息类型（success, error, warning, info）
     */
    showMessage(message, type = 'info') {
        if (this.uiElements.messageArea) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message message-${type}`;
            messageDiv.textContent = message;
            
            this.uiElements.messageArea.appendChild(messageDiv);
            
            // 3秒后自动移除消息
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.parentNode.removeChild(messageDiv);
                }
            }, 3000);
        }
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    /**
     * 更新状态显示
     * @param {string} text - 状态文本
     * @param {string} type - 状态类型（ready, processing, error）
     */
    updateStatus(text, type = 'ready') {
        if (this.uiElements.statusText) {
            this.uiElements.statusText.textContent = text;
            this.uiElements.statusText.className = `status-${type}`;
        }
    }

    /**
     * 更新进度条
     * @param {number} percentage - 进度百分比（0-100）
     */
    updateProgress(percentage) {
        if (this.uiElements.progressBar) {
            this.uiElements.progressBar.style.width = `${percentage}%`;
        }
        
        if (this.uiElements.progressText) {
            this.uiElements.progressText.textContent = `${percentage}%`;
        }
    }

    /**
     * 获取系统状态信息
     * @returns {Object} - 系统状态信息
     */
    getSystemStatus() {
        return {
            openCVReady: this.isOpenCVReady,
            alignerInitialized: this.aligner ? this.aligner.isInitialized : false,
            isProcessing: this.isProcessing,
            templateSize: this.aligner ? this.aligner.templateSize : null
        };
    }

    /**
     * 清理系统资源
     */
    cleanup() {
        if (this.aligner) {
            this.aligner.cleanup();
        }
        if (this.imageProcessor) {
            this.imageProcessor.cleanup();
        }
        
        this.updateStatus('系统已清理', 'ready');
        this.updateProgress(0);
    }
}

// 全局函数：OpenCV.js加载完成回调
function onOpenCVReady() {
    console.log('OpenCV.js脚本加载完成');
}

// 页面加载完成后初始化系统
document.addEventListener('DOMContentLoaded', () => {
    // 初始化系统
    window.alignmentSystem = new AnswerSheetAlignmentSystem();
});

// 导出全局对象
window.AnswerSheetAlignmentSystem = AnswerSheetAlignmentSystem;