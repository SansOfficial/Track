App({
    onLaunch: function (options) {
        // Check for QR Code launch
        if (options.query && options.query.q) {
            const url = decodeURIComponent(options.query.q)
            const match = url.match(/id=(\d+)/)
            if (match && match[1]) {
                this.globalData.scanOrderId = match[1]
            }
        }

        // Auto login check
        wx.login({
            success: res => {
                if (res.code) {
                    // Send code to backend
                    wx.request({
                        url: 'http://101.43.170.39:8080/api/auth/wechat',
                        method: 'POST',
                        data: { code: res.code },
                        success: (response) => {
                            if (response.data.bound) {
                                // Already bound, auto login
                                wx.setStorageSync('worker', response.data.worker)
                                if (this.workerReadyCallback) {
                                    this.workerReadyCallback(response.data.worker)
                                }

                                // Handle Pending Scan
                                if (this.globalData.scanOrderId) {
                                    wx.navigateTo({
                                        url: `/pages/worker/worker?scan_order_id=${this.globalData.scanOrderId}`
                                    })
                                    this.globalData.scanOrderId = null
                                }

                                // Redirect if on bind page
                                const pages = getCurrentPages()
                                if (pages.length > 0 && pages[0].route === 'pages/bind/bind') {
                                    wx.reLaunch({ url: '/pages/worker/worker' })
                                }
                            } else {
                                // Not bound, save openid for binding
                                this.globalData.openid = response.data.openid
                                if (this.openidReadyCallback) {
                                    this.openidReadyCallback(response.data.openid)
                                }
                            }
                        }
                    })
                }
            }
        })
    },
    globalData: {
        openid: null
    }
})
