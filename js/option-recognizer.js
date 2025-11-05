/**
 * 答题卡选项识别器
 * 负责识别填涂的选项和答案
 */
class OptionRecognizer {
    constructor() {
        this.isInitialized = false;
        this.threshold = 0.3; // 填涂识别阈值
        this.minOptionArea = 50; // 最小选项面积
        this.maxOptionArea = 500; // 最大选项面积
        this.optionTemplates = []; // 选项模板
        this.recognizedOptions = []; // 识别的选项
        
        console.log('OptionRecognizer 初始化完成');
        this.isInitialized = true;
    }

    /**
     * 识别填涂选项
     * @param {Image} image - 待识别的图像
     * @returns {Object} - 识别结果
     */
    async recognizeOptions(image) {
        if (!this.isInitialized) {
            throw new Error('OptionRecognizer 未初始化');
        }

        try {
            // 将图像转换为OpenCV Mat格式
            const src = cv.imread(image);
            
            // 转换为灰度图
            const gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            
            // 二值化处理
            const binary = new cv.Mat();
            cv.threshold(gray, binary, 128, 255, cv.THRESH_BINARY_INV);
            
            // 查找轮廓
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // 分析轮廓
            const options = this.analyzeContours(contours, hierarchy);
            
            // 释放内存
            src.delete();
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            
            return {
                success: true,
                options: options,
                count: options.length,
                message: `识别到 ${options.length} 个填涂选项`
            };
            
        } catch (error) {
            console.error('选项识别失败:', error);
            return {
                success: false,
                options: [],
                count: 0,
                message: `识别失败: ${error.message}`
            };
        }
    }

    /**
     * 分析轮廓并识别选项
     * @param {cv.MatVector} contours - 轮廓集合
     * @param {cv.Mat} hierarchy - 轮廓层级
     * @returns {Array} - 识别的选项列表
     */
    analyzeContours(contours, hierarchy) {
        const options = [];
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            
            // 计算轮廓面积
            const area = cv.contourArea(contour);
            
            // 过滤面积过小或过大的轮廓
            if (area < this.minOptionArea || area > this.maxOptionArea) {
                continue;
            }
            
            // 计算轮廓的边界矩形
            const rect = cv.boundingRect(contour);
            
            // 计算轮廓的圆形度
            const perimeter = cv.arcLength(contour, true);
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            // 过滤非圆形轮廓（填涂选项通常是圆形或椭圆形）
            if (circularity < 0.3) {
                continue;
            }
            
            // 添加到选项列表
            options.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                area: area,
                circularity: circularity,
                confidence: Math.min(1.0, area / this.maxOptionArea)
            });
        }
        
        // 按位置排序（从上到下，从左到右）
        options.sort((a, b) => {
            if (Math.abs(a.y - b.y) < 20) {
                return a.x - b.x; // 同一行按x坐标排序
            }
            return a.y - b.y; // 按y坐标排序
        });
        
        return options;
    }

    /**
     * 设置识别阈值
     * @param {number} threshold - 新的阈值（0-1）
     */
    setThreshold(threshold) {
        if (threshold >= 0 && threshold <= 1) {
            this.threshold = threshold;
            console.log(`识别阈值已设置为: ${threshold}`);
        } else {
            console.warn('阈值必须在0-1之间');
        }
    }

    /**
     * 设置选项面积范围
     * @param {number} minArea - 最小面积
     * @param {number} maxArea - 最大面积
     */
    setOptionAreaRange(minArea, maxArea) {
        if (minArea > 0 && maxArea > minArea) {
            this.minOptionArea = minArea;
            this.maxOptionArea = maxArea;
            console.log(`选项面积范围已设置为: ${minArea}-${maxArea}`);
        } else {
            console.warn('最小面积必须大于0，最大面积必须大于最小面积');
        }
    }

    /**
     * 模拟识别过程（用于演示）
     * @param {Image} image - 待识别的图像
     * @returns {Object} - 模拟识别结果
     */
    async simulateRecognition(image) {
        // 模拟处理时间
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 生成模拟选项数据
        const simulatedOptions = [
            { x: 100, y: 150, width: 30, height: 30, area: 700, circularity: 0.8, confidence: 0.9 },
            { x: 200, y: 150, width: 28, height: 28, area: 615, circularity: 0.7, confidence: 0.8 },
            { x: 300, y: 150, width: 32, height: 32, area: 804, circularity: 0.9, confidence: 0.95 },
            { x: 100, y: 250, width: 29, height: 29, area: 660, circularity: 0.75, confidence: 0.85 },
            { x: 200, y: 250, width: 31, height: 31, area: 754, circularity: 0.85, confidence: 0.92 }
        ];
        
        return {
            success: true,
            options: simulatedOptions,
            count: simulatedOptions.length,
            message: `模拟识别完成，找到 ${simulatedOptions.length} 个填涂选项`
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.isInitialized = false;
        this.optionTemplates = [];
        this.recognizedOptions = [];
        console.log('OptionRecognizer 资源已清理');
    }
}

// 导出全局对象
window.OptionRecognizer = OptionRecognizer;