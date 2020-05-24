/**
 * WebThings Gateway Database - largely copied from main Mozilla IOT Gateway
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
'use strict';

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DatabaseA = {
    /**
     * SQLite3 Database object.
     */
    db: null,

    /**
     * Open the database.
     * @param {function} createTables if provided, a function to conditionally create the tables required for this database
     */
    open: function(db_location, createTables) {
        console.log('boo');
        // If the database is already open, just return.
        if (this.db) {
            return;
        }

        try {
            if (!fs.existsSync(db_location)) {
                console.log(`db.js: created ${fs.mkdirSync(db_location, { recursive: true })}`);
            }
            if (!fs.existsSync(db_location)) {
                throw new Error(`${db_location} does not exist`);
            }
            const filename = path.join(db_location, 'pages.sqlite3');

            // Check if database already exists
            let exists = fs.existsSync(filename);

            console.log(exists ? 'Opening' : 'Creating', 'database:', filename);

            // Open database or create it if it doesn't exist
            this.db = new sqlite3.Database(filename);

            // Set a timeout in case the database is locked. 10 seconds is a bit long,
            // but it's better than crashing.
            this.db.configure('busyTimeout', 10000);

            this.db.serialize(() => {
                // enforce foreign keys. Supported since SQLite Release 3.6.19 on 2009-10-14
                this.db.run('PRAGMA foreign_keys = ON;');

                if (typeof createTables === 'function') {
                    createTables(this.db);
                }
            });
        } catch (e) {
            console.error(`db.js  -  CANNOT CONTINUE  -  ${e}`);
            throw (e);
        }

        // optimize the database for query plans every few hours. This is usually a no-op unless
        // - there has been a huge number of database updates that affect indexes; or
        // - an index has never been analysed and has new entries
        const hour = (60 * 60 * 1000);
        setInterval(async() => {
            let t = await this.db.run('PRAGMA optimize;');
            console.log('PRAGMA optimize; ', JSON.stringify(t));
        }, ((1 / 60) * hour));
    },

    /**
     * Return the 1-row results of a SQL statement
     * @param {String} sql
     * @param {Array<any>} values
     * @return {Promise<Object>} promise resolved to `this` of statement result
     */
    get: function(sql, ...params) {
        return new Promise((accept, reject) => {
            params.push((err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                accept(row);
            });

            try {
                this.db.get(sql, ...params);
            } catch (err) {
                reject(err);
            }
        });
    },

    /**
     * Return the multi-row results of a SQL statement
     * @param {String} sql
     * @param {Array<any>} values
     * @return {Promise<Object>} promise resolved to `this` of statement result
     */
    get_all: function(sql, ...params) {
        return new Promise((accept, reject) => {
            params.push((err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                accept(row);
            });

            try {
                this.db.all(sql, ...params);
            } catch (err) {
                reject(err);
            }
        });
    },

    /**
     * Run a SQL statement
     * @param {String} sql
     * @param {Array<any>} values
     * @return {Promise<Object>} promise resolved to `this` of statement result
     */
    run: function(sql, values) {
        return new Promise((accept, reject) => {
            try {
                this.db.run(sql, values, function(err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    // node-sqlite puts results on "this" so avoid arrrow fn.
                    accept(this);
                });
            } catch (err) {
                reject(err);
            }
        });
    },
};

module.exports = DatabaseA;