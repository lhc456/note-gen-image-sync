/**
 * 答题卡图像对齐模块
 * 基于OpenCV.js实现答题卡图像的特征匹配和透视变换对齐
 */

class AnswerSheetAligner {
    constructor() {
        this.templateImage = null;
        this.templatePoints = [];
        this.templateSize = { width: 0, height: 0 };
        this.isInitialized = false;
    }

    /**
     * 使用模板图片初始化对齐器
     * @param {HTMLImageElement} templateImage - 模板图片元素
     * @returns {Promise<boolean>} - 初始化是否成功
     */
    async initializeWithTemplate(templateImage) {
        try {
            console.log('正在初始化答题卡对齐模块...');
            console.log('模板图片:', templateImage);
            console.log('模板图片尺寸:', templateImage.width, 'x', templateImage.height);
            
            // 检查OpenCV是否就绪
            console.log('OpenCV状态检查:', typeof cv, cv ? '已加载' : '未加载');
            if (typeof cv !== 'undefined' && cv) {
                console.log('cv.Mat状态:', typeof cv.Mat, cv.Mat ? '可用' : '不可用');
                if (cv.Mat) {
                    console.log('cv版本信息:', cv.getVersionString ? cv.getVersionString() : '未知');
                }
            }
            
            // 更详细的OpenCV功能检查
            if (typeof cv === 'undefined') {
                throw new Error('OpenCV.js完全未加载');
            }
            
            if (!cv.Mat) {
                throw new Error('cv.Mat构造函数不可用');
            }
            
            // 检查必要的OpenCV函数
            const requiredFunctions = ['imread', 'Mat', 'cvtColor', 'threshold', 'Canny', 'HoughLinesP'];
            const missingFunctions = requiredFunctions.filter(func => !cv[func]);
            if (missingFunctions.length > 0) {
                throw new Error(`缺少必要的OpenCV函数: ${missingFunctions.join(', ')}`);
            }
            
            if (typeof cv === 'undefined' || !cv.Mat) {
                throw new Error('OpenCV.js未加载完成');
            }
            
            // 记录模板尺寸
            this.templateSize = {
                width: templateImage.width,
                height: templateImage.height
            };
            console.log(`模板尺寸: ${this.templateSize.width} x ${this.templateSize.height}`);
            
            // 将模板图片转换为OpenCV Mat格式
            console.log('开始将模板图片转换为OpenCV Mat格式...');
            console.log('传入的templateImage对象:', templateImage);
            console.log('templateImage类型:', typeof templateImage);
            if (templateImage && templateImage.tagName) {
                console.log('templateImage标签名:', templateImage.tagName);
            }
            
            let templateMat = null;
            try {
                console.log('调用cv.imread前检查:', templateImage ? '有图像对象' : '无图像对象');
                templateMat = cv.imread(templateImage);
                console.log('模板Mat创建成功:', templateMat ? '成功' : '失败');
                if (templateMat) {
                    console.log('模板Mat尺寸:', templateMat.cols, 'x', templateMat.rows, '通道数:', templateMat.channels());
                    console.log('模板Mat类型:', templateMat.type());
                }
            } catch (readError) {
                console.error('cv.imread执行失败:', readError);
                console.error('cv.imread错误详情:', readError.message, readError.stack);
                throw new Error(`图像读取失败: ${readError.message}`);
            }
            
            // 预处理模板图像
            console.log('开始预处理模板图像...');
            let binaryTemplate = null;
            try {
                binaryTemplate = this.preprocessImage(templateMat);
                console.log('预处理完成:', binaryTemplate ? '成功' : '失败');
            } catch (preprocessError) {
                console.error('预处理失败:', preprocessError);
                throw new Error(`图像预处理失败: ${preprocessError.message}`);
            }
            
            // 检测模板特征点
            console.log('开始检测模板特征点...');
            let templateResult = null;
            try {
                templateResult = this.findLinesAndPoints(binaryTemplate);
                console.log('特征点检测完成:', templateResult);
            } catch (detectionError) {
                console.error('特征点检测失败:', detectionError);
                throw new Error(`特征点检测失败: ${detectionError.message}`);
            }
            
            if (!templateResult.success || templateResult.points.length < 4) {
                console.warn('模板特征点检测失败，尝试降级方案...');
                
                // 降级方案：使用图像四角作为特征点
                const fallbackPoints = this.getFallbackPoints(templateMat);
                this.templatePoints = fallbackPoints;
            } else {
                this.templatePoints = templateResult.points;
            }
            
            // 清理OpenCV资源
            templateMat.delete();
            binaryTemplate.delete();
            
            this.isInitialized = true;
            
            console.log(`检测到 ${this.templatePoints.length} 个模板特征点`);
            return true;

        } catch (error) {
            console.error('初始化失败:', error);
            console.error('错误堆栈:', error.stack);
            this.isInitialized = false;
            return false;
        }
    }

    /**
     * 对齐用户上传的答题卡图像
     * @param {HTMLImageElement|HTMLCanvasElement} userImageElement - 用户上传的图片元素
     * @returns {Promise<{success: boolean, alignedImage: cv.Mat|null, error: string|null}>}
     */
    async alignUserImage(userImageElement) {
        if (!this.isInitialized) {
            return { success: false, alignedImage: null, error: '对齐模块未初始化' };
        }

        try {
            console.log('开始对齐用户图像...');
            
            // 将用户图像转换为OpenCV Mat格式
            const srcMat = cv.imread(userImageElement);
            
            // 预处理用户图像
            const binarySrc = this.preprocessImage(srcMat);
            
            // 检测用户图像特征点
            const srcResult = this.findLinesAndPoints(binarySrc);
            
            if (!srcResult.success || srcResult.points.length < 4) {
                console.warn('特征点检测失败，尝试降级方案...');
                
                // 降级方案：基于外框轮廓的校正
                const fallbackResult = this.fallbackAlignment(srcMat);
                if (!fallbackResult.success) {
                    throw new Error('图像对齐失败，请重新拍摄清晰的答题卡图片');
                }
                
                return fallbackResult;
            }

            console.log(`检测到 ${srcResult.points.length} 个用户图像特征点`);

            // 计算透视变换矩阵
            const M = this.calculatePerspectiveTransform(srcResult.points, this.templatePoints);
            
            // 执行透视变换
            const alignedImg = new cv.Mat();
            cv.warpPerspective(
                srcMat, 
                alignedImg, 
                M, 
                new cv.Size(this.templateSize.width, this.templateSize.height)
            );

            // 释放中间资源
            srcMat.delete();
            binarySrc.delete();
            M.delete();

            console.log('图像对齐完成');
            return { success: true, alignedImage: alignedImg, error: null };

        } catch (error) {
            console.error('图像对齐过程中出错:', error);
            return { success: false, alignedImage: null, error: error.message };
        }
    }

    /**
     * 图像预处理：灰度化、二值化、去噪
     * @param {cv.Mat} srcMat - 源图像矩阵
     * @returns {cv.Mat} - 预处理后的二值图像
     */
    preprocessImage(srcMat) {
        console.log('开始预处理图像...');
        console.log('输入srcMat:', srcMat);
        console.log('输入srcMat类型:', srcMat ? typeof srcMat : 'null');
        if (srcMat) {
            console.log('输入srcMat尺寸:', srcMat.cols, 'x', srcMat.rows, '通道数:', srcMat.channels());
        }
        
        let gray = null;
        let binary = null;
        let binaryResults = [];
        
        try {
            // 检查输入参数
            if (!srcMat) {
                throw new Error('输入图像Mat为空');
            }
            
            if (!srcMat.cols || !srcMat.rows) {
                throw new Error('输入图像Mat尺寸无效');
            }
            
            console.log('开始转换为灰度图...');
            // 转换为灰度图
            gray = new cv.Mat();
            console.log('创建gray Mat成功');
            
            if (srcMat.channels() === 3) {
                console.log('调用cvtColor RGB2GRAY...');
                cv.cvtColor(srcMat, gray, cv.COLOR_RGB2GRAY);
            } else if (srcMat.channels() === 4) {
                console.log('调用cvtColor RGBA2GRAY...');
                cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
            } else {
                console.log('克隆原图作为灰度图...');
                gray = srcMat.clone();
            }
            console.log('灰度转换完成，结果尺寸:', gray.cols, 'x', gray.rows);

            console.log('开始应用阈值处理...');
            // 使用多种阈值方法尝试二值化

            // 方法1: OTSU阈值
            console.log('创建binary1 Mat...');
            let binary1 = new cv.Mat();
            console.log('创建binary1 Mat成功');
            console.log('调用threshold OTSU...');
            cv.threshold(gray, binary1, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
            binaryResults.push(binary1);
            console.log('OTSU阈值处理完成');

            // 方法2: 自适应阈值
            let binary2 = new cv.Mat();
            console.log('创建binary2 Mat成功');
            cv.adaptiveThreshold(gray, binary2, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
            binaryResults.push(binary2);
            console.log('自适应阈值处理完成');

            // 方法3: 固定阈值
            let binary3 = new cv.Mat();
            console.log('创建binary3 Mat成功');
            cv.threshold(gray, binary3, 128, 255, cv.THRESH_BINARY);
            binaryResults.push(binary3);
            console.log('固定阈值处理完成');

            // 选择最佳的二值化结果（基于轮廓数量和质量）
            console.log('开始选择最佳二值化结果...');
            binary = this.selectBestBinary(binaryResults, gray);
            console.log('最佳二值化结果选择完成');

            return binary;

        } catch (error) {
            console.error('预处理过程中发生错误:', error);
            console.error('预处理错误堆栈:', error.stack);
            throw error;
        } finally {
            // 确保资源清理
            console.log('清理资源...');
            try {
                if (gray) gray.delete();
                binaryResults.forEach(mat => {
                    if (mat && mat !== binary) {
                        try {
                            mat.delete();
                        } catch (e) {
                            console.warn('释放binary Mat失败:', e);
                        }
                    }
                });
            } catch (cleanupError) {
                console.warn('资源清理过程中发生错误:', cleanupError);
            }
            console.log('资源清理完成');
        }
    }

    /**
     * 选择最佳的二值化结果
     * @param {Array<cv.Mat>} binaryResults - 二值化结果数组
     * @param {cv.Mat} gray - 灰度图像
     * @returns {cv.Mat} - 最佳二值化结果
     */
    selectBestBinary(binaryResults, gray) {
        console.log('开始选择最佳二值化结果，输入数量:', binaryResults.length);
        
        let bestBinary = null;
        let bestScore = -1;
        let contours = null;
        let hierarchy = null;
        
        try {
            // 为每个二值化结果计算分数
            for (let i = 0; i < binaryResults.length; i++) {
                const binary = binaryResults[i];
                console.log(`评估第${i + 1}个二值化结果...`);
                
                try {
                    // 计算轮廓
                    contours = new cv.MatVector();
                    hierarchy = new cv.Mat();
                    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
                    
                    // 计算有效轮廓数量（面积大于阈值的轮廓）
                    let validContourCount = 0;
                    const minContourArea = 10; // 最小轮廓面积阈值
                    
                    for (let j = 0; j < contours.size(); j++) {
                        const contour = contours.get(j);
                        const area = cv.contourArea(contour);
                        if (area > minContourArea) {
                            validContourCount++;
                        }
                        contour.delete();
                    }
                    
                    console.log(`第${i + 1}个结果的有效轮廓数:`, validContourCount);
                    
                    // 简单评分：有效轮廓数量越多越好
                    const score = validContourCount;
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestBinary = binary;
                        console.log(`更新最佳结果，当前最佳分数:`, bestScore);
                    }
                    
                } catch (error) {
                    console.warn(`评估第${i + 1}个二值化结果时发生错误:`, error);
                }
            }
            
            console.log('选择完成，最佳分数:', bestScore);
            return bestBinary ? bestBinary.clone() : binaryResults[0].clone();
            
        } finally {
            // 确保资源清理
            try {
                if (contours) contours.delete();
                if (hierarchy) hierarchy.delete();
            } catch (cleanupError) {
                console.warn('selectBestBinary资源清理过程中发生错误:', cleanupError);
            }
        }
    }

    /**
     * 检测直线和特征点
     * @param {cv.Mat} binaryImage - 二值图像
     * @returns {{success: boolean, points: Array}} - 检测结果
     */
    findLinesAndPoints(binaryImage) {
        try {
            const points = [];
            
            // 方法1: 霍夫直线检测
            const linesP = new cv.Mat();
            cv.HoughLinesP(
                binaryImage, 
                linesP, 
                1, 
                Math.PI / 180, 
                50, 
                50, 
                10
            );

            // 从直线中提取交点作为特征点
            const linePoints = [];
            for (let i = 0; i < linesP.rows; ++i) {
                const x1 = linesP.data32F[i * 4];
                const y1 = linesP.data32F[i * 4 + 1];
                const x2 = linesP.data32F[i * 4 + 2];
                const y2 = linesP.data32F[i * 4 + 3];
                
                linePoints.push({ x: x1, y: y1 });
                linePoints.push({ x: x2, y: y2 });
            }
            linesP.delete();

            // 方法2: 轮廓检测
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(binaryImage, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // 从轮廓中提取角点
            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                // 过滤掉太小的轮廓
                if (area > 100) {
                    const approx = new cv.Mat();
                    cv.approxPolyDP(contour, approx, 0.02 * cv.arcLength(contour, true), true);
                    
                    // 如果是四边形，提取四个角点
                    if (approx.rows === 4) {
                        for (let j = 0; j < 4; j++) {
                            const x = approx.data32S[j * 2];
                            const y = approx.data32S[j * 2 + 1];
                            points.push({ x, y });
                        }
                    }
                    
                    approx.delete();
                }
                contour.delete();
            }

            contours.delete();
            hierarchy.delete();

            // 合并所有检测到的点，并去重
            const allPoints = [...points, ...linePoints];
            const uniquePoints = this.removeDuplicatePoints(allPoints, 10); // 10像素内的点视为重复

            return {
                success: uniquePoints.length >= 4,
                points: uniquePoints
            };

        } catch (error) {
            console.error('特征点检测失败:', error);
            return { success: false, points: [] };
        }
    }

    /**
     * 降级对齐方案：基于外框轮廓的校正
     * @param {cv.Mat} srcMat - 源图像
     * @returns {{success: boolean, alignedImage: cv.Mat|null, error: string|null}}
     */
    fallbackAlignment(srcMat) {
        try {
            console.log('使用降级对齐方案...');
            
            // 查找最大的轮廓（答题卡外框）
            const gray = new cv.Mat();
            cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
            
            const binary = new cv.Mat();
            cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
            
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            let maxArea = 0;
            let maxContour = null;
            
            for (let i = 0; i < contours.size(); ++i) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                
                if (area > maxArea) {
                    maxArea = area;
                    maxContour = contour;
                }
            }
            
            if (!maxContour || maxArea < (srcMat.rows * srcMat.cols) * 0.1) {
                throw new Error('未找到有效的答题卡轮廓');
            }
            
            // 近似多边形
            const approx = new cv.Mat();
            cv.approxPolyDP(maxContour, approx, 0.02 * cv.arcLength(maxContour, true), true);
            
            if (approx.rows !== 4) {
                throw new Error('答题卡轮廓不是四边形');
            }
            
            // 提取四个角点
            const srcPoints = [];
            for (let i = 0; i < 4; i++) {
                const x = approx.data32S[i * 2];
                const y = approx.data32S[i * 2 + 1];
                srcPoints.push({ x, y });
            }
            
            // 排序角点（左上、右上、右下、左下）
            const sortedPoints = this.sortCorners(srcPoints);
            
            // 目标点（模板尺寸）
            const dstPoints = [
                { x: 0, y: 0 },
                { x: this.templateSize.width, y: 0 },
                { x: this.templateSize.width, y: this.templateSize.height },
                { x: 0, y: this.templateSize.height }
            ];
            
            // 计算透视变换
            const M = this.calculatePerspectiveTransform(sortedPoints, dstPoints);
            
            // 执行变换
            const alignedImg = new cv.Mat();
            cv.warpPerspective(
                srcMat, 
                alignedImg, 
                M, 
                new cv.Size(this.templateSize.width, this.templateSize.height)
            );
            
            // 清理资源
            gray.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();
            approx.delete();
            M.delete();
            
            return { success: true, alignedImage: alignedImg, error: null };
            
        } catch (error) {
            console.error('降级对齐失败:', error);
            return { success: false, alignedImage: null, error: error.message };
        }
    }

    /**
     * 计算透视变换矩阵
     * @param {Array} srcPoints - 源图像点
     * @param {Array} dstPoints - 目标图像点
     * @returns {cv.Mat} - 透视变换矩阵
     */
    calculatePerspectiveTransform(srcPoints, dstPoints) {
        const srcPointsMat = this.createCVPointMatrix(srcPoints);
        const dstPointsMat = this.createCVPointMatrix(dstPoints);
        
        return cv.getPerspectiveTransform(srcPointsMat, dstPointsMat);
    }

    /**
     * 创建OpenCV点矩阵
     * @param {Array} points - 点数组
     * @returns {cv.Mat} - OpenCV点矩阵
     */
    createCVPointMatrix(points) {
        const pointMatrix = new cv.Mat(4, 1, cv.CV_32FC2);
        
        for (let i = 0; i < 4; i++) {
            if (i < points.length) {
                pointMatrix.data32F[i * 2] = points[i].x;
                pointMatrix.data32F[i * 2 + 1] = points[i].y;
            }
        }
        
        return pointMatrix;
    }

    /**
     * 排序角点（左上、右上、右下、左下）
     * @param {Array} corners - 角点数组
     * @returns {Array} - 排序后的角点
     */
    sortCorners(corners) {
        // 计算中心点
        const center = { x: 0, y: 0 };
        corners.forEach(corner => {
            center.x += corner.x;
            center.y += corner.y;
        });
        center.x /= corners.length;
        center.y /= corners.length;
        
        // 根据与中心点的角度排序
        return corners.sort((a, b) => {
            const angleA = Math.atan2(a.y - center.y, a.x - center.x);
            const angleB = Math.atan2(b.y - center.y, b.x - center.x);
            return angleA - angleB;
        });
    }

    /**
     * 去除重复点
     * @param {Array} points - 点数组
     * @param {number} threshold - 距离阈值
     * @returns {Array} - 去重后的点
     */
    removeDuplicatePoints(points, threshold = 10) {
        const uniquePoints = [];
        
        points.forEach(point => {
            const isDuplicate = uniquePoints.some(uniquePoint => 
                Math.abs(uniquePoint.x - point.x) < threshold && 
                Math.abs(uniquePoint.y - point.y) < threshold
            );
            
            if (!isDuplicate) {
                uniquePoints.push(point);
            }
        });
        
        return uniquePoints;
    }

    /**
     * 加载图像
     * @param {string} imagePath - 图像路径
     * @returns {Promise<cv.Mat>} - 图像矩阵
     */
    loadImage(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const mat = cv.imread(img);
                resolve(mat);
            };
            img.onerror = () => reject(new Error('图像加载失败'));
            img.src = imagePath;
        });
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.templateImage) {
            this.templateImage.delete();
            this.templateImage = null;
        }
        this.isInitialized = false;
    }
}

// 导出模块
window.AnswerSheetAligner = AnswerSheetAligner;