'use strict';

const { APIHandler, APIResponse } = require('gateway-addon');
const manifest = require('../manifest.json');
const PagesDB = require('./pages-db.js');

let PagesAdaptor = null;
try {
    PagesAdaptor = require('./pages-adaptor');
} catch (e) {
    console.error(`pages-api-handler (A) no PagesAdaptor: ${e}`);
}

/**
 * Pages API handler.
 */
class PagesAPIHandler extends APIHandler {
    constructor(addonManager) {
        super(addonManager, manifest.id);
        addonManager.addAPIHandler(this);
        PagesDB.open();

        this.activeDeviceList = [];
        if (PagesAdaptor) {
            this.pagesAdaptor = new PagesAdaptor(addonManager, this);

            // we dont get informed of devices being deleted, so cleanup 10 mins after startup
            // need a better solution, as the gateway can run for weeks without a restart
            setTimeout(async() => {
                await PagesDB.cleanup_things(this.activeDeviceList);
            }, (10 * 60 * 1000));
        }

        // register all of the API handlers here
        this.handlers = {};
        let h = this.handlers;

        h['/group'] = (request) => {
            if (request.body.item) {
                return PagesDB.get_contents(request.body.item);
            } else {
                return PagesDB.get_list('G');
            }
        };

        h['/page'] = (request) => {
            if (request.body.item) {
                return PagesDB.get_contents(request.body.item);
            } else {
                return PagesDB.get_list('P');
            }
        };

        h['/group/add'] = (request) => {
            return PagesDB.add_principal('G', request.body.name);
        };

        h['/page/add'] = (request) => {
            return PagesDB.add_principal('P', request.body.name);
        };

        h['/group/delete'] = (request) => {
            return PagesDB.delete_principal(request.body.item);
        };

        h['/page/delete'] = (request) => {
            return PagesDB.delete_principal(request.body.item);
        };

        h['/group/listavailable'] = (request) => {
            return PagesDB.get_available_links(request.body.item, 'T');
        };

        h['/page/listavailable'] = (request) => {
            return PagesDB.get_available_links(request.body.item, 'G');
        };

        h['/page/insert'] = (request) => {
            return PagesDB.insert_link(request.body.container, request.body.contained);
        };

        h['/group/insert'] = (request) => {
            return PagesDB.insert_link(request.body.container, request.body.contained);
        };

        h['/delete_link'] = (request) => {
            return PagesDB.delete_link(request.body.item);
        };
    }

    async handleRequest(request) {
        let result = null;

        if (request.method === 'POST') {
            let handle = this.handlers[request.path];
            if (handle) {
                try {
                    result = await handle(request);
                } catch (e) {
                    console.error('pages-api-handler (B): ', e.toString());
                }
            }
        }

        if (result !== null) {
            console.log(`pages-api-handler: handled request for ${request.method} | ${request.path} | ${JSON.stringify(request.body)}`);

            // this is a good place to intercept the results
            if (request.path === 'x /page/listavailable') {
                console.log('pages-api-handler: result: ', JSON.stringify(result));
            }

            return new APIResponse({
                status: 200,
                contentType: 'application/json',
                content: JSON.stringify(result),
            });
        }
        console.error(`pages-api-handler (C): no handler for ${request.method} | ${request.path} | ${JSON.stringify(request.body)}`);
        return new APIResponse({
            status: 404,
            contentType: 'text/plain',
            content: `no handler for ${request.method} | ${request.path}`,
        });
    }

    // called from the adapter connected into the gateway data
    async thingNotification(id, device) {
        this.activeDeviceList.push(id);
        await PagesDB.upsert_thing(id, device.title);
    }

}

module.exports = PagesAPIHandler;