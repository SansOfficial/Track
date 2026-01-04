import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * 格式化日期为 YYYY-MM-DD 格式
 */
const formatDate = (dateStr) => {
    const date = new Date(dateStr || Date.now());
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * 打印二维码标签（创建订单后使用）
 * 只显示客户信息和二维码，不显示金额
 */
export const printQRCode = (order) => {
    const printWindow = window.open('', '_blank', 'width=400,height=500');
    if (!printWindow) {
        alert('请允许弹出窗口以打印');
        return;
    }

    const qrCodeSvg = renderToStaticMarkup(
        <QRCodeSVG value={order.qr_code || 'INVALID'} size={180} fgColor="#000000" level="M" />
    );

    // 产品名称列表（不含价格）
    const products = order.order_products || order.products || [];
    const productNames = products.map(p => p.product?.name || p.name).filter(Boolean).join('、');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>订单标签 - ${order.customer_name}</title>
            <meta charset="utf-8">
            <style>
                body { 
                    font-family: 'Microsoft YaHei', sans-serif; 
                    text-align: center; 
                    padding: 20px; 
                    margin: 0; 
                    color: #000; 
                }
                .header { 
                    font-size: 18px; 
                    font-weight: bold; 
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #000;
                }
                .info { 
                    text-align: left; 
                    margin: 20px 0; 
                    font-size: 14px;
                }
                .info-row { 
                    display: flex; 
                    margin-bottom: 8px;
                }
                .info-label { 
                    width: 60px; 
                    color: #666;
                }
                .info-value { 
                    flex: 1; 
                    font-weight: bold;
                }
                .qr-container { 
                    margin: 30px 0; 
                    padding: 20px;
                    border: 2px dashed #ccc;
                    display: inline-block;
                }
                .qr-hint { 
                    font-size: 12px; 
                    color: #666; 
                    margin-top: 10px; 
                }
                .order-no {
                    font-size: 12px;
                    font-family: monospace;
                    color: #999;
                    margin-top: 5px;
                }
                .products {
                    font-size: 12px;
                    color: #333;
                    margin-top: 15px;
                    padding: 10px;
                    background: #f5f5f5;
                    border-radius: 4px;
                }
                @media print { 
                    @page { margin: 10mm; size: 80mm auto; } 
                }
            </style>
        </head>
        <body>
            <div class="header">订单标签</div>
            
            <div class="info">
                <div class="info-row">
                    <span class="info-label">客户</span>
                    <span class="info-value">${order.customer_name}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">电话</span>
                    <span class="info-value">${order.phone || '-'}</span>
                </div>
                ${order.address ? `
                <div class="info-row">
                    <span class="info-label">地址</span>
                    <span class="info-value">${order.address}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="info-label">日期</span>
                    <span class="info-value">${formatDate(order.CreatedAt)}</span>
                </div>
            </div>

            ${productNames ? `<div class="products">产品：${productNames}</div>` : ''}

            <div class="qr-container">
                ${qrCodeSvg}
            </div>
            <div class="qr-hint">扫描二维码查看/更新订单状态</div>

            <script>
                window.onload = () => { window.print(); }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

/**
 * 解析额外属性 JSON 字符串
 */
const parseExtraAttrs = (extraAttrsStr) => {
    if (!extraAttrsStr) return {};
    try {
        return JSON.parse(extraAttrsStr);
    } catch {
        return {};
    }
};

/**
 * 打印销货清单（完整版，用于发货）
 */
export const printInvoice = (order) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
        alert('请允许弹出窗口以打印');
        return;
    }

    const products = order.order_products || [];
    
    // 预处理：计算相同产品+规格的合并信息
    const processedProducts = products.map((op, index) => {
        const product = op.product || {};
        const productName = product.name || '-';
        const sizeText = (op.length || op.width || op.height) 
            ? `${op.length || 0}×${op.width || 0}×${op.height || 0}`
            : '-';
        const mergeKey = `${productName}__${sizeText}`;
        
        return {
            ...op,
            productName,
            sizeText,
            mergeKey,
            index
        };
    });
    
    // 计算每个合并组的起始位置和跨行数
    const mergeGroups = {};
    processedProducts.forEach((item, idx) => {
        if (!mergeGroups[item.mergeKey]) {
            mergeGroups[item.mergeKey] = { startIndex: idx, count: 0, indices: [] };
        }
        mergeGroups[item.mergeKey].count++;
        mergeGroups[item.mergeKey].indices.push(idx);
    });
    
    // 生成产品行（规格列放最后，相同产品+规格合并）
    const productRows = processedProducts.map((op, index) => {
        const extraAttrs = parseExtraAttrs(op.extra_attrs);
        
        // 格式化额外属性为多行显示
        const extraAttrsList = Object.entries(extraAttrs)
            .filter(([, value]) => value)
            .map(([key, value]) => `<div>${key}: ${value}</div>`)
            .join('');
        
        // 判断是否需要显示规格列（只在合并组的第一行显示）
        const group = mergeGroups[op.mergeKey];
        const isFirstInGroup = group.indices[0] === index;
        const rowSpan = group.count;
        
        // 规格单元格：只在组的第一行渲染，使用rowspan
        const specCell = isFirstInGroup 
            ? `<td class="td-spec" ${rowSpan > 1 ? `rowspan="${rowSpan}"` : ''}>${op.sizeText}</td>`
            : '';
        
        return `
            <tr>
                <td class="td-seq">${index + 1}</td>
                <td class="td-name">${op.productName}</td>
                <td class="td-attrs">${extraAttrsList || '-'}</td>
                <td class="td-qty">${op.quantity || 1}</td>
                <td class="td-unit">${op.unit || '块'}</td>
                <td class="td-price">${op.unit_price?.toFixed(2) || '0.00'}</td>
                <td class="td-amount">${op.total_price?.toFixed(2) || '0.00'}</td>
                ${specCell}
            </tr>
        `;
    }).join('');

    // 空行填充（至少8行）
    const emptyRowsCount = Math.max(0, 8 - products.length);
    const emptyRows = Array(emptyRowsCount).fill(`
        <tr>
            <td class="td-seq">&nbsp;</td>
            <td class="td-name"></td>
            <td class="td-attrs"></td>
            <td class="td-qty"></td>
            <td class="td-unit"></td>
            <td class="td-price"></td>
            <td class="td-amount"></td>
            <td class="td-spec"></td>
        </tr>
    `).join('');

    // 金额大写转换
    const amountChinese = numberToChinese(order.amount || 0);

    // 解析附件
    let attachments = [];
    if (order.attachments) {
        try {
            attachments = JSON.parse(order.attachments);
        } catch {
            attachments = [];
        }
    }

    // 生成附件图片HTML
    // 使用完整URL确保在打印窗口中能正确加载
    const baseUrl = window.location.origin;
    const attachmentsHtml = attachments.length > 0 ? `
        <div class="attachments">
            <div class="attachments-title">附件图片</div>
            <div class="attachments-grid">
                ${attachments.map((url, index) => {
                    const fullUrl = url.startsWith('http') ? url : baseUrl + url;
                    return `<img src="${fullUrl}" alt="附件${index + 1}" onclick="showImage('${fullUrl}')" onerror="this.style.display='none'" />`;
                }).join('')}
            </div>
        </div>
        <div id="imageModal" class="image-modal" onclick="hideImage()">
            <img id="modalImage" src="" alt="大图预览" />
            <div class="image-modal-hint">点击任意处关闭</div>
        </div>
    ` : '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>销货清单 - ${order.customer_name}</title>
            <meta charset="utf-8">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'SimSun', 'Microsoft YaHei', serif; 
                    padding: 20px; 
                    font-size: 12px;
                    color: #000;
                }
                .title { 
                    text-align: center; 
                    font-size: 24px; 
                    font-weight: bold; 
                    color: #c00;
                    margin-bottom: 5px;
                }
                .subtitle {
                    text-align: center;
                    font-size: 14px;
                    margin-bottom: 15px;
                }
                .header-info {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 5px 0;
                    border-bottom: 1px solid #000;
                }
                .header-left, .header-right {
                    display: flex;
                    gap: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 8px 6px;
                    text-align: center;
                    font-size: 12px;
                    vertical-align: middle;
                }
                th {
                    background: #f0f0f0;
                    font-weight: bold;
                    font-size: 12px;
                }
                /* 各列宽度控制 */
                .td-seq { width: 35px; }
                .td-name { width: 120px; text-align: left; font-weight: 500; }
                .td-spec { width: 100px; font-family: monospace; }
                .td-attrs { text-align: left; font-size: 11px; min-width: 120px; }
                .td-attrs div { margin: 1px 0; }
                .td-qty { width: 50px; }
                .td-unit { width: 50px; }
                .td-price { width: 70px; }
                .td-amount { width: 80px; font-weight: bold; }
                .attachments {
                    margin-top: 15px;
                    page-break-inside: avoid;
                }
                .attachments-title {
                    font-weight: bold;
                    font-size: 12px;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 4px;
                }
                .attachments-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .attachments-grid img {
                    max-width: 280px;
                    max-height: 220px;
                    border: 1px solid #ddd;
                    object-fit: contain;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .attachments-grid img:hover {
                    transform: scale(1.05);
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                }
                /* 打印时图片更大更清晰 */
                @media print {
                    .attachments-grid img {
                        max-width: 45%;
                        max-height: 300px;
                    }
                }
                /* 图片放大模态框 */
                .image-modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.8);
                    z-index: 9999;
                    justify-content: center;
                    align-items: center;
                    cursor: pointer;
                }
                .image-modal.show {
                    display: flex;
                }
                .image-modal img {
                    max-width: 90%;
                    max-height: 90%;
                    object-fit: contain;
                    border: 3px solid #fff;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                }
                .image-modal-hint {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    color: #fff;
                    font-size: 14px;
                    background: rgba(0,0,0,0.5);
                    padding: 8px 16px;
                    border-radius: 4px;
                }
                @media print {
                    .image-modal { display: none !important; }
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-top: 2px solid #000;
                    font-weight: bold;
                }
                .remark {
                    margin: 10px 0;
                    padding: 10px;
                    border: 1px solid #000;
                    min-height: 40px;
                }
                .notes {
                    font-size: 10px;
                    line-height: 1.6;
                    margin-top: 15px;
                    padding: 10px;
                    background: #f9f9f9;
                }
                .notes p {
                    margin-bottom: 3px;
                }
                .footer {
                    margin-top: 15px;
                    font-size: 11px;
                    border-top: 1px solid #000;
                    padding-top: 10px;
                }
                @media print { 
                    @page { margin: 10mm; size: A4; } 
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="title">销货清单<span style="font-size: 14px; color: #666;">(代合同)</span></div>
            <div class="subtitle">旭日盛唐全国运营中心（青岛榻榻米垫工厂）</div>

            <div class="header-info">
                <div class="header-left">
                    <span>日期：${formatDate(order.CreatedAt)}</span>
                    <span>客户：${order.customer_name}</span>
                </div>
                <div class="header-right">
                    <span>订单号：${order.order_no || order.ID}</span>
                </div>
            </div>
            <div class="header-info" style="border-bottom: none;">
                <span>地址：${order.address || '-'}</span>
                <span>电话：${order.phone || '-'}</span>
            </div>

            <table>
                <thead>
                    <tr>
                        <th class="td-seq">序号</th>
                        <th class="td-name">品名</th>
                        <th class="td-attrs">属性</th>
                        <th class="td-qty">数量</th>
                        <th class="td-unit">单位</th>
                        <th class="td-price">单价</th>
                        <th class="td-amount">金额</th>
                        <th class="td-spec">规格(长×宽×高)</th>
                    </tr>
                </thead>
                <tbody>
                    ${productRows}
                    ${emptyRows}
                </tbody>
            </table>

            <div class="total-row">
                <span>大写：${amountChinese}</span>
                <span>小写：¥ ${(order.amount || 0).toFixed(2)}</span>
            </div>

            <div class="remark">
                <strong>备注：</strong>${order.remark || ''}
            </div>

            ${attachmentsHtml}

            <div class="notes">
                <p>1. 产品计价单位按每平米计算，后期增加花色，请以实际报价为准。</p>
                <p>2. 常规订单5-7天发货，电加热榻榻米垫工期为10-15天。</p>
                <p>3. 下单最好提供完整的图片及型号信息，保证订单准确性。</p>
                <p>4. 榻榻米默认规格为两长边包边，短边不包，若需四边包边，加收10元/平方米材料人工费。</p>
            </div>

            <div class="footer">
                <span>联系人：周茂建</span>
                <span style="margin-left: 20px;">电话：13645421333（微信/支付宝）同号</span>
                <span style="margin-left: 20px;">0532-86711234</span>
            </div>

            <!-- 打印控制栏（打印时隐藏） -->
            <div class="print-controls" id="printControls">
                <button onclick="window.print()" class="print-btn">🖨️ 打印 / 保存PDF</button>
                <span class="print-hint">可先查看附件图片（点击放大），确认后再打印</span>
            </div>

            <style>
                .print-controls {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    padding: 12px 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 20px;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
                    z-index: 1000;
                }
                .print-btn {
                    background: #4CAF50;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    font-size: 14px;
                    font-weight: bold;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .print-btn:hover {
                    background: #45a049;
                }
                .print-hint {
                    color: #aaa;
                    font-size: 12px;
                }
                @media print {
                    .print-controls { display: none !important; }
                    body { padding-bottom: 0 !important; }
                }
                body { padding-bottom: 60px; }
            </style>

            <script>
                function showImage(src) {
                    var modal = document.getElementById('imageModal');
                    var img = document.getElementById('modalImage');
                    if (modal && img) {
                        img.src = src;
                        modal.classList.add('show');
                    }
                }
                function hideImage() {
                    var modal = document.getElementById('imageModal');
                    if (modal) {
                        modal.classList.remove('show');
                    }
                }
                // 按ESC键也可关闭
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') hideImage();
                });
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};

/**
 * 数字转中文大写
 */
function numberToChinese(num) {
    if (num === 0) return '零元整';
    
    const digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const units = ['', '拾', '佰', '仟'];
    const bigUnits = ['', '万', '亿'];
    
    const intPart = Math.floor(num);
    const decPart = Math.round((num - intPart) * 100);
    
    let result = '';
    
    // 整数部分
    if (intPart > 0) {
        const intStr = intPart.toString();
        let zeroFlag = false;
        
        for (let i = 0; i < intStr.length; i++) {
            const digit = parseInt(intStr[i]);
            const pos = intStr.length - 1 - i;
            const unitPos = pos % 4;
            const bigUnitPos = Math.floor(pos / 4);
            
            if (digit === 0) {
                zeroFlag = true;
                if (unitPos === 0 && bigUnitPos > 0) {
                    result += bigUnits[bigUnitPos];
                }
            } else {
                if (zeroFlag) {
                    result += '零';
                    zeroFlag = false;
                }
                result += digits[digit] + units[unitPos];
                if (unitPos === 0 && bigUnitPos > 0) {
                    result += bigUnits[bigUnitPos];
                }
            }
        }
        result += '元';
    }
    
    // 小数部分
    if (decPart > 0) {
        const jiao = Math.floor(decPart / 10);
        const fen = decPart % 10;
        
        if (jiao > 0) {
            result += digits[jiao] + '角';
        } else if (intPart > 0) {
            result += '零';
        }
        
        if (fen > 0) {
            result += digits[fen] + '分';
        }
    } else {
        result += '整';
    }
    
    return result;
}

// 保留旧的 printOrder 函数作为兼容（内部调用 printQRCode）
export const printOrder = printQRCode;
