"use strict";

var bgPage  = chrome.extension.getBackgroundPage();

/**
 * Saves options to localStorage
 */
function save_options() {

    var saveData    = {
        'access_token'  : document.getElementById('access_token').value
    }

    chrome.storage.sync.set(saveData, function() {

        // Update status to let user know options were saved
        document.getElementById("set_token_status").innerHTML = "Saved!";

        window.setTimeout(function() {

            document.getElementById("set_token_status").innerHTML = "";
            bgPage.app.start();
            window.close();

        }, 1250);
    });
}

/**
 * Restores options value from localStorage
 */
function restore_options() {

    chrome.storage.sync.get(function(storageItems) {

        if (!storageItems.access_token) return;

        document.getElementById('access_token').value       = storageItems.access_token;
    });
}

/**
 * Reset notifications
 */
function reset_notifications() {

    if (bgPage.app.access_token) {

        bgPage.app.resetNotifications(function () {

            bgPage.app.clearNotifications(function () {

                bgPage.app.getEvents();
                window.close();
            });
        });

        chrome.storage.sync.get(function(storageItems) {

            if (!storageItems.access_token) return;
            document.getElementById('access_token').value   = storageItems.access_token;
        });

    } else {

        window.setTimeout(function() {

            document.getElementById("reset_notifs_status").innerHTML = "Please set an Access Token";
            document.getElementById("access_token").focus();

        }, 2500);
    }
}

function start_options() {

    bgPage.getManifest( function(manifest) {

        if (manifest) {

            document.getElementsByTagName('title')[0].innerHTML = 'Settings - ' + manifest.name;
            document.getElementById('app_name').innerHTML       = manifest.name + ' v' + manifest.version;
            document.getElementById('app_desc').innerHTML       = manifest.description;
            document.getElementById('author').innerHTML         = manifest.author;
            document.getElementById('maxNotifs').innerHTML      = bgPage.config.maxNotifs;

        } else {

            document.getElementsByTagName('footer')[0].innerHTML    = '';
        }

        restore_options();
    });
}

document.addEventListener('DOMContentLoaded', start_options);
document.querySelector('#saveOptions').addEventListener('click', save_options);
document.querySelector('#resetNotifs').addEventListener('click', reset_notifications);
