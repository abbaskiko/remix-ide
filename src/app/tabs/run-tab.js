var $ = require('jquery')
var yo = require('yo-yo')
var EventManager = require('../../lib/events')
var globlalRegistry = require('../../global/registry')
var executionContext = require('../../execution-context')
var Card = require('../ui/card')
var css = require('./styles/run-tab-styles')

var Settings = require('./runTab/model/settings.js')
var SettingsUI = require('./runTab/settings.js')

var DropdownLogic = require('./runTab/model/dropdownLogic.js')
var ContractDropdownUI = require('./runTab/contractDropdown.js')

var Recorder = require('./runTab/model/recorder.js')
var RecorderUI = require('./runTab/recorder.js')

function runTab (opts, localRegistry) {
  var self = this
  self.event = new EventManager()
  self._view = {}
  self.data = {
    count: 0,
    text: `All transactions (deployed contracts and function executions) in this environment can be saved and replayed in
    another environment. e.g Transactions created in Javascript VM can be replayed in the Injected Web3.`
  }
  self._components = {}
  self._components.registry = localRegistry || globlalRegistry
  self._components.transactionContextAPI = {
    getAddress: (cb) => {
      cb(null, $('#txorigin').val())
    },
    getValue: (cb) => {
      try {
        var number = document.querySelector('#value').value
        var select = document.getElementById('unit')
        var index = select.selectedIndex
        var selectedUnit = select.querySelectorAll('option')[index].dataset.unit
        var unit = 'ether' // default
        if (['ether', 'finney', 'gwei', 'wei'].indexOf(selectedUnit) >= 0) {
          unit = selectedUnit
        }
        cb(null, executionContext.web3().toWei(number, unit))
      } catch (e) {
        cb(e)
      }
    },
    getGasLimit: (cb) => {
      cb(null, $('#gasLimit').val())
    }
  }
  // dependencies
  self._deps = {
    compiler: self._components.registry.get('compiler').api,
    udapp: self._components.registry.get('udapp').api,
    udappUI: self._components.registry.get('udappUI').api,
    config: self._components.registry.get('config').api,
    fileManager: self._components.registry.get('filemanager').api,
    editor: self._components.registry.get('editor').api,
    logCallback: self._components.registry.get('logCallback').api,
    filePanel: self._components.registry.get('filepanel').api,
    pluginManager: self._components.registry.get('pluginmanager').api,
    compilersArtefacts: self._components.registry.get('compilersartefacts').api
  }
  self._deps.udapp.resetAPI(self._components.transactionContextAPI)
  self._view.recorderCount = yo`<span>0</span>`
  self._view.instanceContainer = yo`<div class="${css.instanceContainer}"></div>`
  self._view.clearInstanceElement = yo`
    <i class="${css.clearinstance} ${css.icon} fa fa-trash" onclick=${() => self.event.trigger('clearInstance', [])}
    title="Clear instances list and reset recorder" aria-hidden="true">
  </i>`
  self._view.instanceContainerTitle = yo`
    <div class=${css.instanceContainerTitle}
      title="Autogenerated generic user interfaces for interaction with deployed contracts">
      Deployed Contracts
      ${self._view.clearInstanceElement}
    </div>`
  self._view.noInstancesText = yo`
    <div class="${css.noInstancesText}">
      Currently you have no contract instances to interact with.
    </div>`

  var container = yo`<div class="${css.runTabView}" id="runTabView" ></div>`

  var recorder = new Recorder(self._deps.udapp, self._deps.fileManager, self._deps.udapp.config)
  recorder.event.register('newTxRecorded', (count) => {
    this.data.count = count
    this._view.recorderCount.innerText = count
  })
  recorder.event.register('cleared', () => {
    this.data.count = 0
    this._view.recorderCount.innerText = 0
  })
  executionContext.event.register('contextChanged', recorder.clearAll.bind(recorder))
  self.event.register('clearInstance', recorder.clearAll.bind(recorder))

  var recorderInterface = new RecorderUI(recorder, self)
  recorderInterface.render()

  self._view.collapsedView = yo`
    <div class=${css.recorderCollapsedView}>
      <div class=${css.recorderCount}>${self._view.recorderCount}</div>
    </div>`

  self._view.expandedView = yo`
    <div class=${css.recorderExpandedView}>
      <div class=${css.recorderDescription}>
        ${self.data.text}
      </div>
      <div class="${css.transactionActions}">
        ${recorderInterface.recordButton}
        ${recorderInterface.runButton}
        </div>
      </div>
    </div>`

  self.recorderOpts = {
    title: 'Transactions recorded:',
    collapsedView: self._view.collapsedView
  }

  var recorderCard = new Card({}, {}, self.recorderOpts)
  recorderCard.event.register('expandCollapseCard', (arrow, body, status) => {
    body.innerHTML = ''
    status.innerHTML = ''
    if (arrow === 'down') {
      status.appendChild(self._view.collapsedView)
      body.appendChild(self._view.expandedView)
    } else if (arrow === 'up') {
      status.appendChild(self._view.collapsedView)
    }
  })

  var settings = new Settings(self._deps.udapp)
  var settingsUI = new SettingsUI(settings)

  self.event.register('clearInstance', () => {
    this._view.instanceContainer.innerHTML = '' // clear the instances list
    this._view.instanceContainer.appendChild(self._view.instanceContainerTitle)
    this._view.instanceContainer.appendChild(self._view.noInstancesText)
  })
  settingsUI.event.register('clearInstance', () => {
    this.event.trigger('clearInstance', [])
  })

  var dropdownLogic = new DropdownLogic(self)
  var contractDropdownUI = new ContractDropdownUI(dropdownLogic, self)

  contractDropdownUI.event.register('clearInstance', () => {
    var noInstancesText = this._view.noInstancesText
    if (noInstancesText.parentNode) { noInstancesText.parentNode.removeChild(noInstancesText) }
  })
  contractDropdownUI.event.register('newContractABIAdded', (abi, address) => {
    this._view.instanceContainer.appendChild(this._deps.udappUI.renderInstanceFromABI(abi, address, address))
  })
  contractDropdownUI.event.register('newContractInstanceAdded', (contractObject, address, value) => {
    this._view.instanceContainer.appendChild(this._deps.udappUI.renderInstance(contractObject, address, value))
  })

  this._view.instanceContainer.appendChild(this._view.instanceContainerTitle)
  this._view.instanceContainer.appendChild(this._view.noInstancesText)

  var el = yo`
  <div>
    ${settingsUI.render()}
    ${contractDropdownUI.render()}
    ${recorderCard.render()}
    ${self._view.instanceContainer}
  </div>
  `
  container.appendChild(el)

  return { render () { return container } }
}

module.exports = runTab
