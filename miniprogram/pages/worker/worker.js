Page({
    data: {
        worker: null,
        scanResult: '',
        status: ''
    },

    onLoad: function (options) {
        const worker = wx.getStorageSync('worker')
        if (!worker) {
            wx.redirectTo({ url: '/pages/bind/bind' })
            return
        }
        this.setData({ worker: worker })
    },

    handleScan: function () {
        wx.scanCode({
            success: (res) => {
                this.setData({ scanResult: res.result })
                this.updateOrder(res.result)
            }
        })
    },

    updateOrder: function (qrCode) {
        wx.request({
            url: 'http://101.43.170.39:8080/api/scan',
            method: 'POST',
            data: {
                qr_code: qrCode,
                worker_id: this.data.worker.ID
            },
            success: (res) => {
                if (res.statusCode === 200) {
                    wx.showToast({
                        title: 'Success',
                        icon: 'success'
                    })
                    this.setData({ status: 'Updated to: ' + res.data.order.status })
                } else {
                    wx.showToast({
                        title: 'Error',
                        icon: 'none'
                    })
                }
            },
            fail: () => {
                wx.showToast({
                    title: 'Network Error',
                    icon: 'none'
                })
            }
        })
    },

    logout: function () {
        wx.removeStorageSync('worker')
        wx.redirectTo({ url: '/pages/bind/bind' })
    }
})
