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

const { test } = require('brittle')
const Preference = require('../src/modules/preference')
const path = require('path')
const fs = require('fs')

test('constructor', async (t) => {
  const storePath = path.join(__dirname, 'test-store')
  const preference = new Preference({ store_path: storePath })
  t.ok(preference._store, 'Store should be initialized')
  
  // Cleanup
  await preference.close()
  fs.rmSync(storePath, { recursive: true, force: true })
})

test('init and close', async (t) => {
  const storePath = path.join(__dirname, 'test-store')
  const preference = new Preference({ store_path: storePath })
  
  await preference.init()
  t.ok(true, 'Should initialize successfully')
  
  await preference.close()
  t.ok(true, 'Should close successfully')
  
  // Cleanup
  fs.rmSync(storePath, { recursive: true, force: true })
})

test('set and get preference', async (t) => {
  const storePath = path.join(__dirname, 'test-store')
  const preference = new Preference({ store_path: storePath })
  await preference.init()
  
  const testKey = 'testKey'
  const testValue = { test: 'value' }
  
  await preference.setPreference(testKey, testValue)
  const retrievedValue = await preference.getPreference(testKey)
  
  t.ok(JSON.stringify(retrievedValue) === JSON.stringify(testValue), 'Should retrieve the same value that was set')
  
  await preference.close()
  // Cleanup
  fs.rmSync(storePath, { recursive: true, force: true })
})

test('get all preferences', async (t) => {
  const storePath = path.join(__dirname, 'test-store')
  const preference = new Preference({ store_path: storePath })
  await preference.init()
  
  const testData = {
    key1: 'value1',
    key2: { nested: 'value2' },
    key3: 123
  }
  
  for (const [key, value] of Object.entries(testData)) {
    await preference.setPreference(key, value)
  }
  
  const allPreferences = await preference.getAllPreferences()
  
  t.ok(Object.keys(allPreferences).length === Object.keys(testData).length, 'Should have the same number of preferences')
  for (const [key, value] of Object.entries(testData)) {
    t.ok(JSON.stringify(allPreferences[key]) === JSON.stringify(value), `Should have correct value for ${key}`)
  }
  
  await preference.close()
  // Cleanup
  fs.rmSync(storePath, { recursive: true, force: true })
}) 