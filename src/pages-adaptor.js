/**
 * example-adapter.js - Example adapter.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const {
    Adapter
} = require('gateway-addon');

const manifest = require('../manifest.json');

class PagesAdaptor extends Adapter {
    constructor(addonManager, pagesAPIHandler) {
        super(addonManager, 'PagesAdaptor', manifest.id);
        addonManager.addAdapter(this);
        this.pagesAPIHandler = pagesAPIHandler;
    }

    // a call back from the superclass, used to inform the APIHandler of the devices seen
    handleDeviceSaved(_deviceId, _device) {
        this.pagesAPIHandler.thingNotification(_deviceId, _device);
    }

    handleDeviceRemoved(device) {
        super.handleDeviceRemoved(device);
        console.log('pagesAdaptor - handleDeviceRemoved: ', device.id, '  -  ', device.title);
    }

}

module.exports = PagesAdaptor;