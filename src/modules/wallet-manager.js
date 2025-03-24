const { WalletStoreHyperbee } = require('lib-wallet-store')
const { EventEmitter } = require('events')

const MAX_SUB_SIZE = 10000

/**
 * @classdesc Manages multiple wallets, providing a unified interface for creating, loading, saving, and interacting with them.
 * Handles wallet persistence using a db store, manages event subscriptions across wallets, and provides a centralized method for calling methods on individual wallets.
 * Supports loading all wallets or specific wallets by name.
 */
class MultiWalletManager extends EventEmitter{
  constructor (opts, walletLoader) {
    super()
    this._store = new WalletStoreHyperbee({
      store_path: opts.store_path + '/wallet-manager'
    })
    this._store_path = opts.store_path
    this._wallets = new Map()
    this._walletLoader = walletLoader
    this._subs = new Map()
    if (!this._walletLoader) throw new Error('wallet loader must be passed')
  }

  async init () {
    await this._store.init()
  }

  async getWalletList () {
    return (await this._store.get('wallets')) || []
  }

  _updateWalletList (data) {
    return this._store.put('wallets', data)
  }

  getWallet (_, name) {
    return this._store.get(`wallet-${name}`)
  }

  async shutdown () {
    const res = []
    for (const [key, wallet] of this._wallets) {
      res.push(key)
      await wallet.destroy()
    }

    await this._store.close()
    this._wallets = new Map()
    return res
  }

  async resumeWallets () {
    for (const wallet of this._wallets) {
      await wallet[1].destroy()
    }
  }

  _runWalletLoader (walletExp) {
    return this._walletLoader(walletExp, {
      store_path: this._store_path
    })
  }

  async addWallet (_, walletExport) {
    const walletList = await this.getWalletList()
    if (walletList.includes(walletExport.name)) {
      throw new Error('wallet already exists')
    }
    walletList.push(walletExport.name)

    await this._store.put(`wallet-${walletExport.name}`, walletExport)
    await this._updateWalletList(walletList)
  }

  async removeWallet (req, name) {
    const walletList = await this.getWalletList()
    delete walletList[name]
    await this._updateWalletList(walletList)
  }

  async _load (config) {
    const walletExp = await this.getWallet({}, config.name)
    const wallet = await this._runWalletLoader(walletExp)
    this._wallets.set(config.name, wallet)
    return wallet
  }

  async loadWallet (opts, ...param) {
    const res = await this._setupWallet(...param)
    return res.map((w) => w.walletName)
  }

  async _setupWallet (opts) {
    const walletList = await this.getWalletList()
    if (opts.all) {
      await Promise.all(walletList.map(async (walletName) => {
        const config = await this.getWallet({}.walletName)
        await this._load(config)
      }))
      return walletList
    }
    const config = await this.getWallet({}, opts.name)
    if (!config) throw new Error('cant find wallet data')
    const wallet = await this._load(config)
    return [wallet]
  }

  async createWallet (req, opts = {}) {
    opts.name = opts.name || 'default'
    opts.store_path = opts.store_path || this._store_path
    let wallet = this._wallets.get(opts.name)
    if (wallet) throw new Error('wallet already exists with name')
    wallet = await this._runWalletLoader(opts)
    const walletExport = await wallet.exportWallet()
    this._wallets.set(wallet.walletName, wallet)
    await this.addWallet(req, walletExport)
    this._subBootstrapEvents(wallet)
    return walletExport
  }

  _getEventName (req) {
    if (!Array.isArray(req.params)) throw new Error('req params must be an array')
    const eventName = req.params.shift()
    if (!eventName) throw new Error('event name is missing')
    return eventName
  }

  _getEventHandler (k) {
    const handler = this._subs.get(k)
    if (!handler) throw new Error('handler does not exist ' + k)
    return handler
  }

  _subBootstrapEvents (wallet) {
    const payEvents = this._walletLoader.bootstrapEvents.pay

    wallet.pay.each((asset, k) => {
      payEvents.forEach((ev) => {
        asset.on(ev, (...args) => {
          this.emit('chain-event',{
            name : wallet.walletName,
            chain : k,
            event: ev,
          },[...args])
        })
      })
    })
  }

  async callWallet(req){
    let wallet = this._wallets.get(req.name)
    if (!wallet) {
      wallet = await this._setupWallet({ name: req.name })
      if (!wallet || wallet.length === 0) throw new Error(`Wallet with name ${req.name} not found `)
      wallet = wallet.pop()
      // todo : subscribe to events
    }

    // Call direct to wallet
    if (!req.namespace) {
      if (!wallet[req.method]) throw new Error('method does not exist on wallet')
      if (!Array.isArray(req.params)) throw new Error('params is not array')
      try {
        return await wallet[req.method](...req.params)
      } catch(err) {
        console.log(err)
        throw err
      }
    }

    if(!wallet[req.namespace]) throw new Error('namespace doesnt exist')
    if(!wallet[req.namespace][req.chain]) throw new Error('chain does not exist')
    if(!wallet[req.namespace][req.chain][req.method]) throw new Error('method does not exist')
    if(!Array.isArray(req.params)) throw new Error('params is not array')

    let res
    try {
      res = await wallet[req.namespace][req.chain][req.method](...req.params)
    } catch(err) {
      console.log(err)
      throw err
    }
    return res
  }
}

module.exports = MultiWalletManager
