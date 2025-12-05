App({
    onLaunch: function () {
        // Auto login check1
        wx.login({
            success: res => {
                if (res.code) {
                    // Send code to backend
                    wx.request({
                        url: 'http://localhost:8080/api/auth/wechat',
                        method: 'POST',
                        data: { code: res.code },
                        success: (response) => {
                            if (response.data.bound) {
                                // Already bound, auto login
                                wx.setStorageSync('worker', response.data.worker)
                                if (this.workerReadyCallback) {
                                    this.workerReadyCallback(response.data.worker)
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
