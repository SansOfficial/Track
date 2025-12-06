import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';

export const printOrder = (order) => {
    // Determine title based on context (Create vs Reprint)
    const title = `订单 #${order.ID}`;

    // Open print window
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
        alert('请允许弹出窗口以打印订单');
        return;
    }

    // Generate QR Code SVG string
    const qrCodeSvg = renderToStaticMarkup(
        <QRCodeSVG value={order.qr_code || 'INVALID'} size={150} fgColor="#000000" level="M" />
    );

    // Format Products
    // Handle both "selectedProducts" array of objects (from Create) or "products" array (from List)
    let productsList = [];
    if (order.products && Array.isArray(order.products)) {
        productsList = order.products;
    } else if (order._products_meta) {
        productsList = order._products_meta;
    }

    const productsHtml = productsList.length > 0
        ? productsList.map(p => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${p.name}</span>
                <span>¥${p.price}</span>
            </div>
        `).join('')
        : '<div>多种产品</div>';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>打印订单 - ${order.customer_name}</title>
            <meta charset="utf-8">
            <style>
                body { font-family: 'Courier New', Courier, monospace; text-align: center; padding: 20px 10px; margin: 0; color: #000; }
                .logo { 
                    width: 40px; height: 40px; background: #000; color: white; border-radius: 50%; 
                    display: flex; align-items: center; justify-content: center; margin: 0 auto 10px;
                    font-size: 20px; font-weight: bold; border: 2px solid #000;
                }
                .logo-text { font-size: 10px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 2px; }
                
                .section { border-top: 2px dashed #000; padding: 15px 0; text-align: left; }
                .section.first { border-top: none; }
                .section.last { border-bottom: 2px dashed #000; }
                
                .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; font-weight: bold; }
                .row .label { font-weight: normal; }
                
                .products { margin: 15px 0; font-size: 12px; }
                
                .qr-container { margin: 30px 0; }
                .uuid { font-size: 10px; color: #666; word-break: break-all; margin-top: 5px; }
                
                .footer { font-size: 10px; margin-top: 30px; }
                
                @media print { 
                    @page { margin: 0; size: 80mm auto; } 
                    body { -webkit-print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="logo">畳</div>
            <div class="logo-text">Tatami System</div>
            
            <div class="section first">
                <div class="row">
                    <span class="label">订单号</span>
                    <span style="font-size: 12px;">${order.order_no || order.ID}</span>
                </div>
                <div class="row">
                    <span class="label">客户</span>
                    <span>${order.customer_name}</span>
                </div>
                <div class="row">
                    <span class="label">电话</span>
                    <span>${order.phone || '-'}</span>
                </div>
                <div class="row">
                    <span class="label">日期</span>
                    <span>${new Date().toLocaleDateString()}</span>
                </div>
            </div>

            <div class="section">
                <div style="font-weight: bold; margin-bottom: 10px;">产品清单</div>
                <div class="products">
                    ${productsHtml}
                </div>
                <div class="row" style="font-size: 16px; margin-top: 10px;">
                    <span>总计</span>
                    <span>¥${order.amount}</span>
                </div>
            </div>

            <div class="qr-container">
                ${qrCodeSvg}
                <div class="uuid">${order.qr_code}</div>
                <div style="font-size: 10px; margin-top: 5px;">扫描二维码更新进度</div>
            </div>
            
            <div class="footer">
                ORDER ID: ${order.ID}
            </div>

            <script>
                window.onload = () => { 
                    window.print(); 
                    // setTimeout(() => window.close(), 100); // Optional: close after print
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};
