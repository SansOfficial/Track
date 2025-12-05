const app = getApp()

Page({
    data: {
        openid: '',
        phone: '' // For dev simulation
    },

    onLoad: function () {
        if (app.globalData.openid) {
            this.setData({ openid: app.globalData.openid })
        } else {
            app.openidReadyCallback = res => {
                this.setData({ openid: res })
            }
        }

        // Check if already logged in
        const worker = wx.getStorageSync('worker')
        if (worker) {
            wx.reLaunch({ url: '/pages/worker/worker' })
        }
    },

    handleInput: function (e) {
        this.setData({ phone: e.detail.value })
    },

    handleGetPhoneNumber: function (e) {
        console.log('getPhoneNumber event:', e.detail)

        if (!e.detail.code) {
            console.log('No code in event detail, using fallback manual input')
            // Fallback: Manual phone input for development
            wx.showModal({
                title: '手机号输入（测试模式）',
                content: '开发工具不支持获取手机号，请手动输入：',
                editable: true,
                placeholderText: '请输入手机号',
                success: (res) => {
                    if (res.confirm && res.content) {
                        // this.loginWithManualPhone(res.content) // Removed manual phone login call
                        wx.showToast({ title: '手动输入手机号功能已移除', icon: 'none' })
                    }
                }
            })
            return
        }

        if (!this.data.openid) {
            wx.showToast({ title: '正在初始化...', icon: 'none' })
            return
        }

        wx.showLoading({ title: '登录中...' })

        wx.request({
            url: 'http://101.43.170.39:8080/api/auth/wechat/phone',
            method: 'POST',
            data: {
                code: e.detail.code,
                openid: this.data.openid
            },
            success: (res) => {
                wx.hideLoading()
                if (res.statusCode === 200) {
                    wx.setStorageSync('worker', res.data.worker)
                    wx.reLaunch({ url: '/pages/worker/worker' })
                } else {
                    // Show error message
                    const errorMsg = res.data.error || '登录失败'
                    wx.showModal({
                        title: '登录失败',
                        content: errorMsg,
                        showCancel: false,
                        success: () => {
                            // Close the mini program after showing error
                            // wx.navigateBack({ delta: 1 }) // Removed navigateBack
                        }
                    })
                }
            },
            fail: () => {
                wx.hideLoading()
                wx.showToast({ title: '网络错误，请重试', icon: 'none' })
            }
        })
    },

    // Removed loginWithManualPhone, loginWithPhone, bindOpenID functions

    checkLoginStatus: function () {
        if (!this.data.openid) {
            wx.showToast({ title: 'OpenID 未就绪', icon: 'none' })
            return
        }

        wx.showLoading({ title: '检查状态...' })

        // Just query worker by OpenID or re-run login flow
        this.doCheck()
    },

    doCheck: function () {
        // We can just call the wechat auth again with a new code, OR easier:
        // Add a simple API to check if OpenID is bound.
        // For now, let's just re-run the whole login flow which is robust.
        wx.login({
            success: res => {
                if (res.code) {
                    wx.request({
                        url: 'http://101.43.170.39:8080/api/auth/wechat',
                        method: 'POST',
                        data: { code: res.code },
                        success: (response) => {
                            wx.hideLoading()
                            if (response.data.bound) {
                                wx.setStorageSync('worker', response.data.worker)
                                wx.reLaunch({ url: '/pages/worker/worker' })
                            } else {
                                wx.showToast({ title: '管理员尚未绑定该 ID', icon: 'none' })
                            }
                        }
                    })
                }
            }
        })
    },

    getUserProfile: function () {
        wx.getUserProfile({
            desc: '用于完善工人资料',
            success: (res) => {
                const userInfo = res.userInfo
                const worker = wx.getStorageSync('worker')

                if (!worker || !worker.ID) {
                    wx.showToast({ title: '请先登录', icon: 'none' })
                    return
                }

                wx.request({
                    url: 'http://101.43.170.39:8080/api/worker/profile',
                    method: 'POST',
                    data: {
                        worker_id: worker.ID,
                        nickname: userInfo.nickName,
                        avatar: userInfo.avatarUrl
                    },
                    success: (updateRes) => {
                        if (updateRes.statusCode === 200) {
                            wx.setStorageSync('worker', updateRes.data)
                            wx.showToast({ title: '同步成功', icon: 'success' })
                            // Optional: Redirect to worker page
                            setTimeout(() => {
                                wx.reLaunch({ url: '/pages/worker/worker' })
                            }, 1000)
                        } else {
                            wx.showToast({ title: '同步失败', icon: 'none' })
                        }
                    }
                })
            },
            fail: () => {
                wx.showToast({ title: '您取消了授权', icon: 'none' })
            }
        })
    },

    copyOpenID: function () {
        if (this.data.openid) {
            wx.setClipboardData({
                data: this.data.openid,
                success: function () {
                    wx.showToast({ title: '已复制 ID', icon: 'success' })
                }
            })
        }
    }
})
