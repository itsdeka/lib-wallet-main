// Copyright 2024 Tether Operations Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
'use strict'

const { WalletStoreHyperbee } = require('lib-wallet-store')

/**
 * @desc Class to manage wallet preferences
 */
class Preference {
  constructor (opts = {}) {
    this._store = new WalletStoreHyperbee({
      store_path: opts.store_path ? `${opts.store_path}/preferences` : undefined
    })
  }

  /**
   * Initialize the preference store
   */
  async init () {
    await this._store.init()
  }

  /**
   * Close the preference store
   */
  async close () {
    return this._store.close()
  }

  /**
   * Set a preference value
   * @param {string} key - The preference key
   * @param {any} value - The preference value
   */
  async setPreference (key, value) {
    return this._store.put(`pref:${key}`, value)
  }

  /**
   * Get a preference value
   * @param {string} key - The preference key
   * @returns {any} The preference value
   */
  async getPreference (key) {
    return this._store.get(`pref:${key}`)
  }

  /**
   * Get all preferences
   * @returns {Object} All preferences as key-value pairs
   */
  async getAllPreferences () {
    const preferences = {}
    const stream = this._store.createReadStream({ 
      gte: 'pref:',
      lt: 'pref:\uffff'
    })

    for await (const { key, value } of stream) {
      const prefKey = key.slice(5) // Remove 'pref:' prefix
      preferences[prefKey] = value
    }

    return preferences
  }
}

module.exports = Preference 